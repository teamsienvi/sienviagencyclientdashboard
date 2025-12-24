import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  clientId: string;
  clientName: string;
  channelId: string;
  channelName: string;
  success: boolean;
  recordsSynced?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active client-youtube mappings with client and channel info
    const { data: mappings, error: mapError } = await supabase
      .from('client_youtube_map')
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

    console.log(`Found ${mappings.length} active YouTube mappings to sync`);

    // Get channel names
    const { data: channelAssets } = await supabase
      .from('youtube_assets')
      .select('channel_id, channel_name');

    const channelNames: Record<string, string> = {};
    for (const asset of channelAssets || []) {
      channelNames[asset.channel_id] = asset.channel_name;
    }

    const results: SyncResult[] = [];
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = now.toISOString().split('T')[0];

    for (const mapping of mappings) {
      const clientId = mapping.client_id;
      const clientName = mapping.clients?.name || 'Unknown';
      const channelId = mapping.channel_id;
      const channelName = channelNames[channelId] || 'Unknown Channel';

      try {
        console.log(`Syncing YouTube channel ${channelId} for client ${clientName}`);

        // Create sync log
        const { data: syncLog } = await supabase
          .from('social_sync_logs')
          .insert({
            client_id: clientId,
            platform: 'youtube',
            status: 'running',
          })
          .select()
          .single();

        // Fetch channel info
        const channelResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${youtubeApiKey}`
        );
        const channelData = await channelResponse.json();

        if (channelData.error) {
          throw new Error(channelData.error.message);
        }

        if (!channelData.items || channelData.items.length === 0) {
          throw new Error('Channel not found');
        }

        const channel = channelData.items[0];
        const subscribers = parseInt(channel.statistics.subscriberCount) || 0;
        const totalVideos = parseInt(channel.statistics.videoCount) || 0;
        const totalViews = parseInt(channel.statistics.viewCount) || 0;

        // Update youtube_assets with latest info
        await supabase
          .from('youtube_assets')
          .update({
            subscriber_count: subscribers,
            video_count: totalVideos,
            last_seen_at: new Date().toISOString(),
          })
          .eq('channel_id', channelId);

        // Fetch recent videos
        const videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&order=date&maxResults=25&type=video&key=${youtubeApiKey}`
        );
        const videosData = await videosResponse.json();

        let recordsSynced = 0;
        let totalLikes = 0;
        let totalComments = 0;

        if (videosData.items && videosData.items.length > 0) {
          const videoIds = videosData.items.map((v: any) => v.id.videoId).join(',');
          
          // Fetch video details
          const videoDetailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${youtubeApiKey}`
          );
          const videoDetails = await videoDetailsResponse.json();

          for (const video of videoDetails.items || []) {
            const views = parseInt(video.statistics.viewCount) || 0;
            const likes = parseInt(video.statistics.likeCount) || 0;
            const comments = parseInt(video.statistics.commentCount) || 0;

            // Determine content type
            let contentType = 'video';
            const duration = video.contentDetails?.duration || '';
            if (duration && duration.match(/PT\d+S/) && !duration.includes('M')) {
              contentType = 'short';
            }

            // Upsert content
            const { data: contentData } = await supabase
              .from('social_content')
              .upsert({
                client_id: clientId,
                platform: 'youtube',
                content_id: video.id,
                title: video.snippet.title?.substring(0, 100) || null,
                url: `https://youtube.com/watch?v=${video.id}`,
                published_at: video.snippet.publishedAt,
                content_type: contentType,
              }, { onConflict: 'client_id,platform,content_id' })
              .select()
              .single();

            if (contentData) {
              // Insert metrics
              await supabase.from('social_content_metrics').insert({
                social_content_id: contentData.id,
                platform: 'youtube',
                period_start: periodStartStr,
                period_end: periodEndStr,
                views,
                likes,
                comments,
                shares: 0,
                reach: views,
                impressions: views,
              });

              totalLikes += likes;
              totalComments += comments;
              recordsSynced++;
            }
          }
        }

        // Insert account metrics
        const engagementRate = subscribers > 0 ? ((totalLikes + totalComments) / subscribers) * 100 : 0;

        await supabase.from('social_account_metrics').insert({
          client_id: clientId,
          platform: 'youtube',
          period_start: periodStartStr,
          period_end: periodEndStr,
          followers: subscribers,
          engagement_rate: engagementRate,
          total_content: recordsSynced,
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

        results.push({
          clientId,
          clientName,
          channelId,
          channelName,
          success: true,
          recordsSynced,
        });
      } catch (error) {
        console.error(`Error syncing YouTube for ${clientName}:`, error);
        results.push({
          clientId,
          clientName,
          channelId,
          channelName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`YouTube sync completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalMappings: mappings.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-youtube-agency:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
