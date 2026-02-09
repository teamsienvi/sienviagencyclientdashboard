import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    const shortLivedToken = Deno.env.get('META_ACCESS_TOKEN');

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_APP_ID or META_APP_SECRET not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!shortLivedToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_ACCESS_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange for long-lived token
    const url = `https://graph.facebook.com/v20.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortLivedToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ success: false, error: data.error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresInDays = data.expires_in ? Math.round(data.expires_in / 86400) : 'unknown';

    return new Response(
      JSON.stringify({
        success: true,
        long_lived_token: data.access_token,
        expires_in_seconds: data.expires_in,
        expires_in_days: expiresInDays,
        token_type: data.token_type,
        message: `Token exchanged successfully. Expires in ~${expiresInDays} days.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
