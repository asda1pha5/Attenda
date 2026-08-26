const pageContent = `<main class="seo-fallback"><header><p>ATTENDAA SUPPORT</p><h1>Help with your RSVP page or invitation.</h1></header><p>Whether you are setting up your first invitation or need help with an RSVP, Attendaa support is here to help you gather.</p><p><a href="/help">Contact Attendaa support</a></p><section><h2>Before you share</h2><p>You can edit your event details whenever plans change. Save your edits and the same invitation link will show guests the updated details.</p></section><section><h2>Guests and RSVPs</h2><p>Guests do not need an Attendaa account to open an invitation or RSVP. Their RSVP details are visible only to the event host.</p></section><section><h2>How long does an event stay live?</h2><p>Published event pages stay live for 90 days after the event date. Your RSVP list remains available in the host hub during that period.</p></section></main>`;

export default async (request: Request) => {
  const url = new URL(request.url);
  const appResponse = await fetch(new URL('/index.html', url.origin));
  let html = await appResponse.text();
  const previewUrl = `${url.origin}/attendaa-envelope-preview.jpg`;
  const metadata = `<title>Attendaa Help | RSVP page support</title><meta name="description" content="Get help creating, sharing, or updating an Attendaa RSVP page. Guests can RSVP without an account, and hosts can update event details anytime." /><meta name="robots" content="noindex,follow" /><link rel="canonical" href="${url.origin}/help" /><meta property="og:type" content="website" /><meta property="og:title" content="Attendaa Help | RSVP page support" /><meta property="og:description" content="Help creating, sharing, or updating an Attendaa invitation and RSVP page." /><meta property="og:image" content="${previewUrl}" /><meta property="og:image:alt" content="An Attendaa RSVP invitation envelope" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="Attendaa Help | RSVP page support" /><meta name="twitter:description" content="Help creating, sharing, or updating an Attendaa invitation and RSVP page." /><meta name="twitter:image" content="${previewUrl}" />`;
  const rootStart = html.indexOf('<div id="root">');
  const bodyEnd = html.lastIndexOf('</body>');
  if (rootStart !== -1 && bodyEnd !== -1) html = `${html.slice(0, rootStart)}<div id="root">${pageContent}</div>\n${html.slice(bodyEnd)}`;
  html = html.replace(/<title>.*?<\/title>/, '<title>Attendaa Help | RSVP page support</title>')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:type"[^>]*>/, '')
    .replace(/\s*<meta property="og:title"[^>]*>/, '')
    .replace(/\s*<meta property="og:description"[^>]*>/, '')
    .replace(/\s*<meta property="og:image"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:title"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:description"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:image"[^>]*>/, '')
    .replace('</head>', `${metadata}\n</head>`);
  return new Response(html, appResponse);
};

export const config = { path: '/help' };
