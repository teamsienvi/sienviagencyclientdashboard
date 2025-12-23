import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, state, redirectUri } = await req.json();

    const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "TikTok API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Decode state to get client info
    let clientId: string;
    try {
      const decodedState = JSON.parse(atob(state));
      clientId = decodedState.clientId;
    } catch (e) {
      throw new Error("Invalid state parameter");
    }

    console.log("Processing TikTok OAuth callback for client:", clientId);

    // Exchange code for access token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("TikTok token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("TikTok token response received");

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 86400; // Default 24 hours
    const openId = tokenData.open_id;

    // Fetch user info
    const userResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    let username = openId;
    let displayName = "TikTok User";

    if (userResponse.ok) {
      const userData = await userResponse.json();
      if (userData.data?.user) {
        username = userData.data.user.username || userData.data.user.display_name || openId;
        displayName = userData.data.user.display_name || username;
      }
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store in social_accounts table
    const { error: accountError } = await supabase
      .from("social_accounts")
      .upsert({
        client_id: clientId,
        platform: "tiktok",
        account_id: openId,
        account_name: displayName,
        access_token_encrypted: accessToken,
        refresh_token_encrypted: refreshToken,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { 
        onConflict: 'client_id,platform,account_id',
        ignoreDuplicates: false 
      });

    if (accountError) {
      console.error("Error storing TikTok account:", accountError);
      throw new Error(`Failed to store account: ${accountError.message}`);
    }

    console.log("TikTok account connected successfully for client:", clientId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "TikTok account connected successfully",
        account: {
          username,
          displayName,
          openId,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in tiktok-oauth-callback:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
