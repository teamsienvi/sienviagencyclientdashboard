import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();
    
    if (!code) {
      throw new Error('Missing authorization code');
    }

    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!metaAppId || !metaAppSecret) {
      throw new Error('Meta app credentials not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    console.log('Exchanging code for short-lived token...');

    // Exchange code for short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', metaAppId);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('client_secret', metaAppSecret);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData.error);
      throw new Error(tokenData.error.message || 'Failed to exchange code for token');
    }

    const shortLivedToken = tokenData.access_token;
    console.log('Got short-lived token, exchanging for long-lived token...');

    // Exchange short-lived token for long-lived token
    const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', metaAppId);
    longLivedUrl.searchParams.set('client_secret', metaAppSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      console.error('Long-lived token exchange error:', longLivedData.error);
      throw new Error(longLivedData.error.message || 'Failed to get long-lived token');
    }

    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('Got long-lived token, fetching user info...');

    // Get user info
    const meResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${longLivedToken}`
    );
    const meData = await meResponse.json();

    if (meData.error) {
      throw new Error(meData.error.message || 'Failed to get user info');
    }

    const metaUserId = meData.id;
    console.log(`Connected as Meta user: ${metaUserId}`);

    // Store in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing agency connection and insert new one
    await supabase.from('meta_agency_connection').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: insertError } = await supabase
      .from('meta_agency_connection')
      .insert({
        meta_user_id: metaUserId,
        access_token: longLivedToken,
        token_expires_at: tokenExpiresAt,
        connected_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error storing agency connection:', insertError);
      throw new Error('Failed to store agency connection');
    }

    console.log('Agency Meta connection stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        metaUserId,
        tokenExpiresAt 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-agency-oauth-callback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
