import { useEffect } from 'react';

const siteUrl = 'https://attendaa.com';
const defaultMetadata = {
  title: 'Attendaa | RSVP pages for family milestones',
  description: 'Create a beautiful RSVP page for baby showers, birthdays, graduations, reunions, and the family milestones worth gathering for.',
  path: '/',
  robots: 'noindex,follow',
};

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function setCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function applyMetadata({ title, description, path, image = '/attendaa-envelope-preview.jpg', robots = 'index,follow' }) {
  const canonical = `${siteUrl}${path === '/' ? '/' : path}`;
  const imageUrl = `${siteUrl}${image}`;
  document.title = title;
  setCanonical(canonical);
  setMeta('meta[name="description"]', { name: 'description', content: description });
  setMeta('meta[name="robots"]', { name: 'robots', content: robots });
  setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Attendaa' });
  setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  setMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
  setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
}

export function useSeoMetadata(metadata) {
  useEffect(() => {
    applyMetadata(metadata);
    return () => applyMetadata(defaultMetadata);
  }, [metadata.title, metadata.description, metadata.path, metadata.image, metadata.robots]);
}
