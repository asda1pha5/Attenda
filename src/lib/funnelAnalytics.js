import { supabase } from './supabaseClient';

const visitorKey = 'attenda-funnel-visitor-id';
const attributionKey = 'attenda-funnel-attribution';

function visitorId() {
  let id = localStorage.getItem(visitorKey);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(visitorKey, id);
  }
  return id;
}

function attribution() {
  const params = new URLSearchParams(window.location.search);
  let referrerHost = null;
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : null; } catch { /* Ignore malformed referrers. */ }
  const current = {
    referrer_host: referrerHost,
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  };
  const hasCampaignData = Object.values(current).some(Boolean);
  if (hasCampaignData) sessionStorage.setItem(attributionKey, JSON.stringify(current));
  try { return hasCampaignData ? current : JSON.parse(sessionStorage.getItem(attributionKey) || '{}'); } catch { return current; }
}

// This records product behavior, not names, emails, or RSVP content.
export async function trackFunnelEvent(eventName, properties = {}, userId = null) {
  try {
    await supabase.from('funnel_events').insert({
      event_name: eventName,
      visitor_id: visitorId(),
      user_id: userId,
      path: window.location.pathname,
      properties,
      ...attribution(),
    });
  } catch {
    // Analytics must never interrupt a signup, RSVP, or checkout.
  }
}
