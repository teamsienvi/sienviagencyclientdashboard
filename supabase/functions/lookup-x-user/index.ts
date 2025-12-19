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
    const bearerToken = Deno.env.get("X_BEARER_TOKEN");
    
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ success: false, error: "X_BEARER_TOKEN not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: "Username is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, "");

    console.log(`Looking up X user: ${cleanUsername}`);

    const url = `https://api.twitter.com/2/users/by/username/${cleanUsername}?user.fields=public_metrics,description,profile_image_url`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("X API error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: `X API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    if (data.errors) {
      return new Response(
        JSON.stringify({ success: false, error: data.errors[0]?.message || "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User found:", data.data);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: data.data.id,
          username: data.data.username,
          name: data.data.name,
          followers: data.data.public_metrics?.followers_count || 0,
          following: data.data.public_metrics?.following_count || 0,
          tweets: data.data.public_metrics?.tweet_count || 0,
          description: data.data.description,
          profileImage: data.data.profile_image_url,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in lookup-x-user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
