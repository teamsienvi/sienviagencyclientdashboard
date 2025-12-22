import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaInsight {
  name: string;
  period: string;
  values: Array<{ value: number }>;
  title: string;
  description: string;
  id: string;
}

interface MetaMediaItem {
  id: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  insights?: {
    data: MetaInsight[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, accountId, platform, accessToken, accountExternalId, periodStart, periodEnd } = await req.json();

    if (!accessToken || !accountExternalId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing access token or account ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${platform} data for account ${accountExternalId}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from("social_sync_logs")
      .insert({
        client_id: clientId,
        platform: platform,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncLogError) {
      console.error("Error creating sync log:", syncLogError);
    }

    let recordsSynced = 0;
    const baseUrl = "https://graph.facebook.com/v21.0";

    let totalFollowers = 0;
    let totalReach = 0;
    let totalImpressions = 0;

    // Different handling for Instagram vs Facebook
    if (platform === 'instagram') {
      // Fetch Instagram account info for follower count (insights API is unreliable)
      const accountInfoUrl = `${baseUrl}/${accountExternalId}?fields=followers_count,media_count&access_token=${accessToken}`;
      
      console.log(`Fetching Instagram account info...`);
      const accountInfoResponse = await fetch(accountInfoUrl);
      
      if (accountInfoResponse.ok) {
        const accountInfo = await accountInfoResponse.json();
        totalFollowers = accountInfo.followers_count || 0;
        console.log(`Instagram followers: ${totalFollowers}`);
      } else {
        const errorText = await accountInfoResponse.text();
        console.error("Instagram account info error:", errorText);
      }
    } else {
      // For Facebook Pages, get basic info first
      const pageInfoUrl = `${baseUrl}/${accountExternalId}?fields=followers_count,fan_count&access_token=${accessToken}`;
      
      console.log(`Fetching Facebook page info...`);
      const pageInfoResponse = await fetch(pageInfoUrl);
      
      if (pageInfoResponse.ok) {
        const pageInfo = await pageInfoResponse.json();
        totalFollowers = pageInfo.followers_count || pageInfo.fan_count || 0;
        console.log(`Facebook page followers: ${totalFollowers}`);
      } else {
        const errorText = await pageInfoResponse.text();
        console.error("Facebook page info error (non-fatal):", errorText);
      }
    }

    // Fetch media/posts
    const mediaFields = platform === 'instagram'
      ? "id,media_type,permalink,timestamp,caption,like_count,comments_count"
      : "id,message,permalink_url,created_time,reactions.summary(total_count),comments.summary(total_count),shares";
    
    // For Instagram, use the media endpoint; for Facebook, use posts
    const mediaEndpoint = platform === 'instagram' ? 'media' : 'posts';
    const mediaUrl = `${baseUrl}/${accountExternalId}/${mediaEndpoint}?fields=${mediaFields}&limit=50&access_token=${accessToken}`;
    
    console.log(`Fetching media/posts...`);
    const mediaResponse = await fetch(mediaUrl);
    
    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error("Meta API error fetching media:", errorText);
      // Continue even if media fetch fails
    }

    const mediaData = mediaResponse.ok ? await mediaResponse.json() : { data: [] };
    const mediaItems: MetaMediaItem[] = mediaData.data || [];

    // For Instagram, fetch insights for each post to get reach/impressions
    if (platform === 'instagram') {
      console.log(`Fetching insights for ${mediaItems.length} Instagram posts...`);
      for (const item of mediaItems) {
        try {
          // Use the correct metrics based on media type
          // For Reels (VIDEO): reach, plays, likes, comments, shares, saved, total_interactions
          // For Images/Carousels: reach, saved, likes, comments, shares, total_interactions
          let insightMetrics: string;
          
          if (item.media_type === 'VIDEO') {
            // Reels use 'plays' instead of 'impressions'
            insightMetrics = 'reach,plays,saved,total_interactions';
          } else if (item.media_type === 'CAROUSEL_ALBUM') {
            // Carousels have limited insights
            insightMetrics = 'reach,saved,total_interactions';
          } else {
            // Regular images
            insightMetrics = 'reach,saved,total_interactions';
          }
          
          const postInsightsUrl = `${baseUrl}/${item.id}/insights?metric=${insightMetrics}&access_token=${accessToken}`;
          const insightsResp = await fetch(postInsightsUrl);
          
          if (insightsResp.ok) {
            const insightsJson = await insightsResp.json();
            item.insights = insightsJson;
            console.log(`Got insights for ${item.id}: ${JSON.stringify(insightsJson.data?.map((d: any) => d.name))}`);
          } else {
            const errText = await insightsResp.text();
            console.log(`Insights failed for ${item.id} (${item.media_type}): ${errText.substring(0, 100)}`);
            // Try minimal fallback
            const fallbackUrl = `${baseUrl}/${item.id}/insights?metric=reach&access_token=${accessToken}`;
            const fallbackResp = await fetch(fallbackUrl);
            if (fallbackResp.ok) {
              item.insights = await fallbackResp.json();
            }
          }
        } catch (e) {
          console.error(`Error fetching insights for post ${item.id}:`, e);
        }
      }
    }

    // Store content and metrics
    for (const item of mediaItems) {
      // Upsert content
      const contentType = platform === 'instagram' 
        ? (item.media_type === 'VIDEO' ? 'reel' : item.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'post')
        : 'post';

      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          social_account_id: accountId,
          platform: platform,
          content_id: item.id,
          content_type: contentType,
          published_at: item.timestamp || new Date().toISOString(),
          url: item.permalink || item.media_url,
          title: item.caption?.substring(0, 100),
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      // Extract metrics
      let reach = 0, impressions = 0, likes = 0, comments = 0, shares = 0, interactions = 0, saved = 0;

      if (platform === 'instagram') {
        likes = item.like_count || 0;
        comments = item.comments_count || 0;
        
        if (item.insights?.data) {
          for (const insight of item.insights.data) {
            const value = insight.values?.[0]?.value || 0;
            if (insight.name === 'reach') reach = value;
            if (insight.name === 'plays') impressions = value; // Reels use 'plays' 
            if (insight.name === 'saved') saved = value;
            if (insight.name === 'shares') shares = value;
            if (insight.name === 'total_interactions') interactions = value;
          }
        }
        
        // If total_interactions wasn't in insights, calculate it
        if (interactions === 0) {
          interactions = likes + comments + shares + saved;
        }
      } else {
        // Facebook
        likes = (item as any).reactions?.summary?.total_count || 0;
        comments = (item as any).comments?.summary?.total_count || 0;
        shares = (item as any).shares?.count || 0;
      }

      interactions = likes + comments + shares;

      // Insert metrics snapshot
      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: content.id,
          platform: platform,
          reach,
          impressions,
          likes,
          comments,
          shares,
          interactions,
          views: impressions,
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
    const totalContent = mediaItems.length;
    const totalInteractions = mediaItems.reduce((sum, item) => {
      if (platform === 'instagram') {
        return sum + (item.like_count || 0) + (item.comments_count || 0);
      }
      return sum + ((item as any).reactions?.summary?.total_count || 0) + 
             ((item as any).comments?.summary?.total_count || 0) + 
             ((item as any).shares?.count || 0);
    }, 0);
    
    const engagementRate = totalFollowers > 0 ? (totalInteractions / totalFollowers) * 100 : 0;

    // Store account metrics
    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert({
        client_id: clientId,
        social_account_id: accountId,
        platform: platform,
        followers: totalFollowers,
        engagement_rate: engagementRate,
        total_content: totalContent,
        period_start: periodStart,
        period_end: periodEnd,
      });

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
    }

    console.log(`${platform} sync completed. Records synced: ${recordsSynced}`);

    // Update sync log as completed
    if (syncLog?.id) {
      await supabase
        .from("social_sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
        })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform,
        accountMetrics: {
          followers: totalFollowers,
          engagementRate,
          totalContent,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-meta:", error);
    
    // Try to update sync log as failed (need to get clientId and platform from request)
    // This is a best-effort update since we may not have the syncLog id
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
