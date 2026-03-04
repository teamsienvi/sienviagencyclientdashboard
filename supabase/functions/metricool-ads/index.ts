import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta Ads Campaign
interface MetaCampaign {
  name: string;
  status: string;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  spent: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  purchaseRoas: number;
  conversionValue: number;
  actions?: Record<string, number>;
  campaignId?: string;
}

// Google Ads Campaign
interface GoogleCampaign {
  name: string;
  objective: string;
  providerCampaignId: string;
  impressions: number;
  clicks: number;
  spent: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  purchaseROAS: number;
  allConversionsValue: number;
}

// TikTok Ads Campaign
interface TikTokAdsCampaign {
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  spent: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversionValue: number;
  reach: number;
  videoViews: number;
  campaignId?: string;
}

interface MetaAggregatedData {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  conversionValue: number;
  actions: Record<string, number>;
  campaigns: MetaCampaign[];
}

interface GoogleAggregatedData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  allConversionsValue: number;
  campaigns: GoogleCampaign[];
}

interface TikTokAdsAggregatedData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  reach: number;
  videoViews: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  campaigns: TikTokAdsCampaign[];
}

interface TimelineDataPoint {
  date: string;
  value: number;
}

interface TimelineData {
  spend: TimelineDataPoint[];
  impressions: TimelineDataPoint[];
  reach: TimelineDataPoint[];
  clicks: TimelineDataPoint[];
}

