import test from 'node:test';
import assert from 'node:assert/strict';
import { attributionMetadata, activateSignature, validateSignatureSession, fulfillWebhook } from '../supabase/functions/_shared/payment-core.mjs';
const user = '00000000-0000-4000-8000-000000000001', eventId = '00000000-0000-4000-8000-000000000002';
const authority = { user_id: user, event_id: eventId, plan: 'signature_pass' };
function session() { return { id: 'cs_test_session', mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 1900, currency: 'usd', client_reference_id: user, customer: 'cus_test', metadata: { ...authority, utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'baby-shower', utm_content: 'pin-01', visitor_id: user }, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_signature' } }] }, payment_intent: { id: 'pi_test', status: 'succeeded', amount_received: 1900, currency: 'usd', customer: 'cus_test', metadata: authority } }; }
const webhook = { id: 'evt_test', type: 'checkout.session.completed', data: { object: { id: 'cs_test_session' } } };
test('settled Signature payment validates and carries separate sanitized attribution to atomic RPC', async () => {
  let args;
  const admin = { rpc: async (name, input) => { args = {name,input}; return {data:{active:true}}; } };
  const result = await activateSignature(admin, session(), 'price_signature', webhook);
  assert.equal(result.active, true); assert.equal(args.name, 'activate_signature_purchase');
  assert.equal(args.input.purchase.utm_content, 'pin-01'); assert.equal(args.input.purchase.user_id, user);
  assert.equal(args.input.purchase.webhook_id, webhook.id);
});
test('invalid, unpaid, wrong price/product/currency and mismatched authority never reach database', async () => {
  const changes = [s=>s.payment_status='unpaid',s=>s.amount_total=100,s=>s.currency='eur',s=>s.mode='subscription',s=>s.status='open',s=>s.client_reference_id='other',s=>s.metadata.event_id='bad',s=>s.metadata.plan='free',s=>s.line_items.data[0].quantity=2,s=>s.line_items.data[0].price.id='other',s=>s.payment_intent.status='processing',s=>s.payment_intent.amount_received=1800,s=>s.payment_intent.metadata={...authority,event_id:user},s=>s.payment_intent.customer='cus_other'];
  for(const change of changes){const value=session();change(value);await assert.rejects(activateSignature({rpc(){assert.fail('invalid payment reached RPC')}},value,'price_signature',webhook));}
});
test('database errors, thrown errors and missing confirmation all remain retryable', async () => {
  for(const response of [{error:{message:'failure'}},{data:{}},{data:{active:false}}])await assert.rejects(activateSignature({rpc:async()=>response},session(),'price_signature',webhook));
  let attempts=0;const admin={rpc:async()=>++attempts===1?{error:{message:'transient'}}:{data:{active:true}}};
  await assert.rejects(activateSignature(admin,session(),'price_signature',webhook));
  assert.equal((await activateSignature(admin,session(),'price_signature',webhook)).active,true);
});
test('async settlement retrieves canonical Stripe session; pending payment does not activate', async () => {
  const value=session();value.payment_status='unpaid';let writes=0,retrieved;
  const stripe={checkout:{sessions:{retrieve:async(id)=>{retrieved=id;return value}}}};
  const admin={rpc:async()=>{writes++;return {data:{active:true}}}};
  assert.equal((await fulfillWebhook({stripe,admin,event:webhook,priceId:'price_signature'})).pending,true);assert.equal(writes,0);
  value.payment_status='paid';assert.equal((await fulfillWebhook({stripe,admin,event:{...webhook,type:'checkout.session.async_payment_succeeded'},priceId:'price_signature'})).active,true);
  assert.equal(retrieved,'cs_test_session');assert.equal(writes,1);
});
test('attribution cannot override ownership or accept private free text', () => {
  assert.deepEqual(attributionMetadata({user_id:'attacker',plan:'signature_pass',utm_source:'host@example.com',utm_content:'https://private',utm_campaign:'safe'},'guest@example.com'),{utm_campaign:'safe'});
  assert.equal(validateSignatureSession(session(),'price_signature').amount,1900);
});
test('legacy state is retrieved afresh and failed profile updates propagate for retry', async () => {
  const event={id:'evt_legacy',type:'customer.subscription.updated',data:{object:{id:'sub_test'}}};
  let input;
  const stripe={subscriptions:{retrieve:async()=>({id:'sub_test',customer:'cus_test',status:'canceled',metadata:{user_id:user}})}};
  const admin={rpc:async(name,args)=>{input={name,args};return {error:{message:'failed'}}}};
  await assert.rejects(fulfillWebhook({stripe,admin,event,priceId:'price_signature'}));
  assert.equal(input.name,'sync_legacy_signature_subscription');assert.equal(input.args.subscription_data.status,'canceled');
});
