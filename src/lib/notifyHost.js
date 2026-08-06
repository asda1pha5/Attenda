import { supabase } from './supabaseClient';

// Notifications are deliberately non-blocking: an RSVP or guest-book post
// still succeeds if the host's email provider is temporarily unavailable.
export function notifyHost(payload) {
  return supabase.functions.invoke('notify-host', { body: payload })
    .catch((error) => console.warn('Host notification was not sent:', error));
}
