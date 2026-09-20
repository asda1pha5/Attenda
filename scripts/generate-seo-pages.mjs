import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { babyShowerWording } from '../src/lib/babyShowerWording.js';
import { babyShowerRsvpReminders } from '../src/lib/babyShowerRsvpReminders.js';

const siteUrl = 'https://attendaa.com';

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function paragraphs(value) {
  return value.split('\n\n').map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`).join('');
}

function wordingContent() {
  const examples = [['warm', 'Warm'], ['simple', 'Simple'], ['playful', 'Playful']]
    .map(([tone, label]) => `<section><h2>${label} baby shower invitation wording</h2>${paragraphs(babyShowerWording(tone))}</section>`)
    .join('');
  return `<main class="seo-fallback"><header><p>A LITTLE HELP WITH THE FIRST WORDS</p><h1>Baby shower invitation wording</h1></header><p>Choose a warm, simple, or playful starting point, then replace the bracketed details. Registry wording is optional.</p>${examples}<section><h2>Details to include</h2><p>Add the day, date, time, venue, address, RSVP date, and an optional registry link.</p><p><a href="/baby-shower-rsvp">Read the baby shower RSVP guide</a> or use these <a href="/baby-shower-rsvp-reminder">kind RSVP reminder examples</a>.</p></section><p><a href="/create">Create your invitation</a></p></main>`;
}

function reminderContent() {
  const examples = babyShowerRsvpReminders.map((reminder) => `<section id="${escapeHtml(reminder.id)}"><h2>${escapeHtml(reminder.label)}</h2><h3>${escapeHtml(reminder.title)}</h3><p>${escapeHtml(reminder.note)}</p><p>${escapeHtml(reminder.message)}</p></section>`).join('');
  return `<main class="seo-fallback"><header><p>BABY SHOWER PLANNING WORDS</p><h1>Kind baby shower RSVP reminder wording</h1></header><p>Waiting on a reply can feel awkward. These ready-to-edit messages help you ask clearly while leaving room for real life.</p><section><h2>Five common RSVP moments</h2><p>Replace the bracketed details and read the message once in your own voice. A short personal opening can make even a practical deadline feel warm.</p></section>${examples}<section><h2>Clear can still feel considerate</h2><p>Ask for one action by one date, and name a firm cutoff only when your venue, caterer, or plans truly require it.</p><p><a href="/baby-shower-wording">Write the invitation wording</a> or read the <a href="/baby-shower-rsvp">baby shower RSVP guide</a>.</p></section><p><a href="/create">Create your free invitation</a></p></main>`;
}

export const pages = [
  {
    path: '/baby-shower-wording',
    title: 'Free Baby Shower Invitation Wording | Attendaa',
    description: 'Create warm, simple, or playful baby shower invitation wording with editable placeholders for the date, RSVP, and optional registry.',
    image: '/baby-shower-social-preview.png',
    content: wordingContent(),
  },
  {
    path: '/baby-shower-rsvp-reminder',
    title: 'Baby Shower RSVP Reminder Wording | Attendaa',
    description: 'Copy kind baby shower RSVP reminder messages for before, on, or after the reply date, plus maybe guests and final headcounts.',
    image: '/baby-shower-social-preview.png',
    content: reminderContent(),
  },
];

function removeTag(html, pattern) {
  return html.replace(pattern, '');
}

export function renderSeoPage(template, page) {
  const canonical = `${siteUrl}${page.path}`;
  const image = `${siteUrl}${page.image}`;
  const metadata = `<title>${page.title}</title>\n  <meta name="description" content="${page.description}" />\n  <meta name="robots" content="index,follow" />\n  <link rel="canonical" href="${canonical}" />\n  <meta property="og:type" content="website" />\n  <meta property="og:site_name" content="Attendaa" />\n  <meta property="og:title" content="${page.title}" />\n  <meta property="og:description" content="${page.description}" />\n  <meta property="og:url" content="${canonical}" />\n  <meta property="og:image" content="${image}" />\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:title" content="${page.title}" />\n  <meta name="twitter:description" content="${page.description}" />\n  <meta name="twitter:image" content="${image}" />`;
  const rootPattern = /<div id="root">[\s\S]*?<\/div>\s*<\/body>/;
  let html = template.replace(rootPattern, `<div id="root">${page.content}</div>\n</body>`);
  html = removeTag(html, /\s*<title>[\s\S]*?<\/title>/i);
  html = removeTag(html, /\s*<meta name="description"[^>]*>/i);
  html = removeTag(html, /\s*<meta name="robots"[^>]*>/i);
  html = removeTag(html, /\s*<link rel="canonical"[^>]*>/i);
  html = removeTag(html, /\s*<meta property="og:(?:type|site_name|title|description|url|image)"[^>]*>/gi);
  html = removeTag(html, /\s*<meta name="twitter:(?:card|title|description|image)"[^>]*>/gi);
  return html.replace('</head>', `  ${metadata}\n</head>`);
}

export async function generateSeoPages(outputRoot) {
  const template = await readFile(path.join(outputRoot, 'index.html'), 'utf8');
  await Promise.all(pages.map(async (page) => {
    const html = renderSeoPage(template, page);
    await writeFile(path.join(outputRoot, `${page.path.slice(1)}.html`), html);
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateSeoPages(path.resolve('dist'));
  console.log(`Generated ${pages.length} crawlable marketing page${pages.length === 1 ? '' : 's'}.`);
}
