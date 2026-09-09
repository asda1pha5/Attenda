import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fingerprint = item => crypto.createHash('sha256').update(JSON.stringify({ version: item.asset_version, assets: item.assets, caption: item.caption, cta: item.cta, attribution: item.attribution_id })).digest('hex');
export function validateQueue(queue) {
  const errors = [], ids = new Set();
  for (const item of queue.items) {
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate ID`);
    ids.add(item.id);
    if (!['planned', 'in_production', 'needs_revision', 'qa_incomplete', 'ready_for_review', 'approved_to_publish', 'published', 'retired', 'rejected'].includes(item.status)) errors.push(`${item.id}: invalid status`);
    for (const key of ['concept', 'asset_version', 'caption', 'cta', 'attribution_id', 'independent_qa', 'revision_reason', 'owner_approval', 'publish_url', 'measurement_window']) {
      if (!(key in item)) errors.push(`${item.id}: missing ${key}`);
    }
    if (['ready_for_review', 'approved_to_publish'].includes(item.status)) {
      if (!item.assets?.length || item.assets.some(asset => !asset.sha256)) errors.push(`${item.id}: final hashed assets required`);
      if (!item.caption || !item.cta || !item.attribution_id) errors.push(`${item.id}: final caption, CTA and attribution required`);
      const qa = item.independent_qa;
      if (qa?.status !== 'passed' || !qa.reviewer || qa.reviewer === item.creator || !qa.evidence || qa.asset_fingerprint !== fingerprint(item)) errors.push(`${item.id}: independent QA missing or stale`);
      if (item.format === 'reel' && !(qa?.full_timeline === true && qa.full_screen === true && qa.audio_reviewed === true && qa.native_capture === true && qa.full_bleed === true && qa.width >= 1080 && qa.height >= 1920)) errors.push(`${item.id}: complete native full-timeline Reel QA required`);
    }
    if (item.status === 'approved_to_publish' && !(item.owner_approval?.evidence && item.owner_approval?.at && item.owner_approval.asset_fingerprint === fingerprint(item))) errors.push(`${item.id}: exact-version owner approval required`);
  }
  return errors;
}
export function productionErrors(queue, id) {
  const item = queue.items.find(row => row.id === id);
  if (!item) return [`Unknown queue item: ${id}`];
  const errors = [];
  if (!['planned', 'needs_revision', 'in_production'].includes(item.status)) errors.push(`${id}: status ${item.status} is not eligible for production`);
  if (!item.production_brief?.evidence || !item.production_brief?.success_metric) errors.push(`${id}: evidence and success metric required before production`);
  for (const other of queue.items.filter(row => row.id !== id)) {
    if (other.concept === item.concept && !['retired', 'rejected'].includes(other.status) && item.revises !== other.id) errors.push(`${id}: duplicate concept ${other.id}; revise the existing item or document revises`);
  }
  const rejected = queue.items.filter(row => row.status === 'rejected').flatMap(row => row.assets || []);
  for (const asset of item.assets || []) if (rejected.some(old => old.path === asset.path || (old.sha256 && old.sha256 === asset.sha256))) errors.push(`${id}: rejected asset cannot be reused: ${asset.path}`);
  return errors;
}
export function renderViews(queue) {
  const lines = ['# Attendaa content queue', '', 'Generated from [CONTENT_QUEUE.json](CONTENT_QUEUE.json). Edit that authoritative source, then run `node scripts/content-queue.mjs --sync`. Historical reports are evidence, not current readiness or owner approval.', '', '| ID | Concept | Version | Status | Independent QA | Owner approval |', '| --- | --- | --- | --- | --- | --- |'];
  for (const item of queue.items) lines.push(`| ${item.id} | ${item.concept} | ${item.asset_version} | ${item.status} | ${item.independent_qa.status} | ${item.owner_approval ? 'Evidence recorded; exact-version gate applies' : 'Not recorded'} |`);
  lines.push('', 'Before production: `node scripts/content-queue.mjs --production ITEM_ID`. Duplicate concepts require an explicit revision relationship; rejected asset paths and hashes are blocked.', '', 'Before handoff: `node scripts/content-queue.mjs`. Read [fictional demonstrations](FICTIONAL_DEMOS.md) and [Instagram QA](INSTAGRAM_QA.md). Metadata, decode results and sampled frames never establish full-timeline quality. Owner approval remains a separate, immediate-before-publishing action.', '');
  fs.writeFileSync(path.join(root, 'marketing/CONTENT_QUEUE.md'), lines.join('\n'));
  fs.writeFileSync(path.join(root, 'marketing/content-ready/manifest.json'), JSON.stringify({ schema_version: '3.0', derived_from: 'marketing/CONTENT_QUEUE.json', note: 'Generated view; edit the authoritative queue. Historical full creator manifest remains in archive/v2.', items: queue.items.filter(item => item.asset_version === 'v2') }, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'marketing/CONTENT_QUEUE.json'), 'utf8'));
  const errors = validateQueue(queue);
  const productionIndex = process.argv.indexOf('--production');
  if (productionIndex >= 0) errors.push(...productionErrors(queue, process.argv[productionIndex + 1]));
  for (const item of queue.items) for (const asset of item.assets || []) {
    if (!asset.sha256) continue;
    const target = path.resolve(root, asset.path);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) errors.push(`${item.id}: missing/invalid asset ${asset.path}`);
    else if (crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== asset.sha256) errors.push(`${item.id}: asset changed; increment version and repeat QA: ${asset.path}`);
  }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else if (process.argv.includes('--sync')) { renderViews(queue); console.log('Queue validated; derived views synchronized.'); }
  else console.log(`Queue valid: ${queue.items.length} records. This is a record/asset integrity check, not creative QA or publish approval.`);
}
