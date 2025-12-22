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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get any active OAuth account to use the token (they all share the same meta_user_id)
    const { data: oauthAccount, error: oauthError } = await supabase
      .from('social_oauth_accounts')
      .select('access_token, meta_user_id, token_expires_at')
      .eq('is_active', true)
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (oauthError || !oauthAccount) {
      console.log('No active OAuth account found');
      return new Response(
        JSON.stringify({ pages: [], error: 'No active Meta connection found. Connect at least one client first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiry
    const tokenExpiry = new Date(oauthAccount.token_expires_at);
    if (tokenExpiry < new Date()) {
      return new Response(
        JSON.stringify({ pages: [], error: 'Meta token has expired. Please reconnect any client.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all pages with their Instagram business accounts
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture{url}&access_token=${oauthAccount.access_token}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('Pages fetch error:', pagesData.error);
      return new Response(
        JSON.stringify({ pages: [], error: pagesData.error.message || 'Failed to fetch pages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Instagram business account for each page
    const pagesWithInstagram = await Promise.all(
      (pagesData.data || []).map(async (page: any) => {
        const igResponse = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${page.access_token}`
        );
        const igData = await igResponse.json();

        return {
          pageId: page.id,
          pageName: page.name,
          pagePicture: page.picture?.data?.url || null,
          pageAccessToken: page.access_token,
          instagramBusinessId: igData.instagram_business_account?.id || null,
          instagramUsername: igData.instagram_business_account?.username || null,
          instagramPicture: igData.instagram_business_account?.profile_picture_url || null,
        };
      })
    );

    // Get current assignments
    const { data: assignments } = await supabase
      .from('social_oauth_accounts')
      .select('client_id, page_id, instagram_business_id, platform')
      .eq('is_active', true);

    // Get client names
    const clientIds = [...new Set((assignments || []).map(a => a.client_id))];
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds.length > 0 ? clientIds : ['none']);

    const clientMap = new Map((clients || []).map(c => [c.id, c.name]));

    const pagesWithAssignments = pagesWithInstagram.map(page => {
      const assignment = (assignments || []).find(a => a.page_id === page.pageId);
      return {
        ...page,
        assignedClientId: assignment?.client_id || null,
        assignedClientName: assignment ? clientMap.get(assignment.client_id) || null : null,
      };
    });

    console.log(`Found ${pagesWithAssignments.length} pages`);

    return new Response(
      JSON.stringify({ pages: pagesWithAssignments, metaUserId: oauthAccount.meta_user_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-meta-pages:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
