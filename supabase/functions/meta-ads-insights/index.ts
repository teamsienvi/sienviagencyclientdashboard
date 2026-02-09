import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaAction {
  action_type: string;
  value: string;
}

interface CostPerAction {
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
  cost_per_action_type?: CostPerAction[];
  purchase_roas?: Array<{ action_type: string; value: string }>;
  website_purchase_roas?: Array<{ action_type: string; value: string }>;
  // Breakdown dimensions
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  impression_device?: string;
}

interface NormalizedRow {
  date_start: string;
  date_stop: string;
  account_id: string | null;
  account_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  link_clicks: number;
  unique_clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  revenue: number;
  roas: number;
  cost_per_purchase: number;
  breakdowns: {
    publisher_platform?: string;
    platform_position?: string;
    device_platform?: string;
    impression_device?: string;
  } | null;
  raw_actions: MetaAction[];
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

const extractPurchaseMetrics = (actions?: MetaAction[], actionValues?: MetaAction[], costPerAction?: CostPerAction[]) => {
  const purchaseKeys = ['purchase', 'offsite_conversion.purchase', 'omni_purchase', 'onsite_web_purchase'];
  
  let purchases = 0;
  let revenue = 0;
  let costPerPurchase = 0;
  
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

  if (costPerAction) {
    for (const cpa of costPerAction) {
      if (purchaseKeys.some(key => cpa.action_type.includes(key))) {
        costPerPurchase = parseNumber(cpa.value);
        break;
      }
    }
  }
  
  return { purchases, revenue, costPerPurchase };
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

const normalizeInsightRow = (row: MetaInsightRow): NormalizedRow => {
  const spend = parseNumber(row.spend);
  const impressions = parseNumber(row.impressions);
  const reach = parseNumber(row.reach);
  const clicks = parseNumber(row.clicks);
  const linkClicks = parseNumber(row.link_clicks) || parseNumber(row.inline_link_clicks);
  const uniqueClicks = parseNumber(row.unique_clicks);
  
  const { purchases, revenue, costPerPurchase } = extractPurchaseMetrics(row.actions, row.action_values, row.cost_per_action_type);
  
  // Extract ROAS from API or compute
  let roas = extractRoas(row.purchase_roas, row.website_purchase_roas);
  if (roas === 0 && spend > 0) {
    roas = safeDivide(revenue, spend);
  }
  
  // Compute derived metrics if missing
  const frequency = parseNumber(row.frequency) || safeDivide(impressions, reach);
  const ctr = parseNumber(row.ctr) || safeDivide(linkClicks, impressions, 100);
  const cpc = parseNumber(row.cpc) || safeDivide(spend, linkClicks);
  const cpm = parseNumber(row.cpm) || safeDivide(spend, impressions, 1000);

  // Build breakdowns object if any dimension is present
  const hasBreakdowns = row.publisher_platform || row.platform_position || row.device_platform || row.impression_device;
  const breakdowns = hasBreakdowns ? {
    publisher_platform: row.publisher_platform,
    platform_position: row.platform_position,
    device_platform: row.device_platform,
    impression_device: row.impression_device,
  } : null;
  
  return {
    date_start: row.date_start,
    date_stop: row.date_stop,
    account_id: row.account_id || null,
    account_name: row.account_name || null,
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
    frequency,
    clicks,
    link_clicks: linkClicks,
    unique_clicks: uniqueClicks,
    ctr,
    cpc,
    cpm,
    purchases,
    revenue,
    roas,
    cost_per_purchase: costPerPurchase || safeDivide(spend, purchases),
    breakdowns,
    raw_actions: row.actions || [],
  };
};

const aggregateRows = (rows: NormalizedRow[]): NormalizedRow => {
  const totals = rows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    impressions: acc.impressions + row.impressions,
    reach: acc.reach + row.reach,
    clicks: acc.clicks + row.clicks,
    linkClicks: acc.linkClicks + row.link_clicks,
    uniqueClicks: acc.uniqueClicks + row.unique_clicks,
    purchases: acc.purchases + row.purchases,
    revenue: acc.revenue + row.revenue,
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, uniqueClicks: 0, purchases: 0, revenue: 0 });

