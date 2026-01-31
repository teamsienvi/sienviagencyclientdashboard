import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    let code: string | null = null;
    let state: string | null = null;
    let shop: string | null = null;

    // Shopify will redirect with GET query params, but the app can also POST via functions.invoke.
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      code = typeof body.code === "string" ? body.code : null;
      state = typeof body.state === "string" ? body.state : null;
      shop = typeof body.shop === "string" ? body.shop : null;
    } else {
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
      shop = url.searchParams.get("shop");
    }

    console.log("[shopify-oauth-callback] Received callback - shop:", shop, "state:", state);

    if (!code || !state || !shop) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: code, state, or shop" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode state
    let stateData: { clientId: string; shopDomain: string; platform: string; redirectOrigin?: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, shopDomain, redirectOrigin } = stateData;
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
    } else if (shop.includes("3bc448-da")) {
      shopifyClientId = Deno.env.get("SHOPIFY_BLINGYBAG_CLIENT_ID");
      shopifyClientSecret = Deno.env.get("SHOPIFY_BLINGYBAG_SECRET");
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

    // If Shopify hit us directly (GET), redirect back to the app.
    if (req.method !== "POST") {
      // Use the origin from state (saved during init) to redirect to the correct domain
      const baseUrl = redirectOrigin || Deno.env.get("SITE_URL") || "https://sienviagencyclientdashboard.lovable.app";
      const redirectUrl = `${baseUrl}/shopify/callback?success=true&clientId=${clientId}`;

      console.log("[shopify-oauth-callback] Redirecting to:", redirectUrl);

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": redirectUrl,
        },
      });
    }

    // If the app called us (POST), return JSON so the UI can render immediately.
    return new Response(JSON.stringify({ success: true, clientId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[shopify-oauth-callback] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
