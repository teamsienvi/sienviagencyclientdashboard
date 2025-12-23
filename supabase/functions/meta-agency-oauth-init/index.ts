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
    const { redirectUri } = await req.json();
    
    const metaAppId = Deno.env.get('META_APP_ID');
    if (!metaAppId) {
      throw new Error('META_APP_ID not configured');
    }

    // Required permissions for agency-level access to all managed pages
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_read_user_content",
      "read_insights",
      "instagram_basic",
      "instagram_manage_insights",
      "business_management",
    ].join(",");

    // State indicates this is an agency-level connection
    const state = JSON.stringify({ type: 'agency' });
    const encodedState = encodeURIComponent(btoa(state));
    
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", metaAppId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", encodedState);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("auth_type", "rerequest");

    console.log('Generated agency Meta OAuth URL');

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-agency-oauth-init:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
