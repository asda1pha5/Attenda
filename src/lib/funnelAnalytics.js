import { supabase } from './supabaseClient';
import { captureAttribution, analyticsPath, safeProperties } from './attribution';

const visitorKey = 'attenda-funnel-visitor-id';
let memoryVisitor;
let memoryAttribution = {};

function visitorId() {
  let id;
  try { id = localStorage.getItem(visitorKey); } catch {}
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) id = null;
  if (!id) {
    id = memoryVisitor || crypto.randomUUID();
    try { localStorage.setItem(visitorKey, id); } catch {}
  }
  memoryVisitor = id;
  return id;
}

function attribution() {
  let storage;
  try { storage = localStorage; } catch {}
  const current = captureAttribution(window.location.search, storage);
  if (Object.keys(current).length) memoryAttribution = current;
  return memoryAttribution;
}

export function getCheckoutAttribution() {
  return { attribution: Object.fromEntries(Object.entries(attribution()).map(([key, value]) => [`utm_${key}`, value])), visitor_id: visitorId() };
}

// This records product behavior, not names, emails, or RSVP content.
export async function trackFunnelEvent(eventName, properties = {}, userId = null) {
  try {
    await supabase.from('funnel_events').insert({
      event_name: eventName,
      visitor_id: visitorId(),
      user_id: userId,
      path: analyticsPath(window.location.pathname),
      properties: safeProperties(properties),
      ...attribution(),
    });
  } catch {
    // Analytics must never interrupt a signup, RSVP, or checkout.
  }
}
