import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/pages/Upgrade.jsx'], bundle: true, write: false, format: 'cjs', jsx: 'automatic', plugins: [{ name: 'test-boundaries', setup(builder) {
  builder.onResolve({ filter: /^(react|react\/jsx-runtime|react-router-dom)$|lib\/|\.png$|components\/InvitationDemo/ }, (args) => ({ path: args.path, namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: path.endsWith('.png') ? 'export default "mark.png";' : path.includes('InvitationDemo') ? 'export default "invitation-demo";' : `module.exports = globalThis.boundaries;`, loader: 'js' }));
} } ] });

function harness(query, responses) {
  let cursor = 0; const hooks = []; const pending = []; const timers = []; const calls = []; const redirects = [];
  let params = new URLSearchParams(query);
  const jsx = (type, props) => ({ type, props });
  const boundaries = {
    jsx, jsxs: jsx, Link: 'a', usePageTitle() {}, useNavigate: () => (path) => redirects.push(path), useAuth: () => ({ user: { id: 'owner' }, isPremium: true }),
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect(callback, deps) { const index = cursor++; const previous = hooks[index]; if (!previous || deps.some((value, i) => value !== previous[i])) { hooks[index] = deps; pending.push(callback); } },
    useSearchParams: () => [params, (value) => { params = new URLSearchParams(value); }],
    trackFunnelEvent: async () => {}, getCheckoutAttribution: () => ({ attribution: { utm_content: 'sample' }, visitor_id: 'anonymous' }),
    supabase: { from(table) { calls.push(['from', table]); return { select() { return this; }, eq(key, value) { calls.push([key, value]); return this; }, order: async () => responses.shift() || { data: [] } }; }, functions: { invoke: async (name, body) => { calls.push([name, body]); return { data: { url: 'https://checkout.stripe.com/example' } }; } } },
  };
  const context = vm.createContext({ boundaries, exports: {}, module: { exports: {} }, setTimeout: (fn) => timers.push(fn), clearTimeout() {}, window: { location: { assign: (url) => redirects.push(url) } } });
  vm.runInContext(compiled.outputFiles[0].text, context);
  function render() { cursor = 0; return context.module.exports.default(); }
  async function settle() { for (const effect of pending.splice(0)) effect(); await new Promise(setImmediate); return render(); }
  return { render, settle, timers, calls, redirects };
}
function elements(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(elements) : [node, ...elements(node.props?.children)]; }
function text(node) { return !node ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children); }
const event = (active = false) => ({ id: 'event-a', title: 'Fictional shower', signature_pass_active: active });

test('success query cannot grant activation; polls owned event and links exact invitation only after confirmation', async () => {
  const h = harness('checkout=success&event=event-a', [{ data: [event()] }, { data: [event(true)] }]);
  h.render(); let tree = await h.settle();
  assert.match(text(tree), /Checking this event/);
  assert.doesNotMatch(text(tree), /confirmed active/);
  assert.ok(h.calls.some(([key, value]) => key === 'customer_id' && value === 'owner'));
  await h.timers.shift()(); tree = h.render();
  assert.match(text(tree), /confirmed active/);
  assert.ok(elements(tree).some((el) => el.props?.to === '/hub/edit/event-a' && text(el) === 'Return to your Signature invitation'));
  await h.settle();
  assert.ok(h.redirects.includes('/hub/edit/event-a?signature=active'));
});
test('unknown event does not silently select another or offer checkout', async () => {
  const h = harness('event=someone-else', [{ data: [event()] }]); h.render(); const tree = await h.settle();
  assert.match(text(tree), /unavailable for this account/);
  assert.ok(elements(tree).find((el) => el.type === 'button' && text(el).includes('secure checkout')).props.disabled);
});
test('checkout keeps event and attribution, independent of account premium flag; prevents double click', async () => {
  const h = harness('event=event-a', [{ data: [event()] }]); h.render(); const tree = await h.settle();
  const button = elements(tree).find((el) => el.type === 'button' && text(el).includes('secure checkout'));
  assert.equal(button.props.disabled, false);
  await Promise.all([button.props.onClick(), button.props.onClick()]);
  const requests = h.calls.filter(([name]) => name === 'create-checkout-session');
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].body.eventId, 'event-a');
  assert.equal(requests[0][1].body.attribution.utm_content, 'sample');
  assert.equal(h.redirects.length, 1);
});
test('load failures allow retry without claiming purchase success', async () => {
  const h = harness('checkout=success&event=event-a', [{ error: new Error('offline') }]); h.render(); const tree = await h.settle();
  assert.match(text(tree), /could not check your event/);
  assert.match(text(tree), /Check activation again/);
  assert.doesNotMatch(text(tree), /confirmed active/);
});
test('polling stops honestly pending with no second checkout', async () => {
  const h = harness('checkout=success&event=event-a', Array.from({ length: 10 }, () => ({ data: [event()] })));
  h.render(); await h.settle(); while (h.timers.length) await h.timers.shift()();
  const tree = h.render(); assert.match(text(tree), /activation has not been confirmed/);
  assert.equal(elements(tree).filter((el) => el.type === 'button' && text(el).includes('secure checkout')).length, 0);
});
