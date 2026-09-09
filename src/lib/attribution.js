const key = 'attenda-funnel-attribution';
const maxAge = 30 * 24 * 60 * 60 * 1000;
// Campaign identifiers only: reject free text, URLs, emails, long digit strings.
export function campaignToken(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}/.test(value) ? value.toLowerCase() : null;
}
export function sanitizeAttribution(input = {}) {
  return Object.fromEntries(['source', 'medium', 'campaign', 'content'].map((field) => [field, campaignToken(input[`utm_${field}`] ?? input[field])]));
}
export function captureAttribution(search, storage, now = Date.now()) {
  const params = new URLSearchParams(search);
  let previous = {};
  try { const saved = JSON.parse(storage.getItem(key)); if (saved?.capturedAt && now - saved.capturedAt < maxAge) previous = sanitizeAttribution(saved); } catch { /* Memory-only fallback below. */ }
  const hasCampaign = ['source', 'medium', 'campaign', 'content'].some((field) => params.has(`utm_${field}`));
  const current = hasCampaign ? sanitizeAttribution(Object.fromEntries(params)) : previous;
  if (hasCampaign) { try { storage.setItem(key, JSON.stringify({ ...current, capturedAt: now })); } catch {} }
  return current;
}
export function analyticsPath(path) {
  if (path.startsWith('/e/')) return '/e/:slug';
  if (path.startsWith('/rsvp/')) return '/rsvp/:slug/manage';
  if (/^\/(hub|admin)\/edit\//.test(path)) return path.replace(/\/edit\/.*/, '/edit/:id');
  return ['/', '/create', '/login', '/upgrade', '/hub', '/hub/new', '/admin', '/admin/new', '/baby-shower-rsvp', '/baby-shower-wording', '/help'].includes(path) ? path : '/other';
}
export function safeProperties(properties) {
  return Object.fromEntries(['placement', 'style', 'template', 'entry', 'experiment', 'tone'].filter((key) => campaignToken(properties[key])).map((key) => [key, campaignToken(properties[key])]));
}
