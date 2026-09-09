// Local-only browser acceptance: real React pages, fake auth/database boundary,
// all external requests blocked. Never claims production or email delivery QA.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/asdA1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server = await createServer({ configFile: false, envDir: false, plugins: [react()], server: { host: '127.0.0.1', port: 5181, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const output = 'marketing/qa/conversion-sprint';
await mkdir(output, { recursive: true });
const results = [];
const fixture = `
const owner = { id: '00000000-0000-4000-8000-000000000001' };
const callbacks = new Set();
const qa = window.__qa = { calls: [], rows: JSON.parse(sessionStorage.getItem('qa-rows') || '{}'), signup: null };
const session = () => sessionStorage.getItem('qa-auth') ? {user:owner} : null;
const persist = () => sessionStorage.setItem('qa-rows',JSON.stringify(qa.rows));
export const supabase = {
 auth: {
  getSession: async () => ({data:{session:session()}}),
  onAuthStateChange(fn) { callbacks.add(fn); return {data:{subscription:{unsubscribe(){callbacks.delete(fn)}}}} },
  async signUp(value) { qa.signup=value; sessionStorage.setItem('qa-redirect',value.options.emailRedirectTo); return {data:{user:owner,session:null},error:null} },
  async signInWithPassword() { sessionStorage.setItem('qa-auth','yes'); for(const fn of callbacks) fn('SIGNED_IN',{user:owner}); return {error:null}; },
  resend: async () => ({error:null}), signOut: async () => ({error:null})
 },
 from(table) {
  let filters={}, operation='select', payload;
  const q = { select(){return this}, eq(k,v){filters[k]=v;return this}, order(){return this}, gte(){return this},
   insert(value){operation='insert';payload=value;return this}, update(value){operation='update';payload=value;return this},
   async single(){return run(true)}, async maybeSingle(){return run(true)}, then(resolve,reject){return Promise.resolve(run(false)).then(resolve,reject)} };
  function run(single){
   qa.calls.push({table,operation,payload,filters});
   if(table==='funnel_events' && window.__qaHangAnalytics)return new Promise(()=>{});
   if(table==='profiles')return {data:{id:owner.id,role:'customer',plan:'free'},error:null};
   if(table==='events'){
    if(operation==='insert') { if(qa.rows[payload.id])return {error:{code:'23505'}}; qa.rows[payload.id]={...payload,updated_at:'2026-09-09T12:00:00Z'};persist();return {data:{id:payload.id,updated_at:'2026-09-09T12:00:00Z'},error:null}; }
    if(operation==='update'){qa.rows[filters.id]={...qa.rows[filters.id],...payload};persist();return {data:{id:filters.id},error:null}}
    const rows=Object.values(qa.rows).filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v));return {data:single?rows[0]||null:rows,error:null};
   }
   return {data:single?null:[],error:null};
  }
  return q;
 },
 rpc: async (name,args) => {qa.calls.push({rpc:name,args});return name==='get_public_event'?{data:{id:'fictional',title:'Fictional shower',event_date:'2026-11-14',template_id:'classic',rsvp_title:'Please RSVP',flyer_background:'sage'},error:null}:{data:{},error:null}},
 functions:{invoke:async(name,args)=>{qa.calls.push({function:name,args});return {data:{},error:null}}}
};`;

