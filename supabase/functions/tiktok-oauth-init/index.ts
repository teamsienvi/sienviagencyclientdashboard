import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, redirectUri } = await req.json();

    const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");

    if (!TIKTOK_CLIENT_KEY) {
      return new Response(
        JSON.stringify({ 
          error: "TikTok API credentials not configured. Please add TIKTOK_CLIENT_KEY to your secrets." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TikTok OAuth scopes for business accounts
    const scopes = [
      "user.info.basic",
      "user.info.profile",
      "user.info.stats",
      "video.list",
      "video.insights",
    ].join(",");

    // Encode state with client info
    const state = btoa(JSON.stringify({ clientId, platform: "tiktok" }));

    // TikTok OAuth authorization URL
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    console.log("Generated TikTok OAuth URL for client:", clientId);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in tiktok-oauth-init:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
