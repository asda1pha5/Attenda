import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  const appOrigin = Deno.env.get('APP_URL')?.replace(/\/$/, '');
  return {
    ...(origin && origin === appOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
});

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function base64Url(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requireAdmin(request: Request, admin: ReturnType<typeof createClient>) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw json(request, { error: 'Sign in as an Attendaa admin first.' }, 401);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw json(request, { error: 'Your session has expired.' }, 401);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') throw json(request, { error: 'Only Attendaa admins can connect Instagram.' }, 403);
  return user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
    const user = await requireAdmin(request, admin);
    const appId = required('META_APP_ID');
    const redirectUri = required('META_OAUTH_REDIRECT_URI');

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = base64Url(stateBytes);
    const { error } = await admin.from('meta_oauth_attempts').insert({
      state_hash: await sha256(state),
      initiated_by: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    const authorizeUrl = new URL(`https://www.facebook.com/${Deno.env.get('META_GRAPH_API_VERSION') || 'v23.0'}/dialog/oauth`);
    authorizeUrl.searchParams.set('client_id', appId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('scope', 'instagram_basic,instagram_content_publishing,pages_read_engagement,business_management,pages_show_list');
    const configId = Deno.env.get('META_BUSINESS_LOGIN_CONFIG_ID');
    if (configId) authorizeUrl.searchParams.set('config_id', configId);

    return json(request, { authorizeUrl: authorizeUrl.toString() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json(request, { error: 'Unable to start the Instagram connection.' }, 500);
  }
});
