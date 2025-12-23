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

    const accessToken = agencyConnection.access_token;
    console.log('Discovering pages with agency token...');

    // Fetch all pages the user manages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture{url},link&limit=100&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('Error fetching pages:', pagesData.error);
      throw new Error(pagesData.error.message || 'Failed to fetch pages');
    }

    const pages = pagesData.data || [];
    console.log(`Found ${pages.length} Facebook pages`);

    const discoveredAssets: any[] = [];
    const now = new Date().toISOString();

    for (const page of pages) {
      // Store/update Facebook page asset
      const { error: fbError } = await supabase
        .from('meta_assets')
        .upsert({
          platform: 'facebook',
          page_id: page.id,
          ig_business_id: null,
          name: page.name,
          picture_url: page.picture?.data?.url || null,
          permalink: page.link || null,
          last_seen_at: now,
        }, {
          onConflict: 'page_id',
        });

      if (fbError) {
        console.error(`Error upserting Facebook page ${page.id}:`, fbError);
      } else {
        discoveredAssets.push({
          platform: 'facebook',
          page_id: page.id,
          name: page.name,
        });
      }

      // Check for connected Instagram Business account
      try {
        const igResponse = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`
        );
        const igData = await igResponse.json();

        if (igData.instagram_business_account) {
          const ig = igData.instagram_business_account;
          const igName = ig.name || ig.username || `Instagram (${ig.id})`;
          
          const { error: igError } = await supabase
            .from('meta_assets')
            .upsert({
              platform: 'instagram',
              page_id: page.id, // Link to parent Facebook page
              ig_business_id: ig.id,
              name: igName,
              picture_url: ig.profile_picture_url || null,
              permalink: ig.username ? `https://instagram.com/${ig.username}` : null,
              last_seen_at: now,
            }, {
              onConflict: 'ig_business_id',
            });

          if (igError) {
            console.error(`Error upserting Instagram account ${ig.id}:`, igError);
          } else {
            discoveredAssets.push({
              platform: 'instagram',
              ig_business_id: ig.id,
              name: igName,
            });
          }
        }
      } catch (igErr) {
        console.error(`Error checking Instagram for page ${page.id}:`, igErr);
      }
    }

    console.log(`Discovered ${discoveredAssets.length} total assets`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesCount: pages.length,
        assetsCount: discoveredAssets.length,
        assets: discoveredAssets 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-discover:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
