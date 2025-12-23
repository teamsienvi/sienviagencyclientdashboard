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
    const { code, state, redirectUri } = await req.json();
    
    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!metaAppId || !metaAppSecret) {
      throw new Error('Meta app credentials not configured');
    }

    // Decode state to get clientId and platform
    const decodedState = JSON.parse(atob(decodeURIComponent(state)));
    const { clientId, platform } = decodedState;

    console.log('Processing OAuth callback for client:', clientId, 'platform:', platform);

    // Exchange code for access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", metaAppId);
    tokenUrl.searchParams.set("client_secret", metaAppSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData.error);
      throw new Error(tokenData.error.message || 'Failed to exchange code for token');
    }

    const { access_token: shortLivedToken } = tokenData;

    // Exchange for long-lived token
    const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", metaAppId);
    longLivedUrl.searchParams.set("client_secret", metaAppSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);
    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    if (longLivedData.error) {
      console.error('Long-lived token error:', longLivedData.error);
      throw new Error(longLivedData.error.message || 'Failed to get long-lived token');
    }

    const { access_token: longLivedToken, expires_in } = longLivedData;
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000);

    // Get user info
    const userResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${longLivedToken}`);
    const userData = await userResponse.json();
    const metaUserId = userData.id;

    console.log('Got Meta user ID:', metaUserId);

    // Get pages and Instagram accounts
    let pageId = null;
    let instagramBusinessId = null;
    let pageAccessToken = longLivedToken;

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`,
    );
    const pagesData = await pagesResponse.json();

    if (pagesData?.error) {
      console.error("Pages list error:", pagesData.error);
      throw new Error(
        "Meta permissions missing for Pages access. Please disconnect and reconnect to grant Facebook Pages permissions.",
      );
    }
    if (pagesData.data && pagesData.data.length > 0) {
      const page = pagesData.data[0];
      pageId = page.id;

      if (!page.access_token) {
        throw new Error(
          "Meta did not return a Page access token. Please reconnect and ensure you approve all requested permissions.",
        );
      }

      pageAccessToken = page.access_token;

      console.log("Found page:", pageId);

      // Get Instagram business account if platform is instagram
      if (platform === "instagram") {
        const igResponse = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`,
        );
        const igData = await igResponse.json();

        if (igData?.error) {
          console.error("Instagram business lookup error:", igData.error);
          throw new Error(
            "Unable to access Instagram business account. Please reconnect and grant Instagram + Pages permissions.",
          );
        }

        if (igData.instagram_business_account) {
          instagramBusinessId = igData.instagram_business_account.id;
          console.log("Found Instagram business account:", instagramBusinessId);
        }
      }
    }
    // Store in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingAccount } = await supabase
      .from('social_oauth_accounts')
      .select('id')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .single();

    const accountData = {
      client_id: clientId,
      platform,
      meta_user_id: metaUserId,
      page_id: pageId,
      instagram_business_id: instagramBusinessId,
      access_token: pageAccessToken,
      user_access_token: longLivedToken, // Store user token for listing all pages
      token_expires_at: tokenExpiresAt.toISOString(),
      is_active: true,
    };

    let result;
    if (existingAccount) {
      result = await supabase
        .from('social_oauth_accounts')
        .update(accountData)
        .eq('id', existingAccount.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('social_oauth_accounts')
        .insert(accountData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Database error:', result.error);
      throw new Error('Failed to save OAuth account');
    }

    console.log('OAuth account saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        account: {
          platform,
          pageId,
          instagramBusinessId,
          connected: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-oauth-callback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
