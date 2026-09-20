import test from 'node:test';
import assert from 'node:assert/strict';
import { pages, renderSeoPage, generateSeoPages } from '../scripts/generate-seo-pages.mjs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { babyShowerWording } from '../src/lib/babyShowerWording.js';
import { babyShowerRsvpReminders } from '../src/lib/babyShowerRsvpReminders.js';

const template = `<!doctype html><html><head><title>Home</title><meta name="description" content="home"><link rel="canonical" href="https://attendaa.com/"><meta property="og:title" content="Home"><meta property="og:description" content="home"><meta name="twitter:card" content="summary"><script type="module" src="/assets/app.js"></script></head><body><div id="root"><main><h1>Home</h1></main></div></body></html>`;

test('generated SEO pages have one query-free canonical and crawlable content', () => {
  for (const page of pages) {
    const html = renderSeoPage(template, page);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.match(html, new RegExp(`href="https://attendaa\\.com${page.path}"`));
    assert.doesNotMatch(html, /rel="canonical"[^>]*[?#]/);
    assert.match(html, /<meta name="robots" content="index,follow" \/>/);
    assert.match(html, /<h1>[^<]+<\/h1>/);
    assert.match(html, /href="\/create"/);
    assert.doesNotMatch(html, /utm_/i);
    assert.equal((html.match(/<title>/g) || []).length, 1);
  }
});

test('generated resource copy comes from the shared UI data modules', () => {
  const wording = pages.find((page) => page.path === '/baby-shower-wording').content;
  for (const tone of ['warm', 'simple', 'playful']) {
    assert.ok(babyShowerWording(tone).split('\n\n').every((paragraph) => wording.includes(paragraph.split('\n')[0].replaceAll("'", '&#39;'))));
  }
  const reminder = pages.find((page) => page.path === '/baby-shower-rsvp-reminder').content;
  for (const example of babyShowerRsvpReminders) {
    assert.match(reminder, new RegExp(example.id));
    assert.ok(reminder.includes(example.label));
  }
});

test('clean Netlify resource routes point to generated files before the SPA fallback', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'attendaa-seo-'));
  try {
    await writeFile(path.join(temporaryRoot, 'index.html'), template);
    await generateSeoPages(temporaryRoot);
    const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
    for (const page of pages) {
      const rule = `from = "${page.path}"`;
      const position = config.indexOf(rule);
      assert.ok(position >= 0 && position < config.indexOf('from = "/*"'));
      assert.ok(config.slice(position).split('[[redirects]]')[0].includes(`to = "${page.path}.html"`));
      const html = await readFile(path.join(temporaryRoot, `${page.path.slice(1)}.html`), 'utf8');
      assert.ok(html.includes(`href="https://attendaa.com${page.path}"`));
      assert.match(html, /<h1>/);
    }
  } finally {
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
