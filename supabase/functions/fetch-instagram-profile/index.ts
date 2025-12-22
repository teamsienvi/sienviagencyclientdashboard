import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, instagramBusinessId, pageId } = await req.json();

    if (!accessToken || !instagramBusinessId) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken or instagramBusinessId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log(`Fetching Instagram profile for ID: ${instagramBusinessId}`);

    // Prefer a Page access token (IG Business accounts are tied to Pages)
    let tokenToUse = accessToken;
    try {
      const accountsResp = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${accessToken}`,
      );
      if (accountsResp.ok) {
        const accountsJson = await accountsResp.json();
        const accounts = accountsJson.data || [];
        const match = pageId ? accounts.find((p: any) => p.id === pageId) : accounts[0];
        if (match?.access_token) {
          tokenToUse = match.access_token;
        }
      }
    } catch (e) {
      console.log("Could not resolve Page access token (continuing):", e);
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${instagramBusinessId}?fields=username,name,profile_picture_url,followers_count,media_count,biography&access_token=${tokenToUse}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Facebook API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Instagram profile", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("Instagram profile fetched successfully:", data.username);

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          username: data.username || null,
          name: data.name || null,
          profile_picture_url: data.profile_picture_url || null,
          followers_count: data.followers_count || null,
          media_count: data.media_count || null,
          biography: data.biography || null,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error("Error fetching Instagram profile:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
