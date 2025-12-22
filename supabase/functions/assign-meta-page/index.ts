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
    const { clientId, pageId, pageAccessToken, instagramBusinessId, metaUserId } = await req.json();
    
    if (!clientId || !pageId || !pageAccessToken || !metaUserId) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get token expiry from any existing account with same meta_user_id
    const { data: existingAccount } = await supabase
      .from('social_oauth_accounts')
      .select('token_expires_at')
      .eq('meta_user_id', metaUserId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const tokenExpiresAt = existingAccount?.token_expires_at || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    // Check if this client already has an assignment
    const { data: existing } = await supabase
      .from('social_oauth_accounts')
      .select('id')
      .eq('client_id', clientId)
      .eq('platform', 'instagram')
      .single();

    const accountData = {
      client_id: clientId,
      platform: 'instagram',
      meta_user_id: metaUserId,
      page_id: pageId,
      instagram_business_id: instagramBusinessId,
      access_token: pageAccessToken,
      token_expires_at: tokenExpiresAt,
      is_active: true,
    };

    let result;
    if (existing) {
      result = await supabase
        .from('social_oauth_accounts')
        .update(accountData)
        .eq('id', existing.id)
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
      throw new Error('Failed to assign page to client');
    }

    console.log(`Assigned page ${pageId} to client ${clientId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in assign-meta-page:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
