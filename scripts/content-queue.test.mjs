import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, productionErrors, validateQueue } from './content-queue.mjs';
function record(overrides = {}) { return { id: 'a', concept: 'rsvp', asset_version: 'v1', assets: [{ path: 'a.mp4', sha256: 'hash' }], caption: 'Fictional demo', cta: 'Create yours', attribution_id: 'demo', format: 'reel', creator: 'producer', status: 'planned', independent_qa: { status: 'incomplete' }, revision_reason: null, owner_approval: null, publish_url: null, measurement_window: {}, production_brief: { evidence: 'brief', success_metric: 'starts' }, ...overrides }; }
test('duplicate concept is stopped before production; explicit revision relationship allowed', () => {
 const a = record(), b = record({ id: 'b' });
 assert.match(productionErrors({ items: [a,b] }, 'a').join(), /duplicate concept/);
 a.revises = 'b'; assert.deepEqual(productionErrors({ items: [a,b] }, 'a'), []);
});
test('rejected asset path and copied hash are blocked', () => {
 const rejected = record({ id: 'old', status: 'rejected' });
 const next = record({ assets: [{ path: 'renamed.mp4', sha256: 'hash' }] });
 assert.match(productionErrors({ items: [rejected,next] }, 'a').join(), /rejected asset/);
 assert.match(productionErrors({ items: [rejected] }, 'old').join(), /not eligible/);
});
test('creator ready and metadata cannot stand in for full-timeline independent QA', () => {
 const a = record({ status: 'ready_for_review' });
 a.independent_qa = { status: 'passed', reviewer: 'producer', evidence: 'decode', asset_fingerprint: fingerprint(a), width: 1080, height: 1920 };
 const errors = validateQueue({ items: [a] }).join();
 assert.match(errors, /independent QA/); assert.match(errors, /full-timeline/);
});
test('exact final version, independent complete review and separate owner evidence required', () => {
 const a = record({ status: 'approved_to_publish' });
 a.independent_qa = { status: 'passed', reviewer: 'reviewer', evidence: 'full playback notes', asset_fingerprint: fingerprint(a), full_timeline: true, full_screen: true, audio_reviewed: true, native_capture: true, full_bleed: true, width: 1080, height: 1920 };
 assert.match(validateQueue({ items: [a] }).join(), /owner approval/);
 a.owner_approval = { at: '2026-09-08', evidence: 'explicit owner message', asset_fingerprint: fingerprint(a) };
 assert.deepEqual(validateQueue({ items: [a] }), []);
 a.caption = 'changed'; assert.match(validateQueue({ items: [a] }).join(), /stale/);
});
test('published history may retain unknown approval and URL without fabricating evidence', () => {
 assert.deepEqual(validateQueue({ items: [record({ status: 'published' })] }), []);
});
test('missing strategic input blocks production', () => {
 assert.match(productionErrors({ items: [record({ production_brief: null })] }, 'a').join(), /evidence and success metric/);
});