  return {
    date_start: rows[0]?.date_start || '',
    date_stop: rows[rows.length - 1]?.date_stop || '',
    account_id: rows[0]?.account_id || null,
    account_name: rows[0]?.account_name || null,
    campaign_id: rows[0]?.campaign_id || null,
    campaign_name: rows[0]?.campaign_name || null,
    adset_id: rows[0]?.adset_id || null,
    adset_name: rows[0]?.adset_name || null,
    ad_id: rows[0]?.ad_id || null,
    ad_name: rows[0]?.ad_name || null,
    objective: rows[0]?.objective || null,
    spend: totals.spend,
    impressions: totals.impressions,
    reach: totals.reach,
    frequency: safeDivide(totals.impressions, totals.reach),
    clicks: totals.clicks,
    link_clicks: totals.linkClicks,
    unique_clicks: totals.uniqueClicks,
    ctr: safeDivide(totals.linkClicks, totals.impressions, 100),
    cpc: safeDivide(totals.spend, totals.linkClicks),
    cpm: safeDivide(totals.spend, totals.impressions, 1000),
    purchases: totals.purchases,
    revenue: totals.revenue,
    roas: safeDivide(totals.revenue, totals.spend),
    cost_per_purchase: safeDivide(totals.spend, totals.purchases),
    breakdowns: null,
    raw_actions: [],
  };
};

