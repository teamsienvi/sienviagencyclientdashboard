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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, accountId, accountExternalId, periodStart, periodEnd } = await req.json();

    // Use the stored bearer token from secrets
    const accessToken = Deno.env.get("X_BEARER_TOKEN");

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "X_BEARER_TOKEN not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing X data for user ${accountExternalId}`);

    let recordsSynced = 0;

    // X API v2 base URL
    const baseUrl = "https://api.twitter.com/2";

    // Fetch user info for follower count
    const userUrl = `${baseUrl}/users/${accountExternalId}?user.fields=public_metrics`;
    
    console.log("Fetching X user info...");
    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("X API error:", errorText);
      
      // Handle rate limiting with a user-friendly message
      if (userResponse.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "X API rate limit exceeded. Please try again in 15 minutes or upload a CSV export instead.",
            rateLimited: true,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`X API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const followerCount = userData.data?.public_metrics?.followers_count || 0;

    // Fetch recent tweets with metrics
    const tweetsUrl = `${baseUrl}/users/${accountExternalId}/tweets?tweet.fields=public_metrics,created_at&max_results=100&start_time=${periodStart}T00:00:00Z&end_time=${periodEnd}T23:59:59Z`;
    
    console.log("Fetching X tweets...");
    const tweetsResponse = await fetch(tweetsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!tweetsResponse.ok) {
      const errorText = await tweetsResponse.text();
      console.error("X API error fetching tweets:", errorText);
    }

    const tweetsData = tweetsResponse.ok ? await tweetsResponse.json() : { data: [] };
    const tweets = tweetsData.data || [];

    // Store content and metrics
    for (const tweet of tweets) {
      const metrics = tweet.public_metrics || {};

      // Upsert content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          social_account_id: accountId,
          platform: "x",
          content_id: tweet.id,
          content_type: "tweet",
          published_at: tweet.created_at || new Date().toISOString(),
          url: `https://twitter.com/i/web/status/${tweet.id}`,
          title: tweet.text?.substring(0, 100),
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      // Extract metrics
      const impressions = metrics.impression_count || 0;
      const likes = metrics.like_count || 0;
      const comments = metrics.reply_count || 0;
      const shares = metrics.retweet_count || 0;
      const engagements = likes + comments + shares + (metrics.quote_count || 0);
      const profileVisits = 0; // X doesn't expose this per-tweet
      const linkClicks = metrics.url_link_clicks || 0;

      // Insert metrics snapshot
      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: content.id,
          platform: "x",
          impressions,
          engagements,
          likes,
          comments,
          shares,
          interactions: engagements,
          profile_visits: profileVisits,
          link_clicks: linkClicks,
          period_start: periodStart,
          period_end: periodEnd,
        });

      if (metricsError) {
        console.error("Error inserting metrics:", metricsError);
      } else {
        recordsSynced++;
      }
    }

    // Calculate engagement rate
    const totalEngagements = tweets.reduce((sum: number, t: any) => {
      const m = t.public_metrics || {};
      return sum + (m.like_count || 0) + (m.reply_count || 0) + 
             (m.retweet_count || 0) + (m.quote_count || 0);
    }, 0);
    
    const totalImpressions = tweets.reduce((sum: number, t: any) => {
      return sum + (t.public_metrics?.impression_count || 0);
    }, 0);
    
    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

    // Store account metrics
    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert({
        client_id: clientId,
        social_account_id: accountId,
        platform: "x",
        followers: followerCount,
        engagement_rate: engagementRate,
        total_content: tweets.length,
        period_start: periodStart,
        period_end: periodEnd,
      });

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
    }

    console.log(`X sync completed. Records synced: ${recordsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform: "x",
        accountMetrics: {
          followers: followerCount,
          engagementRate,
          totalContent: tweets.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-x:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
