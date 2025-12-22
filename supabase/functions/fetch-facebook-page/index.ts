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

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=name,id,followers_count,fan_count,picture.width(200).height(200)&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Facebook API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Facebook page", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