const fetchAllInsights = async (
  accessToken: string,
  adAccountId: string,
  apiVersion: string,
  params: {
    since: string;
    until: string;
    level: string;
    timeIncrement: string;
    breakdowns?: string;
    campaignIds?: string[];
    adsetIds?: string[];
    adIds?: string[];
  }
): Promise<MetaInsightRow[]> => {
  const fields = [
    'date_start', 'date_stop', 'account_id', 'account_name',
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'ad_id', 'ad_name', 'objective',
    'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'unique_clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm',
    'actions', 'action_values', 'cost_per_action_type',
    'purchase_roas', 'website_purchase_roas'
  ].join(',');

  const timeRange = JSON.stringify({
    since: params.since,
    until: params.until,
  });

  // Build filtering array
  const filtering: Array<{ field: string; operator: string; value: string[] }> = [];
  if (params.campaignIds && params.campaignIds.length > 0) {
    filtering.push({ field: 'campaign.id', operator: 'IN', value: params.campaignIds });
  }
  if (params.adsetIds && params.adsetIds.length > 0) {
    filtering.push({ field: 'adset.id', operator: 'IN', value: params.adsetIds });
  }
  if (params.adIds && params.adIds.length > 0) {
    filtering.push({ field: 'ad.id', operator: 'IN', value: params.adIds });
  }

  let url = `https://graph.facebook.com/${apiVersion}/${adAccountId}/insights?` +
    `access_token=${accessToken}` +
    `&fields=${fields}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=${params.timeIncrement}` +
    `&level=${params.level}` +
    `&limit=500`;

  if (params.breakdowns) {
    url += `&breakdowns=${params.breakdowns}`;
  }

  if (filtering.length > 0) {
    url += `&filtering=${encodeURIComponent(JSON.stringify(filtering))}`;
  }

  const allRows: MetaInsightRow[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    console.log(`Fetching Meta Insights page (level=${params.level}, timeIncrement=${params.timeIncrement})...`);
    
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

  console.log(`Fetched ${allRows.length} insight rows`);
  return allRows;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Parse from URL params first
    let since = url.searchParams.get('since') || undefined;
    let until = url.searchParams.get('until') || undefined;
    let level = url.searchParams.get('level') || undefined;
    let timeIncrement = url.searchParams.get('time_increment') || undefined;
    let breakdowns = url.searchParams.get('breakdowns') || undefined;
    let campaignIds = url.searchParams.get('campaign_ids')?.split(',').filter(Boolean) || undefined;
    let adsetIds = url.searchParams.get('adset_ids')?.split(',').filter(Boolean) || undefined;
    let adIds = url.searchParams.get('ad_ids')?.split(',').filter(Boolean) || undefined;

    // Override with body if present
    if (req.method !== 'GET') {
      try {
        const body = await req.json();
        since = body?.since ?? since;
        until = body?.until ?? until;
        level = body?.level ?? level;
        timeIncrement = body?.time_increment ?? body?.timeIncrement ?? timeIncrement;
        breakdowns = body?.breakdowns ?? breakdowns;
        campaignIds = body?.campaign_ids ?? body?.campaignIds ?? campaignIds;
        adsetIds = body?.adset_ids ?? body?.adsetIds ?? adsetIds;
        adIds = body?.ad_ids ?? body?.adIds ?? adIds;
      } catch {
        // ignore invalid/missing body
      }
    }

    const resolvedLevel = level || 'campaign';
    const resolvedTimeIncrement = timeIncrement || '1'; // 1 = daily, 'all_days' = aggregate

    if (!since || !until) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: since, until' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const rawAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const adAccountId = rawAdAccountId
      ? (rawAdAccountId.trim().startsWith('act_') ? rawAdAccountId.trim() : `act_${rawAdAccountId.trim()}`)
      : null;
    const apiVersion = Deno.env.get('META_API_VERSION') || 'v20.0';

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

    // Fetch insights from Meta API
    const rawRows = await fetchAllInsights(accessToken, adAccountId, apiVersion, {
      since,
      until,
      level: resolvedLevel,
      timeIncrement: resolvedTimeIncrement,
      breakdowns,
      campaignIds,
      adsetIds,
      adIds,
    });

    // Normalize all rows
    const normalizedRows = rawRows.map(normalizeInsightRow);

    // If time_increment is all_days, rows are already aggregated by Meta
    // Otherwise, compute totals ourselves
    const totals = aggregateRows(normalizedRows);

    // For daily data charting (time_increment=1), group by date
    const byDay: Record<string, NormalizedRow> = {};
    if (resolvedTimeIncrement === '1') {
      normalizedRows.forEach(row => {
        const dateKey = row.date_start;
        if (!byDay[dateKey]) {
          byDay[dateKey] = { ...row };
        } else {
          // Aggregate same-day rows
          byDay[dateKey].spend += row.spend;
          byDay[dateKey].impressions += row.impressions;
          byDay[dateKey].reach += row.reach;
          byDay[dateKey].clicks += row.clicks;
          byDay[dateKey].link_clicks += row.link_clicks;
          byDay[dateKey].unique_clicks += row.unique_clicks;
          byDay[dateKey].purchases += row.purchases;
          byDay[dateKey].revenue += row.revenue;
        }
      });
      // Recalculate derived metrics for each day
      Object.values(byDay).forEach(day => {
        day.frequency = safeDivide(day.impressions, day.reach);
        day.ctr = safeDivide(day.link_clicks, day.impressions, 100);
        day.cpc = safeDivide(day.spend, day.link_clicks);
        day.cpm = safeDivide(day.spend, day.impressions, 1000);
        day.roas = safeDivide(day.revenue, day.spend);
        day.cost_per_purchase = safeDivide(day.spend, day.purchases);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        rows: normalizedRows,
        totals,
        by_day: Object.values(byDay).sort((a, b) => a.date_start.localeCompare(b.date_start)),
        meta: {
          count: normalizedRows.length,
          since,
          until,
          level: resolvedLevel,
          time_increment: resolvedTimeIncrement,
          breakdowns,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in meta-ads-insights:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
