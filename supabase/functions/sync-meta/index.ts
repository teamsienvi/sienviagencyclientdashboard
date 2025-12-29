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

      // Fetch Facebook page insights for reach/impressions
      try {
        const fbInsightsUrl = `${baseUrl}/${accountExternalId}/insights?metric=page_impressions,page_post_engagements,page_fans&period=week&access_token=${accessToken}`;
        console.log("Fetching Facebook page insights...");
        const fbInsightsResp = await fetch(fbInsightsUrl);
        
        if (fbInsightsResp.ok) {
          const fbInsightsData = await fbInsightsResp.json();
          for (const insight of fbInsightsData.data || []) {
            const value = insight.values?.[insight.values.length - 1]?.value || 0;
            if (insight.name === 'page_impressions') totalImpressions = value;
            if (insight.name === 'page_fans') totalFollowers = totalFollowers || value;
          }
          console.log(`Facebook page insights: impressions=${totalImpressions}, followers=${totalFollowers}`);
        } else {
          console.log("Facebook insights failed (non-fatal):", await fbInsightsResp.text());
        }
      } catch (e) {
        console.log("Error fetching Facebook page insights:", e);
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
    const mediaItemsAll: MetaMediaItem[] = mediaData.data || [];

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    periodEndDate.setHours(23, 59, 59, 999);

    const getItemDate = (item: MetaMediaItem) => {
      const raw = platform === 'instagram' ? item.timestamp : (item as any).created_time;
      return raw ? new Date(raw) : null;
    };

    // Only sync items that fall inside the requested period.
    const mediaItems: MetaMediaItem[] = mediaItemsAll.filter((item) => {
      const d = getItemDate(item);
      if (!d) return false;
      return d >= periodStartDate && d <= periodEndDate;
    });

    console.log(`Fetched ${mediaItemsAll.length} items, syncing ${mediaItems.length} in period ${periodStart} to ${periodEnd}`);

    // Fetch insights per item (only for items in the requested period)
    if (platform === 'instagram') {
      console.log(`Fetching insights for ${mediaItems.length} Instagram posts...`);
      for (const item of mediaItems) {
        try {
          // v22.0+ compatible: use 'reach,views,saved,total_interactions' instead of deprecated 'impressions,plays'
          const insightMetrics = 'reach,views,saved,total_interactions';

          const postInsightsUrl = `${baseUrl}/${item.id}/insights?metric=${insightMetrics}&access_token=${accessToken}`;
          const insightsResp = await fetch(postInsightsUrl);
          const insightsJson = await insightsResp.json();

          // Check for API error in response (Graph API can return 200 with error)
          if (insightsJson.error) {
            console.log(`IG insights API error for ${item.id} (${item.media_type}): ${insightsJson.error.message?.substring(0, 100)}`);
            
            // Try fallback with just reach (most reliable metric)
            const fallbackUrl = `${baseUrl}/${item.id}/insights?metric=reach&access_token=${accessToken}`;
            const fallbackResp = await fetch(fallbackUrl);
            const fallbackJson = await fallbackResp.json();
            
            if (!fallbackJson.error && fallbackJson.data?.length > 0) {
              item.insights = fallbackJson;
            } else {
              (item as any).insightsFailed = true;
            }
          } else if (insightsResp.ok && insightsJson.data) {
            item.insights = insightsJson;
          } else {
            console.log(`Insights failed for ${item.id} (${item.media_type}): status=${insightsResp.status}`);
            (item as any).insightsFailed = true;
          }
        } catch (e) {
          console.error(`Error fetching insights for post ${item.id}:`, e);
          (item as any).insightsFailed = true;
        }
      }
    } else {
      console.log(`Fetching insights for ${mediaItems.length} Facebook posts...`);
      for (const item of mediaItems) {
        try {
          // Use post_impressions_unique for reach, post_impressions for impressions with period=lifetime
          const postInsightsUrl = `${baseUrl}/${item.id}/insights?metric=post_impressions_unique,post_impressions&period=lifetime&access_token=${accessToken}`;
          const insightsResp = await fetch(postInsightsUrl);
          const insightsJson = await insightsResp.json();

          // Check for API error in response (Graph API can return 200 with error)
          if (insightsJson.error) {
            console.log(`FB post insights API error for ${item.id}: ${insightsJson.error.message?.substring(0, 100)}`);
            
            // Try fallback with just post_impressions
            const fallbackUrl = `${baseUrl}/${item.id}/insights?metric=post_impressions&period=lifetime&access_token=${accessToken}`;
            const fallbackResp = await fetch(fallbackUrl);
            const fallbackJson = await fallbackResp.json();
            
            if (!fallbackJson.error && fallbackJson.data?.length > 0) {
              (item as any).fbInsights = fallbackJson.data;
              (item as any).insightsFallback = true;
            } else {
              (item as any).fbInsights = [];
              (item as any).insightsFailed = true;
            }
          } else if (insightsResp.ok && insightsJson.data) {
            (item as any).fbInsights = insightsJson.data || [];
          } else {
            console.log(`FB post insights failed for ${item.id}: status=${insightsResp.status}`);
            (item as any).fbInsights = [];
            (item as any).insightsFailed = true;
          }
        } catch (e) {
          console.error(`Error fetching FB post insights for ${item.id}:`, e);
          (item as any).fbInsights = [];
          (item as any).insightsFailed = true;
        }
      }
    }

    // Store content and metrics
    for (const item of mediaItems) {
      const contentType = platform === 'instagram'
        ? (item.media_type === 'VIDEO' ? 'reel' : item.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'post')
        : 'post';

      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert(
          {
            client_id: clientId,
            social_account_id: accountId,
            platform: platform,
            content_id: item.id,
            content_type: contentType,
            published_at:
              platform === "instagram"
                ? (item.timestamp || new Date().toISOString())
                : ((item as any).created_time || new Date().toISOString()),
            url:
              platform === "instagram"
                ? (item.permalink || item.media_url || null)
                : ((item as any).permalink_url || null),
            title:
              platform === "instagram"
                ? (item.caption?.substring(0, 100) || null)
                : ((item as any).message?.substring(0, 100) || null),
          },
          { onConflict: "client_id,platform,content_id" },
        )
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      let reach = 0, impressions = 0, likes = 0, comments = 0, shares = 0, interactions = 0, saved = 0;

      if (platform === 'instagram') {
        likes = item.like_count || 0;
        comments = item.comments_count || 0;

        let views = 0;
        if (item.insights?.data) {
          for (const insight of item.insights.data) {
            const value = insight.values?.[0]?.value || 0;
            if (insight.name === 'reach') reach = value;
            if (insight.name === 'views') views = value; // v22.0+ replaces impressions
            if (insight.name === 'saved') saved = value;
            if (insight.name === 'total_interactions') interactions = value;
          }
        }
        // Store views as impressions for backward compatibility
        impressions = views;

        if (interactions === 0) {
          interactions = likes + comments + shares + saved;
        }
      } else {
        likes = (item as any).reactions?.summary?.total_count || 0;
        comments = (item as any).comments?.summary?.total_count || 0;
        shares = (item as any).shares?.count || 0;

        const fbInsights = (item as any).fbInsights || [];
        for (const insight of fbInsights) {
          const value = insight.values?.[0]?.value || 0;
          if (insight.name === 'post_impressions_unique') reach = value;
          if (insight.name === 'post_impressions') impressions = value;
        }
      }

      if (interactions === 0) {
        interactions = likes + comments + shares;
      }

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

    // Calculate engagement rate for the requested period only
    const totalContent = mediaItems.length;
    const totalInteractions = mediaItems.reduce((sum, item) => {
      if (platform === 'instagram') {
        return sum + (item.like_count || 0) + (item.comments_count || 0);
      }
      return (
        sum +
        ((item as any).reactions?.summary?.total_count || 0) +
        ((item as any).comments?.summary?.total_count || 0) +
        ((item as any).shares?.count || 0)
      );
    }, 0);

    const engagementRate = totalFollowers > 0 ? (totalInteractions / totalFollowers) * 100 : 0;

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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