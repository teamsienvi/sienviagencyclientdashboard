import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, redirectUri, platform } = await req.json();
    
    const metaAppId = Deno.env.get('META_APP_ID');
    if (!metaAppId) {
      throw new Error('META_APP_ID not configured');
    }

    // Define scopes - include both Facebook and Instagram permissions for full access
    const scopes = platform === 'instagram' 
      ? 'instagram_basic,instagram_manage_insights,business_management,pages_show_list,pages_read_engagement'
      : 'pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,instagram_basic,instagram_manage_insights';

    // Build Meta OAuth URL
    const state = JSON.stringify({ clientId, platform });
    const encodedState = encodeURIComponent(btoa(state));
    
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', metaAppId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', encodedState);
    authUrl.searchParams.set('response_type', 'code');

    console.log('Generated Meta OAuth URL for platform:', platform);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-oauth-init:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
