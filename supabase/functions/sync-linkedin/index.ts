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

    const { clientId, accountId, platform, accessToken, accountExternalId, periodStart, periodEnd } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing LinkedIn data for organization ${accountExternalId}`);

    let recordsSynced = 0;

    // LinkedIn API base URL
    const baseUrl = "https://api.linkedin.com/v2";

    // Fetch organization follower count
    const followersUrl = `${baseUrl}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${accountExternalId}`;
    
    console.log("Fetching LinkedIn follower statistics...");
    const followersResponse = await fetch(followersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!followersResponse.ok) {
      const errorText = await followersResponse.text();
      console.error("LinkedIn API error:", errorText);
      throw new Error(`LinkedIn API error: ${followersResponse.status}`);
    }

    const followersData = await followersResponse.json();
    const followerCount = followersData.elements?.[0]?.followerCounts?.organicFollowerCount || 0;

    // Fetch organization shares/posts
    const sharesUrl = `${baseUrl}/shares?q=owners&owners=urn:li:organization:${accountExternalId}&count=100`;
    
    console.log("Fetching LinkedIn shares...");
    const sharesResponse = await fetch(sharesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!sharesResponse.ok) {
      const errorText = await sharesResponse.text();
      console.error("LinkedIn API error fetching shares:", errorText);
    }

    const sharesData = sharesResponse.ok ? await sharesResponse.json() : { elements: [] };
    const shares = sharesData.elements || [];

    // Filter shares by date
    const periodStartDate = new Date(periodStart).getTime();
    const periodEndDate = new Date(periodEnd).getTime();
    const filteredShares = shares.filter((share: any) => {
      const createdAt = share.created?.time || 0;
      return createdAt >= periodStartDate && createdAt <= periodEndDate;
    });

    // Fetch share statistics for each post
    for (const share of filteredShares) {
      const shareUrn = share.activity || share.id;
      
      // Fetch share statistics
      const statsUrl = `${baseUrl}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${accountExternalId}&shares=${encodeURIComponent(shareUrn)}`;
      
      const statsResponse = await fetch(statsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });

      let stats = { totalShareStatistics: { impressionCount: 0, clickCount: 0, likeCount: 0, commentCount: 0, shareCount: 0, engagementCount: 0 } };
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        stats = statsData.elements?.[0] || stats;
      }

      const totalStats = stats.totalShareStatistics || {};

      // Determine content type
      const contentType = share.content?.contentEntities?.[0]?.entityLocation?.includes('video') ? 'video' : 'post';

      // Upsert content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          social_account_id: accountId,
          platform: "linkedin",
          content_id: shareUrn,
          content_type: contentType,
          published_at: share.created?.time ? new Date(share.created.time).toISOString() : new Date().toISOString(),
          url: share.content?.contentEntities?.[0]?.entityLocation,
          title: share.text?.text?.substring(0, 100),
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      // Insert metrics snapshot
      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: content.id,
          platform: "linkedin",
          impressions: totalStats.impressionCount || 0,
          engagements: totalStats.engagementCount || 0,
          likes: totalStats.likeCount || 0,
          comments: totalStats.commentCount || 0,
          shares: totalStats.shareCount || 0,
          interactions: (totalStats.likeCount || 0) + (totalStats.commentCount || 0) + (totalStats.shareCount || 0),
          link_clicks: totalStats.clickCount || 0,
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
    const totalEngagements = filteredShares.reduce((sum: number, s: any) => {
      // Use the stats we fetched
      return sum + (s.totalShareStatistics?.engagementCount || 0);
    }, 0);
    
    const totalImpressions = filteredShares.reduce((sum: number, s: any) => {
      return sum + (s.totalShareStatistics?.impressionCount || 0);
    }, 0);
    
    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

    // Store account metrics
    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert({
        client_id: clientId,
        social_account_id: accountId,
        platform: "linkedin",
        followers: followerCount,
        engagement_rate: engagementRate,
        total_content: filteredShares.length,
        period_start: periodStart,
        period_end: periodEnd,
      });

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
    }

    console.log(`LinkedIn sync completed. Records synced: ${recordsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform: "linkedin",
        accountMetrics: {
          followers: followerCount,
          engagementRate,
          totalContent: filteredShares.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-linkedin:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
