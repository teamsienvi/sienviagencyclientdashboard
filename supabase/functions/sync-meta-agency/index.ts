import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  clientId: string;
  clientName: string;
  platform: string;
  success: boolean;
  recordsSynced?: number;
  error?: string;
  periodStart?: string;
  periodEnd?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the agency connection
    const { data: agencyConnection, error: connError } = await supabase
      .from('meta_agency_connection')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (connError || !agencyConnection) {
      throw new Error('No agency Meta connection found. Please connect first.');
    }

    // Check if token is expired
    const tokenExpiry = new Date(agencyConnection.token_expires_at);
    if (tokenExpiry < new Date()) {
      throw new Error('Agency token has expired. Please reconnect.');
    }

    const userAccessToken = agencyConnection.access_token;

    // Get all active client-meta mappings
    const { data: mappings, error: mapError } = await supabase
      .from('client_meta_map')
      .select(`
        *,
        clients (id, name)
      `)
      .eq('active', true);

    if (mapError) {
      throw new Error('Failed to fetch client mappings');
    }

    if (!mappings || mappings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active mappings to sync', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${mappings.length} active mappings to sync`);

    // Fetch page access tokens once
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${userAccessToken}`
    );
    const pagesData = await pagesResponse.json();
    
    if (pagesData.error) {
      throw new Error(pagesData.error.message || 'Failed to fetch page tokens');
    }

    const pageTokens: Record<string, string> = {};
    for (const page of pagesData.data || []) {
      pageTokens[page.id] = page.access_token;
    }

    // Fetch meta_assets to get parent_page_id for Instagram accounts
    const { data: metaAssets } = await supabase
      .from('meta_assets')
      .select('ig_business_id, parent_page_id')
      .eq('platform', 'instagram')
      .not('parent_page_id', 'is', null);

    const igParentPageMap: Record<string, string> = {};
    for (const asset of metaAssets || []) {
      if (asset.ig_business_id && asset.parent_page_id) {
        igParentPageMap[asset.ig_business_id] = asset.parent_page_id;
      }
    }

    const results: SyncResult[] = [];
    
    // Calculate the last completed week (Monday-Sunday) to match UI's logic
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - daysToSubtract);
    thisMonday.setHours(0, 0, 0, 0);
    
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevSunday = new Date(thisMonday);
    prevSunday.setDate(thisMonday.getDate() - 1);
    
    const periodStartStr = prevMonday.toISOString().split('T')[0];
    const periodEndStr = prevSunday.toISOString().split('T')[0];
    
    // Previous week for comparison
    const prevPrevMonday = new Date(prevMonday);
    prevPrevMonday.setDate(prevMonday.getDate() - 7);
    const prevPrevSunday = new Date(prevMonday);
    prevPrevSunday.setDate(prevMonday.getDate() - 1);
    
    const prevPeriodStartStr = prevPrevMonday.toISOString().split('T')[0];
    const prevPeriodEndStr = prevPrevSunday.toISOString().split('T')[0];
    
    console.log(`Sync period: ${periodStartStr} to ${periodEndStr}`);
    console.log(`Comparison period: ${prevPeriodStartStr} to ${prevPeriodEndStr}`);

    // Track clients synced via agency to avoid double-syncing
    const agencySyncedClients = new Set<string>();

    const periods = [
      { start: periodStartStr, end: periodEndStr },
      { start: prevPeriodStartStr, end: prevPeriodEndStr },
    ];

    // Build array of sync tasks to run in parallel batches
    const syncTasks: Array<() => Promise<SyncResult>> = [];

    for (const mapping of mappings) {
      const clientId = mapping.client_id;
      const clientName = mapping.clients?.name || 'Unknown';

      // Sync Facebook if page_id is mapped
      if (mapping.page_id && pageTokens[mapping.page_id]) {
        for (const p of periods) {
          syncTasks.push(() => syncFacebookPage(
            supabase,
            clientId,
            clientName,
            mapping.page_id,
            pageTokens[mapping.page_id],
            p.start,
            p.end
          ).then(r => ({ ...r, periodStart: p.start, periodEnd: p.end })));
        }
        agencySyncedClients.add(`${clientId}_facebook`);
      }

      // Sync Instagram if ig_business_id is mapped
      if (mapping.ig_business_id) {
        const parentPageId = igParentPageMap[mapping.ig_business_id];
        const accessToken = parentPageId ? pageTokens[parentPageId] : null;

        if (accessToken) {
          for (const p of periods) {
            syncTasks.push(() => syncInstagramAccount(
              supabase,
              clientId,
              clientName,
              mapping.ig_business_id,
              accessToken,
              p.start,
              p.end
            ).then(r => ({ ...r, periodStart: p.start, periodEnd: p.end })));
          }
          agencySyncedClients.add(`${clientId}_instagram`);
        } else {
          console.log(`No access token found for Instagram ${mapping.ig_business_id} (parent page: ${parentPageId})`);
          results.push({
            clientId,
            clientName,
            platform: 'instagram',
            success: false,
            error: 'No parent page access token found',
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
          });
        }
      }
    }

    // Run sync tasks in parallel batches of 5 to avoid overwhelming APIs
    const BATCH_SIZE = 5;
    for (let i = 0; i < syncTasks.length; i += BATCH_SIZE) {
      const batch = syncTasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
    }

    // Now sync clients with individual OAuth accounts (not covered by agency)
    const { data: oauthAccounts } = await supabase
      .from('social_oauth_accounts')
      .select(`
        *,
        clients (id, name)
      `)
      .eq('is_active', true)
      .not('access_token', 'is', null);

    if (oauthAccounts && oauthAccounts.length > 0) {
      console.log(`Found ${oauthAccounts.length} individual OAuth accounts to sync`);
      
      const oauthTasks: Array<() => Promise<SyncResult>> = [];
      
      for (const account of oauthAccounts) {
        const clientId = account.client_id;
        const clientName = account.clients?.name || 'Unknown';
        const platform = account.platform;

        // Skip if already synced via agency
        if (agencySyncedClients.has(`${clientId}_${platform}`)) {
          console.log(`Skipping ${clientName} ${platform} - already synced via agency`);
          continue;
        }

        // Check token expiry
        const tokenExpiry = new Date(account.token_expires_at);
        if (tokenExpiry < new Date()) {
          console.log(`Token expired for ${clientName} ${platform}`);
          results.push({
            clientId,
            clientName,
            platform,
            success: false,
            error: 'Token expired - please reconnect',
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
          });
          continue;
        }

        if (platform === 'instagram' && account.instagram_business_id) {
          for (const p of periods) {
            oauthTasks.push(() => syncInstagramAccount(
              supabase,
              clientId,
              clientName,
              account.instagram_business_id,
              account.access_token,
              p.start,
              p.end
            ).then(r => ({ ...r, periodStart: p.start, periodEnd: p.end })));
          }
        } else if (platform === 'facebook' && account.page_id) {
          for (const p of periods) {
            oauthTasks.push(() => syncFacebookPage(
              supabase,
              clientId,
              clientName,
              account.page_id,
              account.access_token,
              p.start,
              p.end
            ).then(r => ({ ...r, periodStart: p.start, periodEnd: p.end })));
          }
        }
      }

      // Run OAuth tasks in parallel batches
      for (let i = 0; i < oauthTasks.length; i += BATCH_SIZE) {
        const batch = oauthTasks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(task => task()));
        results.push(...batchResults);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Sync completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalMappings: mappings.length,
        totalOAuthAccounts: oauthAccounts?.length || 0,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-meta-agency:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper to fetch posts with pagination until we cover the period
async function fetchPostsWithPagination(
  baseUrl: string,
  accessToken: string,
  periodStart: Date,
  maxItems: number = 100
): Promise<any[]> {
  const allPosts: any[] = [];
  let nextUrl: string | null = baseUrl;
  
  while (nextUrl && allPosts.length < maxItems) {
    const resp: Response = await fetch(nextUrl);
    if (!resp.ok) {
      console.log(`Failed to fetch posts: ${resp.status}`);
      break;
    }
    
    const json = await resp.json();
    if (json.error) {
      console.log(`API error fetching posts: ${json.error.message}`);
      break;
    }
    
    const posts = json.data || [];
    if (posts.length === 0) break;
    
    allPosts.push(...posts);
    
    // Check if oldest post is before our period start - we can stop
    const oldestPost = posts[posts.length - 1];
    const oldestDate = new Date(oldestPost.created_time || oldestPost.timestamp);
    if (oldestDate < periodStart) {
      break;
    }
    
    // Get next page URL
    nextUrl = json.paging?.next || null;
  }
  
  return allPosts;
}

async function syncFacebookPage(
  supabase: any,
  clientId: string,
  clientName: string,
  pageId: string,
  accessToken: string,
  periodStart: string,
  periodEnd: string
): Promise<SyncResult> {
  let syncLogId: string | null = null;
  let errorMessages: string[] = [];
  
  try {
    console.log(`Syncing Facebook page ${pageId} for client ${clientName} (${periodStart} to ${periodEnd})`);

    // Create sync log
    const { data: syncLog } = await supabase
      .from('social_sync_logs')
      .insert({
        client_id: clientId,
        platform: 'facebook',
        status: 'running',
      })
      .select()
      .single();
    
    syncLogId = syncLog?.id;

    // Fetch page info (fallback)
    const pageResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${accessToken}`
    );
    const pageData = await pageResponse.json();

    if (pageData.error) {
      throw new Error(pageData.error.message);
    }

    let followers = pageData.followers_count || pageData.fan_count || 0;

    // Parse period dates
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    periodEndDate.setHours(23, 59, 59, 999);

    // Fetch PAGE-LEVEL insights for total reach/impressions + follower count (end-of-period)
    let pageReach = 0;
    let pageImpressions = 0;

    try {
      const since = Math.floor(periodStartDate.getTime() / 1000);
      const until = Math.floor(periodEndDate.getTime() / 1000) + 86400;

      const pageInsightsUrl = `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions_unique,page_impressions,page_fans&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
      console.log(`Fetching page insights for ${clientName}...`);

      const pageInsightsResp = await fetch(pageInsightsUrl);
      const pageInsightsData = await pageInsightsResp.json();

      if (pageInsightsData.error) {
        console.log(`Page insights error: ${pageInsightsData.error.message}`);
        errorMessages.push(`Page insights: ${pageInsightsData.error.message?.substring(0, 50)}`);
      } else if (pageInsightsData.data) {
        for (const insight of pageInsightsData.data) {
          if (insight.name === 'page_impressions_unique') {
            pageReach = (insight.values || []).reduce((sum: number, v: any) => sum + (v.value || 0), 0);
          }
          if (insight.name === 'page_impressions') {
            pageImpressions = (insight.values || []).reduce((sum: number, v: any) => sum + (v.value || 0), 0);
          }
          if (insight.name === 'page_fans') {
            const values = insight.values || [];
            const last = values.length > 0 ? values[values.length - 1]?.value : null;
            if (typeof last === 'number') followers = last;
          }
        }

        console.log(`${clientName} page reach: ${pageReach}, impressions: ${pageImpressions}, followers(end): ${followers}`);
      }
    } catch (e) {
      console.log(`Error fetching page insights: ${e}`);
      errorMessages.push('Could not fetch page-level reach');
    }

    // Fetch posts with pagination to cover the period
    const postsUrl = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)&limit=50&access_token=${accessToken}`;
    const allPosts = await fetchPostsWithPagination(postsUrl, accessToken, periodStartDate, 100);
    
    console.log(`Fetched ${allPosts.length} total Facebook posts`);

    // Filter posts to only those in the requested period
    const postsInPeriod = allPosts.filter(post => {
      const postDate = new Date(post.created_time);
      return postDate >= periodStartDate && postDate <= periodEndDate;
    });
    
    console.log(`Found ${postsInPeriod.length} Facebook posts in period ${periodStart} to ${periodEnd}`);

    let recordsSynced = 0;
    let totalEngagement = 0;

    // Calculate total engagement for proportional distribution
    const totalPostEngagement = postsInPeriod.reduce((sum, post) => {
      const likes = post.reactions?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;
      return sum + likes + comments + shares;
    }, 0);

    for (const post of postsInPeriod) {
      const likes = post.reactions?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;
      const postEngagement = likes + comments + shares;

      // Distribute page reach/impressions proportionally based on engagement
      // Posts with more engagement get proportionally more reach attributed
      let postReach = 0;
      let postImpressions = 0;
      
      if (pageReach > 0 && totalPostEngagement > 0) {
        const engagementRatio = postEngagement / totalPostEngagement;
        postReach = Math.round(pageReach * engagementRatio);
        postImpressions = Math.round(pageImpressions * engagementRatio);
      } else if (pageReach > 0 && postsInPeriod.length > 0) {
        // Equal distribution if no engagement data
        postReach = Math.round(pageReach / postsInPeriod.length);
        postImpressions = Math.round(pageImpressions / postsInPeriod.length);
      }

      // Upsert content
      const { data: contentData } = await supabase
        .from('social_content')
        .upsert({
          client_id: clientId,
          platform: 'facebook',
          content_id: post.id,
          title: post.message?.substring(0, 100) || null,
          url: post.permalink_url,
          published_at: post.created_time,
          content_type: 'post',
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentData) {
        await supabase.from('social_content_metrics').insert({
          social_content_id: contentData.id,
          platform: 'facebook',
          period_start: periodStart,
          period_end: periodEnd,
          likes,
          comments,
          shares,
          reach: postReach,
          impressions: postImpressions,
        });

        totalEngagement += likes + comments + shares;
        recordsSynced++;
      }
    }

    // Delete existing account metrics for this period to avoid duplicates
    await supabase
      .from('social_account_metrics')
      .delete()
      .eq('client_id', clientId)
      .eq('platform', 'facebook')
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd);

    // Insert account metrics with page-level reach
    const engagementRate = followers > 0 ? (totalEngagement / followers) * 100 : 0;

    await supabase.from('social_account_metrics').insert({
      client_id: clientId,
      platform: 'facebook',
      period_start: periodStart,
      period_end: periodEnd,
      followers,
      engagement_rate: Math.min(engagementRate, 100),
      total_content: postsInPeriod.length,
    });

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'completed',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString(),
          error_message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
        })
        .eq('id', syncLogId);
    }

    return {
      clientId,
      clientName,
      platform: 'facebook',
      success: true,
      recordsSynced,
    };
  } catch (error) {
    console.error(`Error syncing Facebook for ${clientName}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (syncLogId) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq('id', syncLogId);
    }
    
    return {
      clientId,
      clientName,
      platform: 'facebook',
      success: false,
      error: errorMsg,
    };
  }
}

async function syncInstagramAccount(
  supabase: any,
  clientId: string,
  clientName: string,
  igBusinessId: string,
  accessToken: string,
  periodStart: string,
  periodEnd: string
): Promise<SyncResult> {
  let syncLogId: string | null = null;
  let errorMessages: string[] = [];
  
  try {
    console.log(`Syncing Instagram account ${igBusinessId} for client ${clientName} (${periodStart} to ${periodEnd})`);

    // Create sync log
    const { data: syncLog } = await supabase
      .from('social_sync_logs')
      .insert({
        client_id: clientId,
        platform: 'instagram',
        status: 'running',
      })
      .select()
      .single();
    
    syncLogId = syncLog?.id;

    // Fetch account info (fallback)
    const accountResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const accountData = await accountResponse.json();

    if (accountData.error) {
      throw new Error(accountData.error.message);
    }

    let followers = accountData.followers_count || 0;

    // Parse period dates
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    periodEndDate.setHours(23, 59, 59, 999);

    // Prefer historical follower count at end-of-period via insights
    try {
      const since = Math.floor(periodStartDate.getTime() / 1000);
      const until = Math.floor(periodEndDate.getTime() / 1000) + 86400;
      const followersInsightUrl = `https://graph.facebook.com/v21.0/${igBusinessId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
      const followersResp = await fetch(followersInsightUrl);
      const followersJson = await followersResp.json();

      if (!followersJson?.error && followersJson?.data?.length > 0) {
        const values = followersJson.data[0]?.values || [];
        const last = values.length > 0 ? values[values.length - 1]?.value : null;
        if (typeof last === 'number') followers = last;
      } else if (followersJson?.error) {
        console.log(`IG follower_count insights error (fallback): ${followersJson.error.message?.substring(0, 80)}`);
      }
    } catch (e) {
      console.log(`IG follower_count insights failed (fallback): ${e}`);
    }

    // Fetch media with pagination to cover the period
    const mediaUrl = `https://graph.facebook.com/v21.0/${igBusinessId}/media?fields=id,caption,timestamp,permalink,media_type,like_count,comments_count&limit=50&access_token=${accessToken}`;
    const allMedia = await fetchPostsWithPagination(mediaUrl, accessToken, periodStartDate, 100);
    
    console.log(`Fetched ${allMedia.length} total Instagram posts`);

    // Filter media to only those in the requested period
    const mediaInPeriod = allMedia.filter(item => {
      const postDate = new Date(item.timestamp);
      return postDate >= periodStartDate && postDate <= periodEndDate;
    });
    
    console.log(`Found ${mediaInPeriod.length} Instagram posts in period ${periodStart} to ${periodEnd}`);

    let recordsSynced = 0;
    let totalEngagement = 0;
    let insightsFailed = 0;

    // Batch fetch post insights - use v22.0 compatible metrics (views instead of deprecated impressions/plays)
    const postInsightsPromises = mediaInPeriod.map(async (post: any) => {
      try {
        // v22.0+ compatible: use 'reach,views' instead of deprecated 'reach,impressions,plays'
        const metrics = 'reach,views';
        const resp = await fetch(
          `https://graph.facebook.com/v21.0/${post.id}/insights?metric=${metrics}&access_token=${accessToken}`
        );
        const data = await resp.json();
        
        // Check for API error in response (Graph API can return 200 with error)
        if (data.error) {
          console.log(`IG insights API error for ${post.id}: ${data.error.message?.substring(0, 100)}`);
          
          // Try fallback with just reach (most reliable metric)
          const fallbackResp = await fetch(
            `https://graph.facebook.com/v21.0/${post.id}/insights?metric=reach&access_token=${accessToken}`
          );
          const fallbackData = await fallbackResp.json();
          
          if (!fallbackData.error && fallbackData.data?.length > 0) {
            let reach = 0;
            for (const insight of fallbackData.data || []) {
              if (insight.name === 'reach') reach = insight.values?.[0]?.value || 0;
            }
            return { postId: post.id, reach, views: null, failed: false, fallback: true };
          }
          
          return { postId: post.id, reach: null, views: null, failed: true, reason: data.error.code || 'unknown' };
        }
        
        if (resp.ok && data.data) {
          let reach = 0, views = 0;
          for (const insight of data.data || []) {
            const val = insight.values?.[0]?.value || 0;
            if (insight.name === 'reach') reach = val;
            if (insight.name === 'views') views = val;
          }
          return { postId: post.id, reach, views, failed: false };
        } else {
          console.log(`IG insights failed for ${post.id}: status=${resp.status}`);
          return { postId: post.id, reach: null, views: null, failed: true, reason: 'http_error' };
        }
      } catch (e) {
        console.log(`Could not fetch insights for IG post ${post.id}: ${e}`);
        return { postId: post.id, reach: null, views: null, failed: true, reason: 'exception' };
      }
    });

    const postInsights = await Promise.all(postInsightsPromises);
    const insightsMap: Record<string, { reach: number | null; views: number | null }> = {};
    const failureReasons: Record<string, number> = {};
    for (const pi of postInsights) {
      insightsMap[pi.postId] = { reach: pi.reach, views: (pi as any).views };
      if (pi.failed) {
        insightsFailed++;
        const reason = (pi as any).reason || 'unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
    }

    if (insightsFailed > 0) {
      const reasonSummary = Object.entries(failureReasons).map(([k, v]) => `${k}:${v}`).join(', ');
      errorMessages.push(`Insights unavailable for ${insightsFailed}/${mediaInPeriod.length} posts (${reasonSummary})`);
    }

    for (const post of mediaInPeriod) {
      const likes = post.like_count || 0;
      const comments = post.comments_count || 0;

      const postReach = insightsMap[post.id]?.reach;
      const postViews = insightsMap[post.id]?.views;

      // Map media_type to content_type
      let contentType = 'post';
      if (post.media_type === 'VIDEO') contentType = 'reel';
      if (post.media_type === 'CAROUSEL_ALBUM') contentType = 'carousel';

      // Upsert content
      const { data: contentData } = await supabase
        .from('social_content')
        .upsert({
          client_id: clientId,
          platform: 'instagram',
          content_id: post.id,
          title: post.caption?.substring(0, 100) || null,
          url: post.permalink,
          published_at: post.timestamp,
          content_type: contentType,
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentData) {
        // Insert metrics - store views as impressions for backward compatibility with UI
        await supabase.from('social_content_metrics').insert({
          social_content_id: contentData.id,
          platform: 'instagram',
          period_start: periodStart,
          period_end: periodEnd,
          likes,
          comments,
          reach: postReach ?? 0,
          impressions: postViews ?? 0, // views replaces deprecated impressions in v22.0+
          views: postViews ?? 0,
        });

        totalEngagement += likes + comments;
        recordsSynced++;
      }
    }

    // Insert account metrics - use actual posts in period
    const engagementRate = followers > 0 ? (totalEngagement / followers) * 100 : 0;

    await supabase.from('social_account_metrics').insert({
      client_id: clientId,
      platform: 'instagram',
      period_start: periodStart,
      period_end: periodEnd,
      followers,
      engagement_rate: Math.min(engagementRate, 100),
      total_content: mediaInPeriod.length, // Actual count of posts in period
    });

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'completed',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString(),
          error_message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
        })
        .eq('id', syncLogId);
    }

    return {
      clientId,
      clientName,
      platform: 'instagram',
      success: true,
      recordsSynced,
    };
  } catch (error) {
    console.error(`Error syncing Instagram for ${clientName}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Update sync log with error
    if (syncLogId) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq('id', syncLogId);
    }
    
    return {
      clientId,
      clientName,
      platform: 'instagram',
      success: false,
      error: errorMsg,
    };
  }
}
