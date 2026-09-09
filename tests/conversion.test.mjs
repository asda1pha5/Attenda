import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDraft, newDraft, writeDraft, readDraft, resetDraft, draftPayload, saveDraftEvent } from '../src/lib/invitationDraft.js';
import { captureAttribution, sanitizeAttribution, analyticsPath, safeProperties } from '../src/lib/attribution.js';
import { babyShowerWording } from '../src/lib/babyShowerWording.js';

function storage() { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; }
const broken = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
function fixture() { return { ...newDraft(), title: 'Fictional shower', event_date: '2026-11-14', event_time: '14:30' }; }

test('draft restores across authentication, strips private fields and expires', () => {
  const store = storage(), draft = { ...fixture(), guests: ['secret'], address: 'private', registry_link: 'https://private', signature_pass_active: true };
  assert.equal(writeDraft(store, draft), true);
  const restored = readDraft(store);
  assert.equal(restored.id, draft.id);
  assert.equal(restored.title, draft.title);
  assert.equal(restored.guests, undefined);
  assert.equal(restored.address, undefined);
  assert.equal(restored.signature_pass_active, undefined);
  assert.equal(cleanDraft({ ...draft, updatedAt: Date.now() - 8 * 86400000 }), null);
  assert.equal(resetDraft(store), true);
  assert.equal(readDraft(store), null);
});
test('blocked and malformed storage never break preview', () => {
  assert.equal(writeDraft(broken, fixture()), false);
  assert.equal(readDraft(broken), null);
  assert.equal(resetDraft(broken), false);
  assert.equal(readDraft({ getItem: () => '{bad json' }), null);
  assert.equal(cleanDraft({ id: 'bad' }), null);
});
test('paid preview saves an unpublished Free event with no entitlement fields', () => {
  const payload = draftPayload({ ...fixture(), template_id: 'gala', signature_pass_active: true }, 'owner', 'sage');
  assert.equal(payload.template_id, 'classic');
  assert.equal(payload.is_published, false);
  assert.equal(payload.signature_pass_active, undefined);
  assert.equal(payload.event_time, '02:30 PM');
  assert.throws(() => draftPayload({ ...fixture(), event_date: '' }, 'owner', 'sage'));
});
function database({ loseResponse = false, failOnce = false } = {}) {
  const rows = new Map(); let inserts = 0;
  return { rows, get inserts() { return inserts; }, from() {
    let payload, filters = {};
    const query = { select() { return this; }, eq(k, v) { filters[k] = v; return this; }, insert(value) { payload = value; return this; },
      async maybeSingle() { const row = rows.get(filters.id); return { data: row?.customer_id === filters.customer_id ? { id: row.id } : null }; },
      async single() { inserts++; if (failOnce) { failOnce = false; return { error: { message: 'failure' } }; } if (rows.has(payload.id)) return { error: { code: '23505' } }; rows.set(payload.id, payload); return loseResponse ? { error: { message: 'connection lost' } } : { data: { id: payload.id } }; } };
    return query;
  } };
}
test('save recovers a lost response and duplicates without overwriting', async () => {
  const db = database({ loseResponse: true }), draft = fixture();
  assert.equal((await saveDraftEvent(db, draft, 'owner', 'sage')).id, draft.id);
  await saveDraftEvent(db, { ...draft, title: 'Do not overwrite' }, 'owner', 'sage');
  assert.equal(db.rows.size, 1); assert.equal(db.inserts, 1); assert.equal(db.rows.get(draft.id).title, draft.title);
});
test('concurrent save converges to one row and failed save remains retryable', async () => {
  const db = database(), draft = fixture();
  const result = await Promise.all([saveDraftEvent(db, draft, 'owner', 'sage'), saveDraftEvent(db, draft, 'owner', 'sage')]);
  assert.equal(result[0].id, result[1].id); assert.equal(db.rows.size, 1);
  const flaky = database({ failOnce: true });
  await assert.rejects(saveDraftEvent(flaky, draft, 'owner', 'sage'));
  await saveDraftEvent(flaky, draft, 'owner', 'sage'); assert.equal(flaky.rows.size, 1);
  await assert.rejects(saveDraftEvent(flaky, draft, 'another-owner', 'sage'));
});
test('attribution survives landing, signup and checkout without internal referrer overwrite', () => {
  const store = storage();
  const captured = captureAttribution('?utm_source=pinterest&utm_medium=organic&utm_campaign=baby-shower&utm_content=pin-01', store, 1000);
  assert.deepEqual(captureAttribution('?next=%2Fcreate', store, 2000), captured);
  assert.deepEqual(captureAttribution('?event=private-id', store, 3000), captured);
  assert.deepEqual(captureAttribution('', store, 32 * 86400000), {});
});
test('analytics excludes URLs, emails, private paths and payload fields', () => {
  assert.deepEqual(sanitizeAttribution({ utm_source: 'person@example.com', utm_content: 'https://secret', utm_medium: '1234567890', utm_campaign: 'safe-campaign' }), { source: null, medium: null, content: null, campaign: 'safe-campaign' });
  assert.equal(analyticsPath('/e/private-host-name'), '/e/:slug');
  assert.equal(analyticsPath('/hub/edit/private-id'), '/hub/edit/:id');
  assert.deepEqual(safeProperties({ title: 'Private', email: 'private', experiment: 'baby-wording-v1' }), { experiment: 'baby-wording-v1' });
  assert.doesNotThrow(() => captureAttribution('?utm_source=pinterest', broken));
});
test('wording offers distinct useful templates with explicit placeholders', () => {
  for (const tone of ['warm', 'simple', 'playful']) { const text = babyShowerWording(tone); assert.match(text, /\[name\]/); assert.match(text, /Please RSVP by \[date\]/); assert.match(text, /Registry \(optional\)/); }
  assert.notEqual(babyShowerWording('warm'), babyShowerWording('simple'));
  assert.equal(babyShowerWording('unknown'), babyShowerWording('warm'));
});
