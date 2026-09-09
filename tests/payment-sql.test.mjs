// Executes the actual migration in embedded PostgreSQL. PGlite serializes one
// connection: concurrent JS deliveries are covered, not independent DB sessions.
// Install optional test runtime: npm install --prefix .tmp-conversion-test
// --no-save --package-lock=false @electric-sql/pglite@0.5.8
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.tmp-conversion-test/node_modules/@electric-sql/pglite/dist/index.js';
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260909133540_conversion_readiness_payments.sql', import.meta.url), 'utf8');
const owner = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003';
const purchase = { user_id: owner, event_id: id, session_id: 'cs_test_one', payment_intent_id: 'pi_one', webhook_id: 'evt_one', webhook_type: 'checkout.session.completed', customer_id: 'cus_one', amount: 1900, currency: 'usd', visitor_id: owner, utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'baby-shower', utm_content: 'pin-01' };
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`);
  for (const table of ['profiles', 'events', 'stripe_webhook_events', 'funnel_events']) {
    const sql = schema.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`))[0];
    await db.exec(sql);
  }
  await db.exec(`create function public.is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
    grant usage on schema public,auth to service_role,authenticated,anon;
    grant all on all tables in schema public to service_role;
    grant select,insert,update,delete on public.events to authenticated;
    grant select on public.profiles to authenticated;
    grant insert on public.funnel_events to authenticated,anon;
    alter table public.events enable row level security;
    alter table public.funnel_events enable row level security;
    create policy owner on public.events for all to authenticated using(customer_id=auth.uid()) with check(customer_id=auth.uid());
    insert into auth.users(id) values('${owner}'),('${other}');
    insert into public.profiles(id) values('${owner}'),('${other}');
    insert into public.events(id,customer_id,slug,title) values('${id}','${owner}','fictional','Fictional shower');`);
  await db.exec(migration);
  return db;
}
async function role(db, name, sub) { await db.exec(`reset role; set role ${name};`); await db.query("select set_config('request.jwt.claims',$1,false)", [sub ? JSON.stringify({ sub, role: name }) : '']); }
const activate = (db, value = purchase) => db.query('select public.activate_signature_purchase($1::jsonb) as result', [JSON.stringify(value)]);
async function counts(db) { await role(db,'service_role'); return (await db.query(`select (select count(*) from signature_purchases)::int purchases, (select count(*) from funnel_events)::int conversions, (select count(*) from stripe_webhook_events where processed_at is not null)::int processed, (select signature_pass_active from events where id='${id}') active`)).rows[0]; }

test('actual SQL commits activation, sanitized purchase attribution and receipt exactly once', async () => {
  const db=await setup();try {
    await role(db,'service_role');
    assert.equal((await activate(db)).rows[0].result.active,true);
    assert.equal((await activate(db)).rows[0].result.duplicate,true);
    const concurrent=await Promise.all([activate(db,{...purchase,webhook_id:'evt_async',webhook_type:'checkout.session.async_payment_succeeded'}),activate(db)]);
    assert.ok(concurrent.every(value=>value.rows[0].result.duplicate));
    assert.deepEqual(await counts(db),{purchases:1,conversions:1,processed:2,active:true});
    const row=(await db.query('select visitor_id,source,medium,campaign,content from signature_purchases')).rows[0];
    assert.deepEqual(row,{visitor_id:owner,source:'pinterest',medium:'organic',campaign:'baby-shower',content:'pin-01'});
  }finally{await db.close()}
});
test('failure after entitlement update rolls back every write and legacy receipt remains retryable', async () => {
  const db=await setup();try{
    await db.exec(`insert into stripe_webhook_events(id,event_type) values('evt_one','checkout.session.completed');
      create function fail_conversion() returns trigger language plpgsql as $$ begin raise exception 'Injected conversion failure'; end $$;
      create trigger fail_conversion before insert on funnel_events for each row execute function fail_conversion();`);
    await role(db,'service_role');await assert.rejects(activate(db),/Injected conversion failure/);
    assert.deepEqual(await counts(db),{purchases:0,conversions:0,processed:0,active:false});
    await role(db,'postgres');await db.exec('drop trigger fail_conversion on funnel_events');
    await role(db,'service_role');await activate(db);
    assert.deepEqual(await counts(db),{purchases:1,conversions:1,processed:1,active:true});
  }finally{await db.close()}
});
test('invalid amount, event owner, duplicate payment mismatch and missing event are rejected atomically', async()=>{
  const db=await setup();try{
    await role(db,'service_role');
    await assert.rejects(activate(db,{...purchase,amount:100}),/Invalid purchase/);
    await assert.rejects(activate(db,{...purchase,user_id:other}),/owner mismatch/);
    await assert.rejects(activate(db,{...purchase,event_id:other}),/owner mismatch/);
    assert.deepEqual(await counts(db),{purchases:0,conversions:0,processed:0,active:false});
    await activate(db);
    await assert.rejects(activate(db,{...purchase,session_id:'cs_other',payment_intent_id:'pi_other'}),/another Signature payment/);
    assert.deepEqual(await counts(db),{purchases:1,conversions:1,processed:1,active:true});
  }finally{await db.close()}
});
test('paid-event deletion stays available without deleting confirmed revenue history',async()=>{
  const db=await setup();try{
    await role(db,'service_role');await activate(db);
    await role(db,'authenticated',owner);await db.query('delete from events where id=$1',[id]);
    await role(db,'service_role');const rows=(await db.query('select event_id,amount from signature_purchases')).rows;
    assert.deepEqual(rows,[{event_id:null,amount:1900}]);
  }finally{await db.close()}
});
test('Free owner cannot forge payment, paid options or purchase analytics; normal edits still work',async()=>{
  const db=await setup();try{
    await role(db,'authenticated',owner);
    await assert.rejects(activate(db),/permission denied/);
    await assert.rejects(db.query(`update events set signature_pass_active=true where id=$1`,[id]),/service managed/);
    await assert.rejects(db.query(`update events set template_id='gala' where id=$1`,[id]),/Signature purchase required/);
    await assert.rejects(db.query(`insert into events(customer_id,slug,title,signature_pass_active) values($1,'forged','forged',true)`,[owner]),/service managed/);
    await assert.rejects(db.query(`insert into events(customer_id,slug,title,template_id) values($1,'paid-preview','preview','gala')`,[owner]),/Signature purchase required/);
    await assert.rejects(db.query(`insert into funnel_events(event_name,visitor_id) values('checkout_completed','fake')`),/row-level security/);
    await db.query(`update events set title='Normal edit' where id=$1`,[id]);
    await role(db,'service_role');await activate(db);
    await role(db,'authenticated',owner);await db.query(`update events set template_id='gala' where id=$1`,[id]);
    assert.equal((await db.query('select template_id from events where id=$1',[id])).rows[0].template_id,'gala');
  }finally{await db.close()}
});
test('Free editor preserves admin-prepared settings and definer password RPC cannot bypass guard',async()=>{
  const db=await setup();try{
    await db.exec(`update events set template_id='garden' where id='${id}';
      create function test_definer_password() returns void language sql security definer as $$ update events set password_protected=true where id='${id}' $$;
      grant execute on function test_definer_password() to authenticated;`);
    await role(db,'authenticated',owner);await db.query(`update events set title='Still Free' where id=$1`,[id]);
    await assert.rejects(db.query('select test_definer_password()'),/Signature purchase required/);
  }finally{await db.close()}
});
