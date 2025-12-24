import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId } = await req.json();

    if (!channelId) {
      throw new Error('Channel ID is required');
    }

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

    console.log(`Fetching channel info for: ${channelId}`);

    // Fetch channel info from YouTube API
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${youtubeApiKey}`
    );
    const channelData = await channelResponse.json();

    if (channelData.error) {
      throw new Error(channelData.error.message || 'YouTube API error');
    }

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found. Please check the Channel ID.');
    }

    const channel = channelData.items[0];
    const channelName = channel.snippet.title;
    const channelUrl = `https://youtube.com/channel/${channelId}`;
    const thumbnailUrl = channel.snippet.thumbnails?.default?.url || null;
    const subscriberCount = parseInt(channel.statistics.subscriberCount) || 0;
    const videoCount = parseInt(channel.statistics.videoCount) || 0;

    // Upsert the channel into youtube_assets
    const { data, error } = await supabase
      .from('youtube_assets')
      .upsert({
        channel_id: channelId,
        channel_name: channelName,
        channel_url: channelUrl,
        thumbnail_url: thumbnailUrl,
        subscriber_count: subscriberCount,
        video_count: videoCount,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'channel_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save channel: ${error.message}`);
    }

    console.log(`Successfully added channel: ${channelName}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        channelId,
        channelName,
        subscriberCount,
        videoCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in youtube-add-channel:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
