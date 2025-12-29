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

    for (const mapping of mappings) {
      const clientId = mapping.client_id;
      const clientName = mapping.clients?.name || 'Unknown';

      // Sync Facebook if page_id is mapped
      if (mapping.page_id && pageTokens[mapping.page_id]) {
        for (const p of periods) {
          const result = await syncFacebookPage(
            supabase,
            clientId,
            clientName,
            mapping.page_id,
            pageTokens[mapping.page_id],
            p.start,
            p.end
          );
          results.push({ ...result, periodStart: p.start, periodEnd: p.end });
        }
        agencySyncedClients.add(`${clientId}_facebook`);
      }

      // Sync Instagram if ig_business_id is mapped
      if (mapping.ig_business_id) {
        const parentPageId = igParentPageMap[mapping.ig_business_id];
        const accessToken = parentPageId ? pageTokens[parentPageId] : null;

        if (accessToken) {
          for (const p of periods) {
            const result = await syncInstagramAccount(
              supabase,
              clientId,
              clientName,
              mapping.ig_business_id,
              accessToken,
              p.start,
              p.end
            );
            results.push({ ...result, periodStart: p.start, periodEnd: p.end });
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

        const periods = [
          { start: periodStartStr, end: periodEndStr },
          { start: prevPeriodStartStr, end: prevPeriodEndStr },
        ];

        if (platform === 'instagram' && account.instagram_business_id) {
          for (const p of periods) {
            const result = await syncInstagramAccount(
              supabase,
              clientId,
              clientName,
              account.instagram_business_id,
              account.access_token,
              p.start,
              p.end
            );
            results.push({ ...result, periodStart: p.start, periodEnd: p.end });
          }
        } else if (platform === 'facebook' && account.page_id) {
          for (const p of periods) {
            const result = await syncFacebookPage(
              supabase,
              clientId,
              clientName,
              account.page_id,
              account.access_token,
              p.start,
              p.end
            );
            results.push({ ...result, periodStart: p.start, periodEnd: p.end });
          }
        }
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

async function syncFacebookPage(
  supabase: any,
  clientId: string,
  clientName: string,
  pageId: string,
  accessToken: string,
  periodStart: string,
  periodEnd: string
): Promise<SyncResult> {
  try {
    console.log(`Syncing Facebook page ${pageId} for client ${clientName}`);

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

    // Fetch page info
    const pageResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${accessToken}`
    );
    const pageData = await pageResponse.json();

    if (pageData.error) {
      throw new Error(pageData.error.message);
    }

    const followers = pageData.followers_count || pageData.fan_count || 0;

    // Fetch page-level insights for reach (more reliable than post-level)
    let pageReach = 0;
    let pageImpressions = 0;
    try {
      const pageInsightsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions,page_impressions_unique&period=week&access_token=${accessToken}`
      );
      const pageInsightsData = await pageInsightsResponse.json();
      
      if (!pageInsightsData.error && pageInsightsData.data) {
        for (const insight of pageInsightsData.data) {
          if (insight.name === 'page_impressions_unique') {
            pageReach = insight.values?.[insight.values.length - 1]?.value || 0;
          }
          if (insight.name === 'page_impressions') {
            pageImpressions = insight.values?.[insight.values.length - 1]?.value || 0;
          }
        }
        console.log(`Got page insights for ${pageId}: reach=${pageReach}, impressions=${pageImpressions}`);
      }
    } catch (e) {
      console.log(`Could not fetch page insights:`, e);
    }

    // Fetch posts
    const postsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)&limit=25&access_token=${accessToken}`
    );
    const postsData = await postsResponse.json();

    let recordsSynced = 0;
    let totalEngagement = 0;
    let postsInPeriod = 0;

    for (const post of postsData.data || []) {
      const postDate = new Date(post.created_time);
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      periodEndDate.setHours(23, 59, 59, 999);
      
      const isInPeriod = postDate >= periodStartDate && postDate <= periodEndDate;
      
      const likes = post.reactions?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;

      // Fetch per-post insights for reach
      let postReach = 0;
      let postImpressions = 0;
      try {
        const postInsightsResp = await fetch(
          `https://graph.facebook.com/v21.0/${post.id}/insights?metric=post_impressions_unique,post_impressions&access_token=${accessToken}`
        );
        if (postInsightsResp.ok) {
          const postInsightsData = await postInsightsResp.json();
          for (const insight of postInsightsData.data || []) {
            const val = insight.values?.[0]?.value || 0;
            if (insight.name === 'post_impressions_unique') postReach = val;
            if (insight.name === 'post_impressions') postImpressions = val;
          }
        }
      } catch (e) {
        console.log(`Could not fetch post insights for ${post.id}:`, e);
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
        // Insert metrics with per-post reach
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

        if (isInPeriod) {
          totalEngagement += likes + comments + shares;
          postsInPeriod++;
        }
        recordsSynced++;
      }
    }

    // Insert account metrics - use posts in period, not total fetched
    const engagementRate = followers > 0 ? (totalEngagement / followers) * 100 : 0;

    await supabase.from('social_account_metrics').insert({
      client_id: clientId,
      platform: 'facebook',
      period_start: periodStart,
      period_end: periodEnd,
      followers,
      engagement_rate: Math.min(engagementRate, 100), // Cap at 100% for sanity
      total_content: postsInPeriod, // Use actual posts in period
    });

    // Update sync log
    if (syncLog) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'completed',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
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
    return {
      clientId,
      clientName,
      platform: 'facebook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
  try {
    console.log(`Syncing Instagram account ${igBusinessId} for client ${clientName}`);

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

    // Fetch account info
    const accountResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const accountData = await accountResponse.json();

    if (accountData.error) {
      throw new Error(accountData.error.message);
    }

    const followers = accountData.followers_count || 0;

    // Fetch media
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}/media?fields=id,caption,timestamp,permalink,media_type,like_count,comments_count&limit=25&access_token=${accessToken}`
    );
    const mediaData = await mediaResponse.json();

    let recordsSynced = 0;
    let totalEngagement = 0;
    let totalReach = 0;
    let postsInPeriod = 0;

    for (const media of mediaData.data || []) {
      const mediaDate = new Date(media.timestamp);
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      periodEndDate.setHours(23, 59, 59, 999); // Include end of day
      
      const isInPeriod = mediaDate >= periodStartDate && mediaDate <= periodEndDate;
      
      const likes = media.like_count || 0;
      const comments = media.comments_count || 0;

      // Determine content type
      let contentType = 'post';
      if (media.media_type === 'VIDEO') contentType = 'reel';
      else if (media.media_type === 'CAROUSEL_ALBUM') contentType = 'carousel';

      // Upsert content
      const { data: contentData } = await supabase
        .from('social_content')
        .upsert({
          client_id: clientId,
          platform: 'instagram',
          content_id: media.id,
          title: media.caption?.substring(0, 100) || null,
          url: media.permalink,
          published_at: media.timestamp,
          content_type: contentType,
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentData) {
        // Fetch insights for this media
        let reach = 0;
        let impressions = 0;
        let saved = 0;

        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v21.0/${media.id}/insights?metric=reach,saved,total_interactions&access_token=${accessToken}`
          );
          const insightsData = await insightsResponse.json();
          
          if (insightsData.error) {
            console.log(`Insights error for media ${media.id} (${media.media_type}): ${insightsData.error.message}`);
          } else {
            for (const insight of insightsData.data || []) {
              if (insight.name === 'reach') reach = insight.values?.[0]?.value || 0;
              if (insight.name === 'saved') saved = insight.values?.[0]?.value || 0;
              if (insight.name === 'total_interactions') impressions = insight.values?.[0]?.value || 0;
            }
          }
        } catch (e) {
          console.log(`Exception fetching insights for media ${media.id}:`, e);
        }

        await supabase.from('social_content_metrics').insert({
          social_content_id: contentData.id,
          platform: 'instagram',
          period_start: periodStart,
          period_end: periodEnd,
          likes,
          comments,
          reach,
          impressions,
          shares: saved,
        });

        // Only count engagement for posts IN the period
        if (isInPeriod) {
          totalReach += reach;
          totalEngagement += likes + comments + saved;
          postsInPeriod++;
        }
        recordsSynced++;
      }
    }

    // Insert account metrics - use posts in period, not total fetched
    const engagementRate = followers > 0 ? (totalEngagement / followers) * 100 : 0;

    await supabase.from('social_account_metrics').insert({
      client_id: clientId,
      platform: 'instagram',
      period_start: periodStart,
      period_end: periodEnd,
      followers,
      engagement_rate: Math.min(engagementRate, 100), // Cap at 100% for sanity
      total_content: postsInPeriod, // Use actual posts in period
    });

    // Update sync log
    if (syncLog) {
      await supabase
        .from('social_sync_logs')
        .update({
          status: 'completed',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
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
    return {
      clientId,
      clientName,
      platform: 'instagram',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