async function contextFor(viewport, brokenStorage = false) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.host !== '127.0.0.1:5181') return route.abort();
    if (url.pathname === '/src/lib/supabaseClient.js') return route.fulfill({ contentType: 'application/javascript', body: fixture });
    return route.continue();
  });
  if (brokenStorage) await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked by test'); } }); });
  return context;
}
async function screenshot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name}: no horizontal overflow`);
}
try {
  for (const [size, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
    const context = await contextFor(viewport), page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5181/?utm_source=pinterest&utm_medium=organic&utm_campaign=baby-shower&utm_content=pin-01');
    await page.getByLabel('Invitation look').selectOption('gala');
    await page.getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
    await page.getByText('Demo RSVP complete — nothing was sent.').waitFor();
    await page.getByRole('link', { name: 'View Our Registry' }).click();
    await page.getByText('Fictional registry preview:', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => __qa.calls.some((call) => call.rpc || call.function || ['rsvps','comments'].includes(call.table))), false, 'demo must never call guest backend');
    await screenshot(page, `${size}-landing`);
    await page.goto('http://127.0.0.1:5181/create?style=little-sunshine');
    await page.getByLabel('Invitation title').fill('Fictional sunny shower');
    await page.getByLabel('Date', { exact: true }).fill('2026-11-14');
    await page.getByLabel('Time (optional)').fill('14:30');
    await page.getByRole('button', { name: 'Preview invitation', exact: true }).click();
    await page.getByLabel('Invitation look').selectOption('garden');
    await screenshot(page, `${size}-preview`);
    await page.reload();
    assert.equal(await page.getByLabel('Invitation title').inputValue(), 'Fictional sunny shower');
    await page.getByRole('button', { name: 'Preview invitation', exact: true }).click();
    await page.getByRole('button', { name: 'Sign up to save and share' }).click();
    await page.getByPlaceholder('Full name').fill('Fictional Host');
    await page.getByPlaceholder('Email', { exact: true }).fill('fictional@example.test');
    await page.getByPlaceholder('Password', { exact: true }).fill('fictional-test-password');
    await page.evaluate(() => { window.__qaHangAnalytics = true; });
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await page.getByText('Confirm your email in this browser', { exact: false }).waitFor();
    const redirect = await page.evaluate(() => { sessionStorage.setItem('qa-auth','yes'); return sessionStorage.getItem('qa-redirect'); });
    await page.goto(redirect);
    await page.waitForURL(/\/hub\/edit\//);
    const saved = await page.evaluate(() => Object.values(__qa.rows));
    assert.equal(saved.length, 1); assert.equal(saved[0].template_id, 'classic'); assert.equal(saved[0].is_published, false);
    await screenshot(page, `${size}-editor`);
    await page.getByRole('checkbox', { name: /published/i }).check();
    await page.getByRole('button', { name: 'Save Event', exact: true }).click();
    await page.waitForURL('**/hub');
    assert.equal(await page.evaluate(() => __qa.calls.some((call) => call.payload?.event_name === 'invitation_published')), true);
    await page.goto(`http://127.0.0.1:5181/upgrade?event=${saved[0].id}&checkout=success`);
    await page.getByText('Checking this event’s Signature access…').waitFor();
    assert.equal(await page.getByRole('button', { name: /Continue to secure checkout/ }).count(), 0);
    await screenshot(page, `${size}-upgrade-pending`);
    await page.evaluate(() => { for (const row of Object.values(__qa.rows)) row.signature_pass_active = true; sessionStorage.setItem('qa-rows', JSON.stringify(__qa.rows)); });
    await page.waitForURL(`**/hub/edit/${saved[0].id}?signature=active`);
    await page.getByText('Signature is confirmed active for this invitation.', { exact: false }).waitFor();
    await page.goto('http://127.0.0.1:5181/baby-shower-wording');
    await page.getByLabel('Tone').selectOption('simple');
    assert.match(await page.getByLabel('Your wording').inputValue(), /You’re invited/);
    await screenshot(page, `${size}-wording`);
    await page.getByRole('link', { name: 'Create your invitation', exact: true }).click();
    await page.waitForURL('**/create?**');
    const calls = await page.evaluate(() => __qa.calls.filter((call) => call.table === 'funnel_events'));
    assert.equal(JSON.stringify(calls).includes('fictional@example.test'), false);
    assert.equal(JSON.stringify(calls).includes('Fictional sunny shower'), false);
    await page.goto('http://127.0.0.1:5181/e/private-fictional-host-slug');
    await page.getByPlaceholder('Family / Guest Name(s)').fill('Fictional Guest');
    await page.getByPlaceholder('Email', { exact: true }).fill('guest@example.test');
    await page.getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('button', { name: 'Send RSVP', exact: true }).click();
    await page.getByText('Thank you - your RSVP has been received!').waitFor();
    await screenshot(page, `${size}-post-rsvp`);
    await page.getByRole('link', { name: 'Hosting something yourself? Create your invitation' }).click();
    const acquisition = await page.evaluate(() => __qa.calls.filter((call) => call.table === 'funnel_events'));
    assert.equal(JSON.stringify(acquisition).includes('private-fictional-host-slug'), false);
    assert.equal(JSON.stringify(acquisition).includes('guest@example.test'), false);
    assert.equal(new URL(page.url()).searchParams.get('utm_content'), 'rsvp-host-cta-v1');
    assert.deepEqual(errors, []);
    results.push(`${size}: demo isolation, draft restore, mocked signup with stalled analytics, callback/save/publish, pending checkout, wording, post-RSVP CTA privacy and responsive overflow passed`);
    await context.close();
  }
  const context = await contextFor({ width: 390, height: 844 }, true), page = await context.newPage();
  await page.goto('http://127.0.0.1:5181/create');
  await page.getByText('Browser storage unavailable.', { exact: false }).waitFor();
  await page.getByLabel('Date', { exact: true }).fill('2026-11-14');
  await page.getByRole('button', { name: 'Preview invitation', exact: true }).click();
  await page.getByRole('button', { name: 'Sign up to save and share' }).click();
  await page.getByText('Keep this tab open', { exact: false }).waitFor();
  await screenshot(page, 'mobile-storage-blocked');
  results.push('Blocked localStorage: preview remains usable; authentication handoff warns before data loss');
  await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ scope: 'Local mocked backend only; no live auth, RSVP or payment calls', results }, null, 2));
  console.log(results.join('\n'));
} finally { await browser.close(); await server.close(); }
