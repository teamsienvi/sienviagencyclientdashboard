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

    const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");

    if (!LINKEDIN_CLIENT_ID) {
      return new Response(
        JSON.stringify({ 
          error: "LinkedIn API credentials not configured. Please add LINKEDIN_CLIENT_ID to your secrets." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LinkedIn OAuth scopes for organization/company pages
    const scopes = [
      "openid",
      "profile",
      "email",
      "w_member_social",
      "r_organization_social",
      "rw_organization_admin",
      "r_organization_followers",
    ].join(" ");

    // Encode state with client info
    const state = btoa(JSON.stringify({ clientId, platform: "linkedin" }));

    // LinkedIn OAuth authorization URL
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    console.log("Generated LinkedIn OAuth URL for client:", clientId);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in linkedin-oauth-init:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
