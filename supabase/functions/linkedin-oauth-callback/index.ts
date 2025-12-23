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

    const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");
    const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "LinkedIn API credentials not configured" }),
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

    console.log("Processing LinkedIn OAuth callback for client:", clientId);

    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("LinkedIn token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("LinkedIn token response received");

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 5184000; // Default 60 days

    // Fetch user profile
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let linkedinId = "unknown";
    let displayName = "LinkedIn User";

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      linkedinId = profileData.sub || profileData.id || "unknown";
      displayName = profileData.name || `${profileData.given_name || ""} ${profileData.family_name || ""}`.trim() || "LinkedIn User";
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store in social_accounts table
    const { error: accountError } = await supabase
      .from("social_accounts")
      .upsert({
        client_id: clientId,
        platform: "linkedin",
        account_id: linkedinId,
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
      console.error("Error storing LinkedIn account:", accountError);
      throw new Error(`Failed to store account: ${accountError.message}`);
    }

    console.log("LinkedIn account connected successfully for client:", clientId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "LinkedIn account connected successfully",
        account: {
          linkedinId,
          displayName,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in linkedin-oauth-callback:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
