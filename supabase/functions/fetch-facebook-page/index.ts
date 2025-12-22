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
    const { accessToken, pageId } = await req.json();

    if (!accessToken || !pageId) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken or pageId" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Facebook page for ID: ${pageId}`);

    // Prefer a Page access token (user tokens can cause "impersonating a user's page" errors)
    let tokenToUse = accessToken;
    try {
      const accountsResp = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${accessToken}`,
      );
      if (accountsResp.ok) {
        const accountsJson = await accountsResp.json();
        const match = (accountsJson.data || []).find((p: any) => p.id === pageId);
        if (match?.access_token) {
          tokenToUse = match.access_token;
        }
      }
    } catch (e) {
      console.log("Could not resolve Page access token (continuing):", e);
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=name,id,followers_count,fan_count,picture.width(200).height(200)&access_token=${tokenToUse}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Facebook API error:", errorText);

      // Common Meta error when Pages permissions were not granted
      try {
        const parsed = JSON.parse(errorText);
        const code = parsed?.error?.code;
        const message: string = parsed?.error?.message || "";

        if (code === 190 && message.toLowerCase().includes("permission")) {
          return new Response(
            JSON.stringify({
              success: false,
              needsReconnect: true,
              error: "Missing Facebook Pages permissions",
              requiredPermissions: [
                "pages_show_list",
                "pages_read_engagement",
                "pages_read_user_content",
                "pages_manage_metadata",
                "pages_manage_ads",
                "pages_messaging",
              ],
              details: parsed,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch {
        // ignore parse errors
      }

      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch Facebook page", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    console.log("Facebook page fetched successfully:", data.name);

    return new Response(
      JSON.stringify({
        success: true,
        page: {
          name: data.name || null,
          id: data.id || null,
          followers_count: data.followers_count || null,
          fan_count: data.fan_count || null,
          picture_url: data.picture?.data?.url || null,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error("Error fetching Facebook page:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
