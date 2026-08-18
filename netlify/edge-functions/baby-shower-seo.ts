const pageContent = `<main class="seo-fallback"><header><p>ATTENDAA · BABY SHOWER RSVP WEBSITE</p><h1>A beautiful way to gather before baby arrives.</h1></header><p>Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the very first open.</p><p><a href="/login?mode=signup&amp;next=%2Fhub%2Fnew%3Fstyle%3Dgarden-welcome">Create your free baby shower RSVP</a></p><section><h2>Choose an invitation style, then make it yours.</h2><ul><li><strong>Garden Welcome:</strong> soft florals for a sweet, intimate shower.</li><li><strong>Little Sunshine:</strong> warm, cheerful, and easy to make your own.</li><li><strong>Storybook Baby:</strong> gentle blush tones for a sentimental gathering.</li><li><strong>Modern Nest:</strong> warm neutral details with a refined, minimal feel.</li></ul></section><section><h2>Everything your guests need, in one place.</h2><p>Share the date, location, registry, and RSVP in one invitation. Guests do not need an Attendaa account to respond. Published RSVP pages stay live for 90 days after the event date.</p></section><section><h2>Attendaa Signature</h2><p>For $19 one-time, upgrade one event with invitation audio, private access codes, reminders, a guest photo album, elevated invitation looks, and branding removal.</p><p><a href="/upgrade">Explore Attendaa Signature</a></p></section></main>`;

export default async (request: Request) => {
  const url = new URL(request.url);
  const appResponse = await fetch(new URL('/index.html', url.origin));
  let html = await appResponse.text();
  const metadata = `<title>Baby Shower RSVP Website | Attendaa</title><meta name="description" content="Create a beautiful baby shower RSVP website. Share every detail, collect responses, add your registry, and keep the celebration together." /><link rel="canonical" href="${url.origin}/baby-shower-rsvp" /><meta property="og:title" content="Baby Shower RSVP Website | Attendaa" /><meta property="og:description" content="Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the first open." />`;
  const rootStart = html.indexOf('<div id="root">');
  const socialPreviewUrl = `${url.origin}/baby-shower-social-preview.png`;
  const socialMetadata = `<meta property="og:image" content="${socialPreviewUrl}" /><meta property="og:image:alt" content="Botanical baby shower invitation with a sage envelope" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="Baby Shower RSVP Website | Attendaa" /><meta name="twitter:description" content="Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the first open." /><meta name="twitter:image" content="${socialPreviewUrl}" /><meta name="twitter:image:alt" content="Botanical baby shower invitation with a sage envelope" />`;
  const bodyEnd = html.lastIndexOf('</body>');
  if (rootStart !== -1 && bodyEnd !== -1) html = `${html.slice(0, rootStart)}<div id="root">${pageContent.replace('A beautiful way to gather before baby arrives.', 'The RSVP page for your baby shower.')}</div>\n${html.slice(bodyEnd)}`;
  html = html.replace(/<title>.*?<\/title>/, '<title>Baby Shower RSVP Website | Attendaa</title>')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:title"[^>]*>/, '')
    .replace(/\s*<meta property="og:description"[^>]*>/, '')
    .replace(/\s*<meta property="og:image"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:title"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:description"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:image"[^>]*>/, '')
    .replace('</head>', `${metadata}${socialMetadata}\n</head>`);
  return new Response(html, appResponse);
};

export const config = { path: '/baby-shower-rsvp' };
