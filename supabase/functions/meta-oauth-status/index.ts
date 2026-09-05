import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  const appOrigin = Deno.env.get('APP_URL')?.replace(/\/$/, '');
  return {
    ...(origin && origin === appOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'GET') return json(request, { error: 'Method not allowed' }, 405);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!user) return json(request, { error: 'Sign in as an Attendaa admin first.' }, 401);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return json(request, { error: 'Only Attendaa admins can view this connection.' }, 403);
    const { data: connection, error } = await admin
      .from('meta_instagram_connections')
      .select('instagram_username, facebook_page_name, token_expires_at, connected_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return json(request, { connected: Boolean(connection), connection: connection || null });
  } catch (error) {
    console.error(error);
    return json(request, { error: 'Unable to read the Instagram connection.' }, 500);
  }
});
