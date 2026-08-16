const previewPath = '/attendaa-envelope-preview.jpg';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] as string));
}

function eventMeta(previewUrl: string) {
  const safeTitle = escapeHtml('You\'re invited with Attendaa');
  const description = 'A thoughtful invitation is waiting for you.';
  return `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${previewUrl}" />
    <meta property="og:image:secure_url" content="${previewUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="An Attendaa invitation envelope with a checkmark seal" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${previewUrl}" />`;
}

export default async (request: Request) => {
  const url = new URL(request.url);
  const appResponse = await fetch(new URL('/index.html', url.origin));
  let html = await appResponse.text();

  html = html
    .replace(/\s*<meta property="og:title"[^>]*>/, '')
    .replace(/\s*<meta property="og:description"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>/, '');
  html = html.replace('</head>', `${eventMeta(`${url.origin}${previewPath}`)}\n</head>`);

  return new Response(html, appResponse);
};

export const config = { path: '/e/*' };
