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
    const { clientId, shopDomain, redirectUri } = await req.json();

    if (!clientId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: "clientId and shopDomain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which client credentials to use based on shop domain
    let shopifyClientId: string | undefined;

    if (shopDomain.includes("fhfwar-jc") || shopDomain.toLowerCase().includes("snarky") && shopDomain.toLowerCase().includes("pet")) {
      shopifyClientId = Deno.env.get("SHOPIFY_SNARKY_PETS_CLIENT_ID")?.trim().replace(/\s+/g, '');
    } else if (shopDomain.includes("bedd78-a1") || shopDomain.toLowerCase().includes("snarky") && shopDomain.toLowerCase().includes("human")) {
      shopifyClientId = Deno.env.get("SHOPIFY_SNARKY_HUMANS_CLIENT_ID")?.trim().replace(/\s+/g, '');
    } else if (shopDomain.includes("3bc448-da") || shopDomain.toLowerCase().includes("blingy")) {
      shopifyClientId = Deno.env.get("SHOPIFY_BLINGYBAG_CLIENT_ID")?.trim().replace(/\s+/g, '');
    } else if (shopDomain.includes("oxisure-tech") || shopDomain.toLowerCase().includes("oxisure")) {
      shopifyClientId = Deno.env.get("SHOPIFY_OXISURE_TECH_CLIENT_ID")?.trim().replace(/\s+/g, '');
    }

    if (!shopifyClientId) {
      return new Response(
        JSON.stringify({
          error: "Shopify API credentials not configured for this store. Please add the Client ID to secrets."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up shop domain
    const cleanShopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Shopify OAuth scopes for analytics
    const scopes = [
      "read_orders",
      "read_products",
      "read_customers",
      "read_analytics",
      "read_reports",
    ].join(",");

    // Encode state with client info + origin so callback knows where to redirect
    const state = btoa(JSON.stringify({
      clientId,
      shopDomain: cleanShopDomain,
      platform: "shopify",
      redirectOrigin: redirectUri.replace(/\/shopify\/callback$/, "")
    }));

    // Shopify OAuth authorization URL
    const authUrl = new URL(`https://${cleanShopDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", shopifyClientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    console.log("[shopify-oauth-init] Generated OAuth URL for client:", clientId, "shop:", cleanShopDomain);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[shopify-oauth-init] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
