import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  unique_clicks?: string;
  inline_link_clicks?: string;
  link_clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: Array<{ action_type: string; value: string }>;
  website_purchase_roas?: Array<{ action_type: string; value: string }>;
}

const safeDivide = (numerator: number, denominator: number, multiplier = 1): number => {
  if (denominator === 0) return 0;
  return (numerator / denominator) * multiplier;
};

const parseNumber = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(parsed) ? 0 : parsed;
};

const extractPurchaseMetrics = (actions?: MetaAction[], actionValues?: MetaAction[]) => {
  const purchaseKeys = ['purchase', 'offsite_conversion.purchase', 'omni_purchase', 'onsite_web_purchase'];
  
  let purchases = 0;
  let revenue = 0;
  
  if (actions) {
    for (const action of actions) {
      if (purchaseKeys.some(key => action.action_type.includes(key))) {
        purchases += parseNumber(action.value);
      }
    }
  }
  
  if (actionValues) {
    for (const actionValue of actionValues) {
      if (purchaseKeys.some(key => actionValue.action_type.includes(key))) {
        revenue += parseNumber(actionValue.value);
      }
    }
  }
  
  return { purchases, revenue };
};

const extractRoas = (purchaseRoas?: Array<{ action_type: string; value: string }>, websitePurchaseRoas?: Array<{ action_type: string; value: string }>): number => {
  const roasArr = purchaseRoas || websitePurchaseRoas;
  if (!roasArr || roasArr.length === 0) return 0;
  
  for (const item of roasArr) {
    if (item.action_type.includes('purchase')) {
      return parseNumber(item.value);
    }
  }
  return parseNumber(roasArr[0]?.value);
};

const fetchAllInsights = async (
  accessToken: string,
  adAccountId: string,
  apiVersion: string,
  since: string,
  until: string,
  level: string,
  breakdowns?: string
): Promise<MetaInsightRow[]> => {
  const fields = [
    'date_start', 'date_stop', 'account_id', 'account_name',
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'ad_id', 'ad_name', 'objective',
    'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'unique_clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm',
    'actions', 'action_values', 'purchase_roas', 'website_purchase_roas'
  ].join(',');

  const timeRange = JSON.stringify({
    since,
    until,
  });

  let url = `https://graph.facebook.com/${apiVersion}/${adAccountId}/insights?` +
    `access_token=${accessToken}` +
    `&fields=${fields}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1` +
    `&level=${level}` +
    `&limit=500`;

  if (breakdowns) {
    url += `&breakdowns=${breakdowns}`;
  }

  const allRows: MetaInsightRow[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    console.log(`Fetching Meta Insights for sync: ${nextUrl.substring(0, 100)}...`);
    
    const response = await fetch(nextUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API Error:', data.error);
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    if (data.data && Array.isArray(data.data)) {
      allRows.push(...data.data);
    }

    nextUrl = data.paging?.next || null;
  }

  console.log(`Fetched ${allRows.length} insight rows for sync`);
  return allRows;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    const level = url.searchParams.get('level') || 'campaign';
    const breakdowns = url.searchParams.get('breakdowns') || undefined;
    const clientId = url.searchParams.get('clientId');

    if (!since || !until || !clientId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: since, until, clientId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const apiVersion = Deno.env.get('META_API_VERSION') || 'v20.0';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_ACCESS_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adAccountId) {
      return new Response(
        JSON.stringify({ success: false, error: 'META_AD_ACCOUNT_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch insights from Meta
    const insights = await fetchAllInsights(accessToken, adAccountId, apiVersion, since, until, level, breakdowns);

    if (insights.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, updated: 0, message: 'No data to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing records for the date range to do a clean upsert
    const { error: deleteError } = await supabase
      .from('meta_ads_daily')
      .delete()
      .eq('client_id', clientId)
      .eq('level', level)
      .gte('date_start', since)
      .lte('date_start', until);

    if (deleteError) {
      console.error('Delete error:', deleteError);
    }

    // Transform and insert rows
    const rows = insights.map((row) => {
      const spend = parseNumber(row.spend);
      const impressions = parseNumber(row.impressions);
      const reach = parseNumber(row.reach);
      const linkClicks = parseNumber(row.link_clicks) || parseNumber(row.inline_link_clicks);
      const uniqueClicks = parseNumber(row.unique_clicks);
      
      const { purchases, revenue } = extractPurchaseMetrics(row.actions, row.action_values);
      
      let roas = extractRoas(row.purchase_roas, row.website_purchase_roas);
      if (roas === 0 && spend > 0) {
        roas = safeDivide(revenue, spend);
      }
      
      const ctr = parseNumber(row.ctr) || safeDivide(linkClicks, impressions, 100);
      const cpc = parseNumber(row.cpc) || safeDivide(spend, linkClicks);
      const cpm = parseNumber(row.cpm) || safeDivide(spend, impressions, 1000);

      return {
        client_id: clientId,
        date_start: row.date_start,
        level,
        campaign_id: row.campaign_id || null,
        campaign_name: row.campaign_name || null,
        adset_id: row.adset_id || null,
        adset_name: row.adset_name || null,
        ad_id: row.ad_id || null,
        ad_name: row.ad_name || null,
        objective: row.objective || null,
        spend,
        impressions,
        reach,
        link_clicks: linkClicks,
        unique_clicks: uniqueClicks,
        ctr,
        cpc,
        cpm,
        purchases,
        revenue,
        roas,
        breakdowns: breakdowns ? { type: breakdowns } : null,
        raw_actions: row.actions || [],
        updated_at: new Date().toISOString(),
      };
    });

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('meta_ads_daily')
        .insert(batch);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Failed to insert batch: ${insertError.message}`);
      }
      inserted += batch.length;
    }

    console.log(`Synced ${inserted} rows to meta_ads_daily`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        message: `Successfully synced ${inserted} rows`,
        meta: {
          since,
          until,
          level,
          breakdowns,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-ads-sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
