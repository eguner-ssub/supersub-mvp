import { supabase } from '../../supabaseClient';

const SESSION_KEY = 'ss_funnel_session';

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Fire-and-forget funnel analytics event.
 * Safe to call pre-auth (user_id = null) and post-auth.
 * Never awaited — never blocks user-facing flows.
 *
 * @param {string} event     - e.g. 'signup_page_viewed'
 * @param {object} properties - optional key/value metadata
 * @param {string|null} userId - pass session user.id when available
 */
export function trackFunnelEvent(event, properties = {}, userId = null) {
  void supabase.from('analytics_events').insert({
    session_id: getSessionId(),
    user_id: userId ?? null,
    event,
    properties,
  });
}
