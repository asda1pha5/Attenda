const pageContent = `<main class="seo-fallback"><header><p>ATTENDAA SIGNATURE</p><h1>Make the invitation feel as special as the day.</h1></header><p>Attendaa Signature turns one RSVP link into a more personal place to gather—before, during, and after the celebration.</p><p><strong>$19 one time for one event.</strong> No subscription and no automatic renewal.</p><p><a href="/login?mode=signup">Create a free event</a></p><section><h2>Make it feel custom.</h2><p>Choose an elevated invitation look and add audio that sets the mood from the first open.</p></section><section><h2>Keep it for your people.</h2><p>Use private access codes and remove Attendaa branding when you want the invitation to feel entirely yours.</p></section><section><h2>Keep the day close.</h2><p>Send event reminders, collect guest photos, and keep a guest book of the little moments.</p></section><section><h2>What is included?</h2><p>Signature includes elevated invitation looks, invitation audio, private access codes, automatic reminders, a guest photo album, guest book, and branding removal. You can edit your event whenever plans change. Published event pages stay live for 90 days after the event date.</p></section></main>`;

export default async (request: Request) => {
  const url = new URL(request.url);
  const appResponse = await fetch(new URL('/index.html', url.origin));
  let html = await appResponse.text();
  const previewUrl = `${url.origin}/marketing/attendaa-live-invitation-story.png`;
  const metadata = `<title>Attendaa Signature | A more personal RSVP page</title><meta name="description" content="Make your invitation feel custom, keep it private, and bring guests back after the day. Attendaa Signature is $19 one time for one event—no subscription." /><link rel="canonical" href="${url.origin}/upgrade" /><meta property="og:type" content="website" /><meta property="og:title" content="Attendaa Signature | A more personal RSVP page" /><meta property="og:description" content="A more personal invitation for one special event. $19 one time, no subscription." /><meta property="og:image" content="${previewUrl}" /><meta property="og:image:alt" content="An Attendaa RSVP invitation page" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="Attendaa Signature | A more personal RSVP page" /><meta name="twitter:description" content="A more personal invitation for one special event. $19 one time, no subscription." /><meta name="twitter:image" content="${previewUrl}" /><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Attendaa Signature","description":"A one-time upgrade for a more personal RSVP page, including elevated invitation looks, audio, private access, reminders, photo album, guest book, and branding removal.","brand":{"@type":"Brand","name":"Attendaa"},"offers":{"@type":"Offer","price":"19.00","priceCurrency":"USD","availability":"https://schema.org/InStock","url":"${url.origin}/upgrade"}}</script>`;
  const rootStart = html.indexOf('<div id="root">');
  const bodyEnd = html.lastIndexOf('</body>');
  if (rootStart !== -1 && bodyEnd !== -1) html = `${html.slice(0, rootStart)}<div id="root">${pageContent}</div>\n${html.slice(bodyEnd)}`;
  html = html.replace(/<title>.*?<\/title>/, '<title>Attendaa Signature | A more personal RSVP page</title>')
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

export const config = { path: '/upgrade' };
