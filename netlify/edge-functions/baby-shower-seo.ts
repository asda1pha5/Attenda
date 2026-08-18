const pageContent = `<main class="seo-fallback"><header><p>ATTENDAA · BABY SHOWER RSVP WEBSITE</p><h1>A beautiful way to gather before baby arrives.</h1></header><p>Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the very first open.</p><p><a href="/login?mode=signup&amp;next=%2Fhub%2Fnew%3Fstyle%3Dgarden-welcome">Create your free baby shower RSVP</a></p><section><h2>Choose an invitation style, then make it yours.</h2><ul><li><strong>Garden Welcome:</strong> soft florals for a sweet, intimate shower.</li><li><strong>Little Sunshine:</strong> warm, cheerful, and easy to make your own.</li><li><strong>Storybook Baby:</strong> gentle blush tones for a sentimental gathering.</li><li><strong>Modern Nest:</strong> warm neutral details with a refined, minimal feel.</li></ul></section><section><h2>Everything your guests need, in one place.</h2><p>Share the date, location, registry, and RSVP in one invitation. Guests do not need an Attendaa account to respond.</p></section><section><h2>Attendaa Signature</h2><p>For $19 one-time, upgrade one event with invitation audio, private access codes, reminders, a guest photo album, elevated invitation looks, and branding removal.</p><p><a href="/upgrade">Explore Attendaa Signature</a></p></section></main>`;

export default async (request: Request) => {
  const url = new URL(request.url);
  const appResponse = await fetch(new URL('/index.html', url.origin));
  let html = await appResponse.text();
  const metadata = `<title>Baby Shower RSVP Website | Attendaa</title><meta name="description" content="Create a beautiful baby shower RSVP website. Share every detail, collect responses, add your registry, and keep the celebration together." /><link rel="canonical" href="${url.origin}/baby-shower-rsvp" /><meta property="og:title" content="Baby Shower RSVP Website | Attendaa" /><meta property="og:description" content="Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the first open." />`;
  const rootStart = html.indexOf('<div id="root">');
  const scriptStart = html.indexOf('<script type="module"', rootStart);
  if (rootStart !== -1 && scriptStart !== -1) html = `${html.slice(0, rootStart)}<div id="root">${pageContent}</div>\n  ${html.slice(scriptStart)}`;
  html = html.replace(/<title>.*?<\/title>/, '<title>Baby Shower RSVP Website | Attendaa</title>')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace('</head>', `${metadata}\n</head>`);
  return new Response(html, appResponse);
};

export const config = { path: '/baby-shower-rsvp' };