interface AdsResponse {
  metaAds: {
    current: MetaAggregatedData;
    previous: MetaAggregatedData;
    timeline: TimelineData;
  } | null;
  googleAds: {
    current: GoogleAggregatedData;
    previous: GoogleAggregatedData;
  } | null;
  tiktokAds: {
    current: TikTokAdsAggregatedData;
    previous: TikTokAdsAggregatedData;
  } | null;
  upstreamDebug?: {
    meta?: {
      currentWeek?: { status: number; body: string; url: string };
      prevWeek?: { status: number; body: string; url: string };
      timeline?: Record<string, { status: number; body: string; url: string }>;
    };
    google?: {
      currentWeek?: { status: number; body: string; url: string };
      prevWeek?: { status: number; body: string; url: string };
    };
    tiktok?: {
      currentWeek?: { status: number; body: string; url: string };
      prevWeek?: { status: number; body: string; url: string };
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, from, to, prevFrom, prevTo } = await req.json();

    if (!clientId || !from || !to || !prevFrom || !prevTo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required params: clientId, from, to, prevFrom, prevTo"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate client access
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (user && !authError) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const isAdmin = roleData?.role === "admin";

        if (!isAdmin) {
          const { data: accessData } = await supabase
            .from("client_users")
            .select("id")
            .eq("user_id", user.id)
            .eq("client_id", clientId)
            .maybeSingle();

          if (!accessData) {
            return new Response(
              JSON.stringify({ success: false, error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Load client's metricool config
    const { data: configList } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id, platform")
      .eq("client_id", clientId)
      .eq("is_active", true);

    if (!configList || configList.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { metaAds: null, googleAds: null },
          message: "No Metricool config found for this client"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configList[0];
    const userId = config.user_id;
    const blogId = config.blog_id;

    // Gather all distinct google_ads blog_ids for multi-account support
    const googleAdsBlogIds = [...new Set(
      configList
        .filter(c => c.platform === 'google_ads')
        .map(c => c.blog_id)
    )];
    // If no specific google_ads config, fall back to the primary blog_id
    if (googleAdsBlogIds.length === 0) googleAdsBlogIds.push(blogId);

    console.log(`[metricool-ads] Fetching Ads for:`, { clientId, userId, blogId, googleAdsBlogIds, from, to });

    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");
    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formatDate = (dateStr: string) => dateStr.replace(/-/g, "");

    // ========== META ADS ==========
    const fetchMetaCampaigns = async (fromDate: string, toDate: string): Promise<{ campaigns: MetaCampaign[] | null; debug: { status: number; body: string; url: string } }> => {
      const params = new URLSearchParams({
        start: formatDate(fromDate),
        end: formatDate(toDate),
        userId: userId,
        blogId: blogId || "",
      });

      const url = `https://app.metricool.com/api/stats/facebookads/campaigns?${params.toString()}`;
      console.log(`[metricool-ads] Fetching Meta campaigns: ${url}`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-mc-auth": METRICOOL_AUTH, "Accept": "application/json" },
        });

        const responseText = await res.text();
        console.log(`[metricool-ads] Meta campaigns response: ${res.status}`);

        if (!res.ok) {
          return { campaigns: null, debug: { status: res.status, body: responseText, url } };
        }

        let data;
        try { data = JSON.parse(responseText); } catch {
          return { campaigns: null, debug: { status: res.status, body: `Invalid JSON`, url } };
        }

        if (!Array.isArray(data) || data.length === 0) {
          return { campaigns: [], debug: { status: res.status, body: responseText, url } };
        }

        // Log the first campaign's raw data for debugging ROAS fields
        if (data.length > 0) {
          const sample = data[0];
          console.log(`[metricool-ads] Raw Meta campaign fields:`, {
            name: sample.name,
            conversions: sample.conversions,
            // Note: Metricool uses purchaseROAS (capital ROAS)
            purchaseROAS: sample.purchaseROAS,
            conversionsValue: sample.conversionsValue,
            allConversionsValue: sample.allConversionsValue,
            costPerConversion: sample.costPerConversion,
            conversionRate: sample.conversionRate,
          });
        }

        const campaigns: MetaCampaign[] = data.map((c: Record<string, unknown>) => {
          const spent = Number(c.spent) || 0;
          const actions = c.actions as Record<string, number> || {};

          // Look for ROAS - Metricool uses purchaseROAS (capital ROAS)
          let purchaseRoas = Number(c.purchaseROAS) || Number(c.purchaseRoas) || Number(c.purchase_roas) || 0;

          // Look for conversion value - Metricool uses conversionsValue
          let conversionValue = Number(c.conversionsValue) || Number(c.conversionValue) ||
            Number(c.allConversionsValue) || 0;

          // Check in actions object for ROAS and purchase values
          if (actions) {
            if (!purchaseRoas) {
              purchaseRoas = Number(actions.purchase_roas) || Number(actions.omni_purchase_roas) ||
                Number(actions.website_purchase_roas) || 0;
            }
            if (!conversionValue) {
              conversionValue = Number(actions.omni_purchase) || Number(actions.purchase) ||
                Number(actions.website_purchases_value) || 0;
            }
          }

          // Calculate ROAS if we have conversion value but no ROAS
          if (!purchaseRoas && conversionValue > 0 && spent > 0) {
            purchaseRoas = conversionValue / spent;
          }

          return {
            name: String(c.name || "Unknown"),
            status: String(c.status || "unknown"),
            impressions: Number(c.impressions) || 0,
            reach: Number(c.reach) || 0,
            clicks: Number(c.clicks) || 0,
            uniqueClicks: Number(c.uniqueClicks) || 0,
            spent,
            ctr: Number(c.ctr) || 0,
            cpc: Number(c.cpc) || 0,
            cpm: Number(c.cpm) || 0,
            conversions: Number(c.conversions) || 0,
            purchaseRoas,
            conversionValue,
            actions,
            campaignId: c.id ? String(c.id) : (c.campaignId ? String(c.campaignId) : (c.providerCampaignId ? String(c.providerCampaignId) : undefined)),
          };
        });

        return { campaigns, debug: { status: res.status, body: responseText.substring(0, 500), url } };
      } catch (err) {
        console.error(`[metricool-ads] Meta error:`, err);
        return { campaigns: null, debug: { status: 0, body: String(err), url } };
      }
    };

    // ========== GOOGLE ADS ==========
    const fetchGoogleCampaigns = async (fromDate: string, toDate: string, overrideBlogId?: string): Promise<{ campaigns: GoogleCampaign[] | null; debug: { status: number; body: string; url: string } }> => {
      const params = new URLSearchParams({
        start: formatDate(fromDate),
        end: formatDate(toDate),
        userId: userId,
        blogId: overrideBlogId || blogId || "",
      });

      const url = `https://app.metricool.com/api/stats/adwords/campaigns?${params.toString()}`;
      console.log(`[metricool-ads] Fetching Google campaigns: ${url}`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-mc-auth": METRICOOL_AUTH, "Accept": "application/json" },
        });

        const responseText = await res.text();
        console.log(`[metricool-ads] Google campaigns response: ${res.status}`);

        if (!res.ok) {
          return { campaigns: null, debug: { status: res.status, body: responseText, url } };
        }

        let data;
        try { data = JSON.parse(responseText); } catch {
          return { campaigns: null, debug: { status: res.status, body: `Invalid JSON`, url } };
        }

        if (!Array.isArray(data) || data.length === 0) {
          return { campaigns: [], debug: { status: res.status, body: responseText, url } };
        }

        const campaigns: GoogleCampaign[] = data.map((c: Record<string, unknown>) => ({
          name: String(c.name || "Unknown"),
          objective: String(c.objective || ""),
          providerCampaignId: String(c.providerCampaignId || ""),
          impressions: Number(c.impressions) || 0,
          clicks: Number(c.clicks) || 0,
          spent: Number(c.spent) || 0,
          ctr: Number(c.ctr) || 0,
          cpc: Number(c.cpc) || 0,
          cpm: Number(c.cpm) || 0,
          conversions: Number(c.conversions) || 0,
          purchaseROAS: Number(c.purchaseROAS) || 0,
          allConversionsValue: Number(c.allConversionsValue) || 0,
        }));

        return { campaigns, debug: { status: res.status, body: responseText.substring(0, 200), url } };
      } catch (err) {
        console.error(`[metricool-ads] Google error:`, err);
        return { campaigns: null, debug: { status: 0, body: String(err), url } };
      }
    };

    // ========== TIKTOK ADS ==========
    const fetchTikTokAdsCampaigns = async (fromDate: string, toDate: string): Promise<{ campaigns: TikTokAdsCampaign[] | null; debug: { status: number; body: string; url: string } }> => {
      const params = new URLSearchParams({
        start: formatDate(fromDate),
        end: formatDate(toDate),
        userId: userId,
        blogId: blogId || "",
      });

      const url = `https://app.metricool.com/api/stats/tiktokads/campaigns?${params.toString()}`;
      console.log(`[metricool-ads] Fetching TikTok Ads campaigns: ${url}`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-mc-auth": METRICOOL_AUTH, "Accept": "application/json" },
        });

        const responseText = await res.text();
        console.log(`[metricool-ads] TikTok Ads campaigns response: ${res.status}`);

        if (!res.ok) {
          return { campaigns: null, debug: { status: res.status, body: responseText, url } };
        }

        let data;
        try { data = JSON.parse(responseText); } catch {
          return { campaigns: null, debug: { status: res.status, body: `Invalid JSON`, url } };
        }

        if (!Array.isArray(data) || data.length === 0) {
          return { campaigns: [], debug: { status: res.status, body: responseText, url } };
        }

        const campaigns: TikTokAdsCampaign[] = data.map((c: Record<string, unknown>) => {
          const spent = Number(c.spent) || 0;
          let conversionValue = Number(c.conversionsValue) || Number(c.conversionValue) || Number(c.allConversionsValue) || 0;

          return {
            name: String(c.name || "Unknown"),
            status: String(c.status || "unknown"),
            impressions: Number(c.impressions) || 0,
            reach: Number(c.reach) || 0,
            clicks: Number(c.clicks) || 0,
            spent,
            ctr: Number(c.ctr) || 0,
            cpc: Number(c.cpc) || 0,
            cpm: Number(c.cpm) || 0,
            conversions: Number(c.conversions) || 0,
            conversionValue,
            videoViews: Number(c.videoViews) || Number(c.video_views) || 0,
            campaignId: c.id ? String(c.id) : (c.campaignId ? String(c.campaignId) : (c.providerCampaignId ? String(c.providerCampaignId) : undefined)),
          };
        });

        return { campaigns, debug: { status: res.status, body: responseText.substring(0, 500), url } };
      } catch (err) {
        console.error(`[metricool-ads] TikTok Ads error:`, err);
        return { campaigns: null, debug: { status: 0, body: String(err), url } };
      }
    };

    // Fetch timeline
    const fetchTimeline = async (metric: string, fromDate: string, toDate: string): Promise<{ data: TimelineDataPoint[]; debug: { status: number; body: string; url: string } }> => {
      const params = new URLSearchParams({
        start: formatDate(fromDate),
        end: formatDate(toDate),
        userId: userId,
        blogId: blogId || "",
      });

      const url = `https://app.metricool.com/api/stats/timeline/${metric}?${params.toString()}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-mc-auth": METRICOOL_AUTH, "Accept": "application/json" },
        });

        const responseText = await res.text();
        if (!res.ok) return { data: [], debug: { status: res.status, body: responseText, url } };

        let data;
        try { data = JSON.parse(responseText); } catch {
          return { data: [], debug: { status: res.status, body: `Invalid JSON`, url } };
        }

        let timelineData: TimelineDataPoint[] = [];
        if (Array.isArray(data) && data.length > 0) {
          if (Array.isArray(data[0]) && data[0].length === 2) {
            timelineData = data.map(([ts, val]: [number | string, number]) => ({
              date: typeof ts === 'number' ? new Date(ts).toISOString().split('T')[0] : String(ts),
              value: Number(val) || 0,
            }));
          } else if (typeof data[0] === 'object') {
            timelineData = data.map((item: Record<string, unknown>) => ({
              date: String(item.date || item.day || ''),
              value: Number(item.value || item.count || 0),
            }));
          }
        } else if (typeof data === 'object' && data !== null) {
          timelineData = Object.entries(data).map(([date, value]) => ({
            date,
            value: Number(value) || 0,
          }));
        }

        timelineData.sort((a, b) => a.date.localeCompare(b.date));
        return { data: timelineData, debug: { status: res.status, body: responseText.substring(0, 200), url } };
      } catch (err) {
        return { data: [], debug: { status: 0, body: String(err), url } };
      }
    };

    // Aggregate Meta campaigns
    const aggregateMetaCampaigns = (campaigns: MetaCampaign[]): MetaAggregatedData => {
      const result: MetaAggregatedData = {
        spend: 0, impressions: 0, reach: 0, clicks: 0, uniqueClicks: 0,
        conversions: 0, ctr: 0, cpc: 0, cpm: 0, roas: 0, conversionValue: 0, actions: {}, campaigns,
      };

      for (const c of campaigns) {
        result.spend += c.spent || 0;
        result.impressions += c.impressions || 0;
        result.reach += c.reach || 0;
        result.clicks += c.clicks || 0;
        result.uniqueClicks += c.uniqueClicks || 0;
        result.conversions += c.conversions || 0;
        result.conversionValue += c.conversionValue || 0;
        if (c.actions) {
          for (const [key, value] of Object.entries(c.actions)) {
            result.actions[key] = (result.actions[key] || 0) + (Number(value) || 0);
          }
        }
      }

      if (result.impressions > 0) {
        result.ctr = (result.clicks / result.impressions) * 100;
        result.cpm = (result.spend / result.impressions) * 1000;
      }
      if (result.clicks > 0) result.cpc = result.spend / result.clicks;
      if (result.spend > 0 && result.conversionValue > 0) {
        result.roas = result.conversionValue / result.spend;
      }

      return result;
    };

    // Aggregate Google campaigns
    const aggregateGoogleCampaigns = (campaigns: GoogleCampaign[]): GoogleAggregatedData => {
      const result: GoogleAggregatedData = {
        spend: 0, impressions: 0, clicks: 0, conversions: 0,
        ctr: 0, cpc: 0, cpm: 0, roas: 0, allConversionsValue: 0, campaigns,
      };

      for (const c of campaigns) {
        result.spend += c.spent || 0;
        result.impressions += c.impressions || 0;
        result.clicks += c.clicks || 0;
        result.conversions += c.conversions || 0;
        result.allConversionsValue += c.allConversionsValue || 0;
      }

      if (result.impressions > 0) {
        result.ctr = (result.clicks / result.impressions) * 100;
        result.cpm = (result.spend / result.impressions) * 1000;
      }
      if (result.clicks > 0) result.cpc = result.spend / result.clicks;
      if (result.spend > 0) result.roas = result.allConversionsValue / result.spend;

      return result;
    };

    // Aggregate TikTok Ads campaigns
    const aggregateTikTokAdsCampaigns = (campaigns: TikTokAdsCampaign[]): TikTokAdsAggregatedData => {
      const result: TikTokAdsAggregatedData = {
        spend: 0, impressions: 0, clicks: 0, conversions: 0,
        conversionValue: 0, reach: 0, videoViews: 0,
        ctr: 0, cpc: 0, cpm: 0, roas: 0, campaigns,
      };

      for (const c of campaigns) {
        result.spend += c.spent || 0;
        result.impressions += c.impressions || 0;
        result.clicks += c.clicks || 0;
        result.conversions += c.conversions || 0;
        result.conversionValue += c.conversionValue || 0;
        result.reach += c.reach || 0;
        result.videoViews += c.videoViews || 0;
      }

      if (result.impressions > 0) {
        result.ctr = (result.clicks / result.impressions) * 100;
        result.cpm = (result.spend / result.impressions) * 1000;
      }
      if (result.clicks > 0) result.cpc = result.spend / result.clicks;
      if (result.spend > 0 && result.conversionValue > 0) {
        result.roas = result.conversionValue / result.spend;
      }

      return result;
    };

    // Fetch Google Ads from all blog_ids (multi-account)
    const fetchAllGoogleCampaigns = async (fromDate: string, toDate: string) => {
      const results = await Promise.all(
        googleAdsBlogIds.map(bid => fetchGoogleCampaigns(fromDate, toDate, bid))
      );
      // Merge all campaigns from all accounts
      const allCampaigns: GoogleCampaign[] = [];
      let firstDebug = results[0]?.debug || { status: 0, body: '', url: '' };
      for (const r of results) {
        if (r.campaigns) allCampaigns.push(...r.campaigns);
      }
      return { campaigns: allCampaigns.length > 0 ? allCampaigns : null, debug: firstDebug };
    };

    // Fetch all data in parallel
    const [
      metaCurrentResult, metaPrevResult,
      googleCurrentResult, googlePrevResult,
      tiktokCurrentResult, tiktokPrevResult,
      spendTimeline, impressionsTimeline, reachTimeline, clicksTimeline
    ] = await Promise.all([
      fetchMetaCampaigns(from, to),
      fetchMetaCampaigns(prevFrom, prevTo),
      fetchAllGoogleCampaigns(from, to),
      fetchAllGoogleCampaigns(prevFrom, prevTo),
      fetchTikTokAdsCampaigns(from, to),
      fetchTikTokAdsCampaigns(prevFrom, prevTo),
      fetchTimeline("adSpend", from, to),
      fetchTimeline("adImpressions", from, to),
      fetchTimeline("adReach", from, to),
      fetchTimeline("adClicks", from, to),
    ]);

    // Build debug info
    const upstreamDebug: AdsResponse["upstreamDebug"] = {};

    // Meta debug
    const metaDebug: NonNullable<AdsResponse["upstreamDebug"]>["meta"] = {};
    if (metaCurrentResult.campaigns === null) metaDebug.currentWeek = metaCurrentResult.debug;
    if (metaPrevResult.campaigns === null) metaDebug.prevWeek = metaPrevResult.debug;
    if (Object.keys(metaDebug).length > 0) upstreamDebug.meta = metaDebug;

    // Google debug
    const googleDebug: NonNullable<AdsResponse["upstreamDebug"]>["google"] = {};
    if (googleCurrentResult.campaigns === null) googleDebug.currentWeek = googleCurrentResult.debug;
    if (googlePrevResult.campaigns === null) googleDebug.prevWeek = googlePrevResult.debug;
    if (Object.keys(googleDebug).length > 0) upstreamDebug.google = googleDebug;

    // TikTok debug
    const tiktokDebug: NonNullable<AdsResponse["upstreamDebug"]>["tiktok"] = {};
    if (tiktokCurrentResult.campaigns === null) tiktokDebug.currentWeek = tiktokCurrentResult.debug;
    if (tiktokPrevResult.campaigns === null) tiktokDebug.prevWeek = tiktokPrevResult.debug;
    if (Object.keys(tiktokDebug).length > 0) upstreamDebug.tiktok = tiktokDebug;

    // Aggregate Meta
    const metaCurrentData = aggregateMetaCampaigns(metaCurrentResult.campaigns || []);
    const metaPreviousData = aggregateMetaCampaigns(metaPrevResult.campaigns || []);

    // Aggregate Google
    const googleCurrentData = aggregateGoogleCampaigns(googleCurrentResult.campaigns || []);
    const googlePreviousData = aggregateGoogleCampaigns(googlePrevResult.campaigns || []);

    // Aggregate TikTok Ads
    const tiktokCurrentData = aggregateTikTokAdsCampaigns(tiktokCurrentResult.campaigns || []);
    const tiktokPreviousData = aggregateTikTokAdsCampaigns(tiktokPrevResult.campaigns || []);

    // Timeline
    const timeline: TimelineData = {
      spend: spendTimeline.data,
      impressions: impressionsTimeline.data,
      reach: reachTimeline.data,
      clicks: clicksTimeline.data,
    };

    console.log(`[metricool-ads] Meta aggregated:`, { spend: metaCurrentData.spend, campaigns: metaCurrentData.campaigns.length });
    console.log(`[metricool-ads] Google aggregated:`, { spend: googleCurrentData.spend, campaigns: googleCurrentData.campaigns.length });
    console.log(`[metricool-ads] TikTok Ads aggregated:`, { spend: tiktokCurrentData.spend, campaigns: tiktokCurrentData.campaigns.length });

    // Check for meaningful data
    const hasMetaData = metaCurrentData.spend > 0 || metaCurrentData.impressions > 0 ||
      metaPreviousData.spend > 0 || metaCurrentData.campaigns.length > 0;
    const hasGoogleData = googleCurrentData.spend > 0 || googleCurrentData.impressions > 0 ||
      googlePreviousData.spend > 0 || googleCurrentData.campaigns.length > 0;
    const hasTikTokData = tiktokCurrentData.spend > 0 || tiktokCurrentData.impressions > 0 ||
      tiktokPreviousData.spend > 0 || tiktokCurrentData.campaigns.length > 0;

    const response: AdsResponse = {
      metaAds: hasMetaData ? { current: metaCurrentData, previous: metaPreviousData, timeline } : null,
      googleAds: hasGoogleData ? { current: googleCurrentData, previous: googlePreviousData } : null,
      tiktokAds: hasTikTokData ? { current: tiktokCurrentData, previous: tiktokPreviousData } : null,
    };

    if (Object.keys(upstreamDebug).length > 0) response.upstreamDebug = upstreamDebug;

    return new Response(
      JSON.stringify({
        success: true,
        data: response,
        debug: { userId, blogId }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[metricool-ads] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: { metaAds: null, googleAds: null }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
