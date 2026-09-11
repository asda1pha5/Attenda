import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
const owner='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
async function compile(file) {
  const result=await build({entryPoints:[file],bundle:true,write:false,format:'cjs',plugins:[{name:'external-payment-boundaries',setup(builder){
    builder.onResolve({filter:/^(npm:stripe|https:\/\/esm.sh\/)/},args=>({path:args.path,namespace:'mock'}));
    builder.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path.startsWith('npm:')?'export default globalThis.boundaries.Stripe;':'export const createClient = globalThis.boundaries.createClient;',loader:'js'}));
  }}]});return result.outputFiles[0].text;
}
const checkoutCode=await compile('supabase/functions/create-checkout-session/index.ts');
const webhookCode=await compile('supabase/functions/stripe-webhook/index.ts');
function harness(code,{auth=true,owned=true,active=false,profileError=false,dbError=false,badPrice=false,invalidSignature=false,missingCustomer=false}={}){
  const calls=[];let handler;
  const metadata={user_id:owner,event_id:id,plan:'signature_pass'};
  const session={id:'cs_one',mode:'payment',status:'complete',payment_status:'paid',amount_total:1900,currency:'usd',client_reference_id:owner,customer:'cus_one',metadata,line_items:{has_more:false,data:[{quantity:1,price:{id:'price_one'}}]},payment_intent:{id:'pi_one',customer:'cus_one',metadata,status:'succeeded',amount_received:1900,currency:'usd'}};
  const stripe = {
    prices: { retrieve: async () => ({ active: true, type: 'one_time', currency: 'usd', unit_amount: badPrice ? 100 : 1900 }) },
    checkout: { sessions: { create: async (data) => { calls.push(data); if (missingCustomer && calls.length === 1 && data.customer) throw Object.assign(new Error('No such customer'), { code: 'resource_missing', param: 'customer' }); return { url: 'https://checkout.stripe.com/test' }; }, retrieve: async () => session } },
    webhooks: { constructEventAsync: async () => { if (invalidSignature) throw Error('Invalid'); return { id: 'evt_one', type: 'checkout.session.completed', data: { object: { id: 'cs_one' } } }; } },
  };
  function Stripe(){return stripe}Stripe.createSubtleCryptoProvider=()=>({});
  const admin={auth:{getUser:async()=>({data:{user:auth?{id:owner,email:'fictional@example.test'}:null},error:auth?null:{message:'expired'}})},from(table){return {select(){return this},eq(){return this},async maybeSingle(){return table==='events'?{data:{id,customer_id:owned?owner:'other',signature_pass_active:active}}:{data:{stripe_customer_id:'cus_one'},error:profileError?{message:'failed'}:null}}}},rpc:async()=>dbError?{error:{message:'failed'}}:{data:{active:true}}};
  const env={STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SIGNING_SECRET:'fixture',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture',STRIPE_SIGNATURE_PRICE_ID:'price_one',APP_URL:'https://attendaa.test'};
  const context=vm.createContext({boundaries:{Stripe,createClient:()=>admin},module:{exports:{}},exports:{},Response,Request,console:{error(){}},Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn}}});
  vm.runInContext(code,context);
  return {handler,calls};
}
function request(body={},headers={Authorization:'Bearer fixture'}){return new Request('https://local.test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
test('checkout rejects missing/expired auth, wrong ownership and an already paid event',async()=>{
  assert.equal((await harness(checkoutCode).handler(request({eventId:id},{}))).status,401);
  for(const [options,status] of [[{auth:false},401],[{owned:false},404],[{active:true},409],[{profileError:true},500],[{badPrice:true},503]]){
    const h=harness(checkoutCode,options);assert.equal((await h.handler(request({eventId:id}))).status,status);assert.equal(h.calls.length,0);
  }
});
test('checkout preserves event, $19 one-time price and sanitized attribution without authority override',async()=>{
  const h=harness(checkoutCode);const response=await h.handler(request({eventId:id,visitor_id:owner,attribution:{utm_content:'pin-01',utm_source:'pinterest',user_id:'attacker',event_id:'attacker',email:'private'}}));
  assert.equal(response.status,200);const value=h.calls[0];assert.equal(value.mode,'payment');assert.equal(value.metadata.user_id,owner);assert.equal(value.metadata.event_id,id);assert.equal(value.metadata.utm_content,'pin-01');assert.equal(value.metadata.email,undefined);
  assert.match(value.success_url,new RegExp(`event=${id}&checkout=success`));assert.match(value.cancel_url,new RegExp(`event=${id}&checkout=cancelled`));
  assert.equal(value.customer_creation,undefined);assert.equal(value.customer,'cus_one');
});
test('checkout recovers when a test-mode customer ID is unavailable in live Stripe',async()=>{
  const h=harness(checkoutCode,{missingCustomer:true});const response=await h.handler(request({eventId:id}));
  assert.equal(response.status,200);assert.equal(h.calls.length,2);assert.equal(h.calls[0].customer,'cus_one');
  assert.equal(h.calls[1].customer,undefined);assert.equal(h.calls[1].customer_email,'fictional@example.test');assert.equal(h.calls[1].customer_creation,'always');
});
test('webhook requires valid Stripe signature and returns failure until activation is confirmed',async()=>{
  assert.equal((await harness(webhookCode).handler(request({},{}))).status,400);
  assert.equal((await harness(webhookCode,{invalidSignature:true}).handler(request({},{'stripe-signature':'fixture'}))).status,400);
  assert.equal((await harness(webhookCode,{dbError:true}).handler(request({},{'stripe-signature':'fixture'}))).status,500);
  const response=await harness(webhookCode).handler(request({},{'stripe-signature':'fixture'}));assert.equal(response.status,200);assert.equal((await response.json()).active,true);
});
