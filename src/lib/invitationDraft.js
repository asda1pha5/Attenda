export const DRAFT_KEY = 'attendaa-invitation-draft-v1';
const TTL = 7 * 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function cleanDraft(value, now = Date.now()) {
  if (!value || !uuid.test(value.id) || !Number.isFinite(value.updatedAt) || now - value.updatedAt > TTL) return null;
  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title.slice(0, 100) : '',
    event_date: /^\d{4}-\d{2}-\d{2}$/.test(value.event_date || '') ? value.event_date : '',
    event_time: /^\d{2}:\d{2}$/.test(value.event_time || '') ? value.event_time : '',
    style: ['garden-welcome', 'little-sunshine', 'storybook-baby', 'modern-nest'].includes(value.style) ? value.style : 'garden-welcome',
    template_id: ['classic', 'garden', 'gala', 'celebration', 'minimal'].includes(value.template_id) ? value.template_id : 'classic',
    updatedAt: value.updatedAt,
  };
}
export function newDraft(style = 'garden-welcome') {
  return cleanDraft({ id: crypto.randomUUID(), title: 'A baby shower', event_date: '', event_time: '', style, template_id: 'classic', updatedAt: Date.now() });
}
export function readDraft(storage) {
  try { return cleanDraft(JSON.parse(storage.getItem(DRAFT_KEY))); } catch { return null; }
}
export function writeDraft(storage, draft) {
  try { storage.setItem(DRAFT_KEY, JSON.stringify(cleanDraft(draft))); return true; } catch { return false; }
}
export function resetDraft(storage) {
  try { storage.removeItem(DRAFT_KEY); return true; } catch { return false; }
}
export function draftPayload(draft, userId, background) {
  const clean = cleanDraft(draft);
  if (!clean || !userId || !clean.title.trim() || !clean.event_date) throw new Error('Add a title and date before saving.');
  const [hours, minutes] = clean.event_time.split(':');
  const time = hours ? `${String(Number(hours) % 12 || 12).padStart(2, '0')}:${minutes} ${Number(hours) >= 12 ? 'PM' : 'AM'}` : null;
  return { id: clean.id, customer_id: userId, title: clean.title.trim(), event_date: clean.event_date,
    event_time: time, slug: `invitation-${clean.id}`, flyer_background: background,
    template_id: 'classic', is_published: false, show_event_details: true, rsvp_title: 'Please RSVP' };
}
// INSERT, never UPSERT: retry can recover an existing row, but cannot overwrite it.
export async function saveDraftEvent(client, draft, userId, background) {
  const payload = draftPayload(draft, userId, background);
  const existing = await client.from('events').select('id').eq('id', payload.id).eq('customer_id', userId).maybeSingle();
  if (existing.error) throw new Error('Could not check your saved draft. Please retry.');
  if (existing.data) return { id: existing.data.id, created: false };
  const result = await client.from('events').insert(payload).select('id').single();
  if (!result.error && result.data?.id) return { id: result.data.id, created: true };
  // Includes simultaneous tabs and an INSERT whose response was lost.
  const recovered = await client.from('events').select('id').eq('id', payload.id).eq('customer_id', userId).maybeSingle();
  if (!recovered.error && recovered.data) return { id: recovered.data.id, created: false };
  throw new Error('Your draft could not be saved. It is still here; please retry.');
}
