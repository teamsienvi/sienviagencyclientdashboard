import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const shop = url.searchParams.get("shop");

    console.log("[shopify-oauth-callback] Received callback - shop:", shop, "state:", state);

    if (!code || !state || !shop) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: code, state, or shop" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode state
    let stateData: { clientId: string; shopDomain: string; platform: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, shopDomain } = stateData;
    console.log("[shopify-oauth-callback] State decoded - clientId:", clientId, "shopDomain:", shopDomain);

    // Get credentials based on shop domain
    let shopifyClientId: string | undefined;
    let shopifyClientSecret: string | undefined;

    if (shop.includes("fhfwar-jc")) {
      shopifyClientId = Deno.env.get("SHOPIFY_SNARKY_PETS_CLIENT_ID");
      shopifyClientSecret = Deno.env.get("SHOPIFY_SNARKY_PETS_SECRET");
    } else if (shop.includes("bedd78-a1")) {
      shopifyClientId = Deno.env.get("SHOPIFY_SNARKY_HUMANS_CLIENT_ID");
      shopifyClientSecret = Deno.env.get("SHOPIFY_SNARKY_HUMANS_SECRET");
    }

    if (!shopifyClientId || !shopifyClientSecret) {
      return new Response(
        JSON.stringify({ error: "Shopify credentials not configured for this store" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    console.log("[shopify-oauth-callback] Exchanging code for token at:", tokenUrl);

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: shopifyClientId,
        client_secret: shopifyClientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[shopify-oauth-callback] Token exchange failed:", tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Token exchange failed: ${errorText}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    console.log("[shopify-oauth-callback] Token received with scope:", scope);

    // Store the connection in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: upsertError } = await supabase
      .from("shopify_oauth_connections")
      .upsert({
        client_id: clientId,
        shop_domain: shop,
        access_token: accessToken,
        scope: scope,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: "client_id" });

    if (upsertError) {
      console.error("[shopify-oauth-callback] Database error:", upsertError);
      return new Response(
        JSON.stringify({ error: `Database error: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[shopify-oauth-callback] Connection saved for client:", clientId);

    // Redirect back to the app
    const redirectUrl = `${Deno.env.get("SITE_URL") || "https://sienviagencyclientdashboard.lovable.app"}/shopify/callback?success=true&clientId=${clientId}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrl,
      },
    });
  } catch (error) {
    console.error("[shopify-oauth-callback] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
