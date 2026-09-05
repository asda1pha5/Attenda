import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const redirect = (url: string) => new Response(null, { status: 303, headers: { Location: url } });

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function toBase64(value: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

async function encrypt(value: string) {
  const keyBytes = fromBase64(required('META_TOKEN_ENCRYPTION_KEY'));
  if (keyBytes.byteLength !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
  return { cipher: toBase64(cipher), iv: toBase64(iv.buffer) };
}

function finishUrl(status: 'connected' | 'error') {
  const appUrl = required('APP_URL').replace(/\/$/, '');
  return `${appUrl}/admin?meta=${status}`;
}

Deno.serve(async (request) => {
  let stage = 'request_validation';
  let admin: ReturnType<typeof createClient> | null = null;
  let attemptId: string | null = null;
  const errorUrl = (reason?: string) => redirect(`${finishUrl('error')}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  try {
    const incoming = new URL(request.url);
    const code = incoming.searchParams.get('code');
    const state = incoming.searchParams.get('state');
    if (!code || !state || incoming.searchParams.has('error')) return errorUrl();

    stage = 'state_lookup';
    admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const stateHash = await sha256(state);
    const { data: attempt, error: attemptError } = await admin
      .from('meta_oauth_attempts')
      .select('id, initiated_by, expires_at, consumed_at')
      .eq('state_hash', stateHash)
      .maybeSingle();
    if (attemptError || !attempt || attempt.consumed_at || new Date(attempt.expires_at) < new Date()) return errorUrl();
    attemptId = attempt.id;

    stage = 'state_consume';
    const { data: consumed } = await admin
      .from('meta_oauth_attempts')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();
    if (!consumed) return errorUrl();

    const version = Deno.env.get('META_GRAPH_API_VERSION') || 'v23.0';
    const redirectUri = required('META_OAUTH_REDIRECT_URI');
    const shortTokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    shortTokenUrl.search = new URLSearchParams({
      client_id: required('META_APP_ID'),
      client_secret: required('META_APP_SECRET'),
      redirect_uri: redirectUri,
      code,
    }).toString();
    stage = 'authorization_code_exchange';
    const shortTokenResponse = await fetch(shortTokenUrl);
    if (!shortTokenResponse.ok) throw new Error('Meta rejected the authorization code.');
    const shortToken = (await shortTokenResponse.json()).access_token as string | undefined;
    if (!shortToken) throw new Error('Meta did not return an access token.');

    const longTokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    longTokenUrl.search = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: required('META_APP_ID'),
      client_secret: required('META_APP_SECRET'),
      fb_exchange_token: shortToken,
    }).toString();
    stage = 'long_lived_token_exchange';
    const longTokenResponse = await fetch(longTokenUrl);
    if (!longTokenResponse.ok) throw new Error('Meta could not extend the access token.');
    const longTokenResult = await longTokenResponse.json();
    const userToken = longTokenResult.access_token as string | undefined;
    if (!userToken) throw new Error('Meta did not return a long-lived token.');

    const accountsUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
    accountsUrl.search = new URLSearchParams({
      access_token: userToken,
      fields: 'id,name,access_token,instagram_business_account{id,username}',
    }).toString();
    stage = 'page_account_lookup';
    const accountsResponse = await fetch(accountsUrl);
    if (!accountsResponse.ok) throw new Error('Meta could not read the Facebook Page connection.');
    const accounts = (await accountsResponse.json()).data as Array<Record<string, unknown>> | undefined;
    const expectedPageId = Deno.env.get('META_FACEBOOK_PAGE_ID');
    const expectedUsername = Deno.env.get('META_INSTAGRAM_USERNAME')?.replace(/^@/, '').toLowerCase();
    const page = accounts?.find((item) => {
      const instagram = item.instagram_business_account as Record<string, unknown> | undefined;
      return (!expectedPageId || item.id === expectedPageId)
        && (!expectedUsername || String(instagram?.username || '').toLowerCase() === expectedUsername);
    });
    const instagram = page?.instagram_business_account as Record<string, unknown> | undefined;
    const pageToken = page?.access_token as string | undefined;
    stage = 'expected_account_match';
    if (!page || !instagram?.id || !pageToken) throw new Error('The authorized Facebook Page is not linked to the expected Instagram business account.');

    stage = 'token_encryption';
    const encrypted = await encrypt(pageToken);
    const expiresIn = Number(longTokenResult.expires_in || 0);
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    stage = 'connection_storage';
    const { error: upsertError } = await admin.from('meta_instagram_connections').upsert({
      instagram_account_id: String(instagram.id),
      instagram_username: instagram.username ? String(instagram.username) : null,
      facebook_page_id: String(page.id),
      facebook_page_name: page.name ? String(page.name) : null,
      encrypted_page_access_token: encrypted.cipher,
      token_iv: encrypted.iv,
      token_expires_at: tokenExpiresAt,
      connected_by: attempt.initiated_by,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'instagram_account_id' });
    if (upsertError) throw upsertError;

    return redirect(finishUrl('connected'));
  } catch (error) {
    console.error(`[meta-oauth-callback] ${stage}: ${error instanceof Error ? error.message : String(error)}`);
    if (admin && attemptId) {
      const { error: diagnosticError } = await admin
        .from('meta_oauth_attempts')
        .update({ failure_stage: stage, failed_at: new Date().toISOString() })
        .eq('id', attemptId);
      if (diagnosticError) console.error(`[meta-oauth-callback] diagnostic_storage: ${diagnosticError.message}`);
    }
    return errorUrl(stage);
  }
});
