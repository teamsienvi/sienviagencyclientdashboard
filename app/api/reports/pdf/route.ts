import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentReportingWeek, formatDateRangeFull, formatDateRange } from "@/utils/weeklyDateRange";
import { getClientBrandTheme } from "@/config/clientBrandThemes";
import { generateWeeklyReportPdf, WeeklyPdfReportData, RankedContentItem } from "@/server/reports/weeklyPdfGenerator";
import { rankTopInsights, TopInsightContent } from "@/utils/topPerformingInsights";

const SOCIAL_PLATFORMS = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "twitter", "pinterest", "threads"]);

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  twitter: "X (Twitter)",
  threads: "Threads",
  pinterest: "Pinterest",
  reddit: "Reddit",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "Missing required clientId parameter" }, { status: 400 });
    }

    // Determine weekly reporting window (Monday to Sunday with automated Sunday rollover)
    const reportingWeek = getCurrentReportingWeek();
    const startDate = reportingWeek.start;
    const endDate = reportingWeek.end;
    const dateLabel = formatDateRangeFull(startDate, endDate);
    const dateShort = formatDateRange(startDate, endDate);

    // ISO date strings for Supabase queries
    const startISO = startDate.toISOString().split("T")[0];
    const endISO = endDate.toISOString().split("T")[0];

    // Initialize Supabase client — use service role to bypass RLS for report data aggregation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
    const DEFAULT_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1MzcwNywiZXhwIjoyMDg3NTI5NzA3fQ.hB-L59qE7061eR_FXnZ_Uh8I5pUqD8zq9IRV9en4uRA";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;
    const supabase = createSupabaseClient(supabaseUrl, serviceKey);

    // 1. Fetch Client Info
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, logo_url")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const brandTheme = getClientBrandTheme(client.name);

    // 2. Fetch Connected Configurations & Ecosystem
    const [
      { data: ga4Config },
      { data: metricoolConfigs },
      { data: metaOauth },
      { data: ytMap },
      { data: xAccounts },
      { data: shopifyOauth },
      { data: metaAdsConfig },
      { data: ubersuggestConfig },
      { data: gscData },
      { data: latestSummaryRow },
      { data: accountMetrics },
    ] = await Promise.all([
      supabase.from("client_ga4_config").select("ga4_property_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_metricool_config").select("platform, followers").eq("client_id", clientId).eq("is_active", true),
      supabase.from("social_oauth_accounts").select("platform, account_id, account_name").eq("client_id", clientId).eq("is_active", true),
      supabase.from("client_youtube_map").select("channel_id, channel_title").eq("client_id", clientId).eq("active", true),
      supabase.from("social_accounts").select("id, platform, account_handle").eq("client_id", clientId).eq("platform", "x").eq("is_active", true),
      supabase.from("shopify_oauth_connections").select("id, shop_domain").eq("client_id", clientId).eq("is_active", true),
      supabase.from("client_meta_ads_config").select("id").eq("client_id", clientId).eq("is_active", true),
      supabase.from("client_ubersuggest_config" as any).select("id").eq("client_id", clientId).eq("is_active", true),
      supabase.from("report_gsc_metrics" as any).select("id").eq("client_id", clientId).limit(1),
      supabase.from("analytics_summaries" as any).select("summary_data, generated_at, type, period_start, period_end").eq("client_id", clientId).order("generated_at", { ascending: false }).limit(10),
      supabase.from("social_account_metrics").select("platform, followers, new_followers, period_start, period_end, views, impressions, engagements, collected_at").eq("client_id", clientId).order("collected_at", { ascending: false }).limit(200),
    ]);

    // Determine Active Social Channels
    const activeSocialSet = new Set<string>();
    (metricoolConfigs || []).forEach((c) => {
      const p = c.platform?.toLowerCase();
      if (SOCIAL_PLATFORMS.has(p)) activeSocialSet.add(p);
    });
    (metaOauth || []).forEach((m) => {
      const p = m.platform?.toLowerCase();
      if (SOCIAL_PLATFORMS.has(p)) activeSocialSet.add(p);
    });
    if (ytMap && ytMap.length > 0) activeSocialSet.add("youtube");
    if (xAccounts && xAccounts.length > 0) activeSocialSet.add("x");

    // Ecosystem Status
    const hasSocial = activeSocialSet.size > 0;
    const hasAds = !!(metaAdsConfig && metaAdsConfig.length > 0) || (metricoolConfigs || []).some(c => c.platform?.includes("ads"));
    const hasWebEcomm = !!ga4Config?.ga4_property_id || !!(shopifyOauth && shopifyOauth.length > 0);
    const hasSeo = !!(ubersuggestConfig && (ubersuggestConfig as any[]).length > 0) || !!(gscData && (gscData as any[]).length > 0);

    const activeChannelsList: string[] = [];
    activeSocialSet.forEach(p => activeChannelsList.push(PLATFORM_NAMES[p] || p.toUpperCase()));
    if (hasWebEcomm) activeChannelsList.push("Web / Shopify");
    if (hasAds) activeChannelsList.push("Paid Advertising");
    if (hasSeo) activeChannelsList.push("SEO Search");

    // 3. Process Live Follower Counts and Period Gains
    const followerMap: Record<string, number> = {};
    const followerGainMap: Record<string, number> = {};

    // Group account metrics by platform
    const byPlatformMetrics: Record<string, any[]> = {};
    (accountMetrics || []).forEach((m) => {
      const p = (m.platform || "").toLowerCase();
      if (!byPlatformMetrics[p]) byPlatformMetrics[p] = [];
      byPlatformMetrics[p].push(m);
    });

    Object.entries(byPlatformMetrics).forEach(([platform, points]) => {
      const sorted = [...points].sort((a, b) => (b.period_end || "").localeCompare(a.period_end || ""));
      // Prefer weekly rows
      const weeklyRows = sorted.filter((p) => {
        if (!p.period_start || !p.period_end) return false;
        const span = Math.round((new Date(p.period_end).getTime() - new Date(p.period_start).getTime()) / 86400000);
        return span >= 5 && span <= 8;
      });

      const activeRow = weeklyRows[0] || sorted[0];
      if (activeRow) {
        followerMap[platform] = activeRow.followers || 0;
        followerGainMap[platform] = activeRow.new_followers || 0;
      }
    });

    // Fallback: fill follower presets from config
    (metricoolConfigs || []).forEach((c) => {
      const p = (c.platform || "").toLowerCase();
      if (c.followers && (!followerMap[p] || followerMap[p] === 0)) {
        followerMap[p] = c.followers;
      }
    });

    // Fallback: call Metricool API for platforms still missing follower data
    const socialPlatformsNeedingFollowers = Array.from(activeSocialSet).filter(
      p => (!followerMap[p] || followerMap[p] === 0) && ["instagram", "facebook", "tiktok", "linkedin", "pinterest"].includes(p)
    );
    if (socialPlatformsNeedingFollowers.length > 0) {
      const metricoolResults = await Promise.allSettled(
        socialPlatformsNeedingFollowers.map(async (platform) => {
          const { data, error } = await supabase.functions.invoke("metricool-social-weekly", {
            body: { clientId, platform, from: startISO, to: endISO },
          });
          if (error || !data?.success) return { platform, followers: 0, gained: 0 };
          const timeline = data.data?.current?.followersTimeline || [];
          const lastPoint = timeline.length > 0 ? timeline[timeline.length - 1] : null;
          const firstPoint = timeline.length > 0 ? timeline[0] : null;
          const gain = (lastPoint && firstPoint) ? lastPoint.value - firstPoint.value : 0;
          return { platform, followers: lastPoint?.value || 0, gained: gain };
        })
      );
      metricoolResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value.followers > 0) {
          followerMap[result.value.platform] = result.value.followers;
          if (!followerGainMap[result.value.platform] || followerGainMap[result.value.platform] === 0) {
            followerGainMap[result.value.platform] = result.value.gained;
          }
        }
      });
    }

    // 4. Fetch Social Content WITHIN the reporting period and Compute Performance Scoring
    const { data: postsRaw } = await supabase
      .from("social_content")
      .select("id, platform, published_at, title, url, content_id")
      .eq("client_id", clientId)
      .gte("published_at", startDate.toISOString())
      .lte("published_at", endDate.toISOString())
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(500);

    const postIds = (postsRaw || []).map((p) => p.id);
    const chunkSize = 100;
    const metricsRaw: any[] = [];

    for (let i = 0; i < postIds.length; i += chunkSize) {
      const chunk = postIds.slice(i, i + chunkSize);
      const { data: chunkMetrics } = await supabase
        .from("social_content_metrics")
        .select("social_content_id, views, impressions, reach, likes, comments, shares, engagements, period_end, collected_at")
        .in("social_content_id", chunk);

      if (chunkMetrics && chunkMetrics.length > 0) {
        metricsRaw.push(...chunkMetrics);
      }
    }

    const metricsByPost: Record<string, any[]> = {};
    for (const m of metricsRaw) {
      if (!metricsByPost[m.social_content_id]) metricsByPost[m.social_content_id] = [];
      metricsByPost[m.social_content_id].push(m);
    }

    const platformAggregates: Record<string, { views: number; engagements: number; postCount: number }> = {};
    const insightContentList: TopInsightContent[] = [];

    let computedTotalViews = 0;
    let computedTotalEngagements = 0;

    for (const post of postsRaw || []) {
      const plat = (post.platform || "").toLowerCase();
      const pMetrics = metricsByPost[post.id] || [];

      let pViews = 0;
      let pReach = 0;
      let pLikes = 0;
      let pComments = 0;
      let pShares = 0;

      if (pMetrics.length > 0) {
        for (const sm of pMetrics) {
          const v = sm.views || sm.impressions || 0;
          if (v >= pViews) {
            pViews = v;
            pReach = sm.reach || v;
            pLikes = sm.likes || 0;
            pComments = sm.comments || 0;
            pShares = sm.shares || 0;
          }
        }
      }

      const pEngagements = pLikes + pComments + pShares;

      if (activeSocialSet.has(plat)) {
        computedTotalViews += pViews;
        computedTotalEngagements += pEngagements;

        if (!platformAggregates[plat]) {
          platformAggregates[plat] = { views: 0, engagements: 0, postCount: 0 };
        }
        platformAggregates[plat].views += pViews;
        platformAggregates[plat].engagements += pEngagements;
        platformAggregates[plat].postCount++;
      }

      let postUrl = post.url;
      if (!postUrl && post.content_id) {
        const cleanId = String(post.content_id).replace(/^(youtube|tiktok|fb|facebook|ig|instagram)_/i, "");
        if (plat === "youtube") postUrl = `https://www.youtube.com/watch?v=${cleanId}`;
        else if (plat === "tiktok") postUrl = `https://www.tiktok.com/video/${cleanId}`;
        else if (plat === "facebook") postUrl = `https://facebook.com/${cleanId}`;
        else if (plat === "instagram") postUrl = `https://www.instagram.com/p/${cleanId}`;
      }

      insightContentList.push({
        id: post.id,
        post_url: postUrl || "",
        title: post.title || "Social Media Post",
        platform: PLATFORM_NAMES[plat] || plat.toUpperCase(),
        published_at: post.published_at || new Date().toISOString(),
        views: pViews,
        reach: pReach || pViews,
        likes: pLikes,
        comments: pComments,
        shares: pShares,
        followers_at_post_time: followerMap[plat] || 0,
      });
    }

    // Rank top insights using Sienvi Performance Index Framework
    const rankedInsights = rankTopInsights(insightContentList, 10);
    const topContentList: RankedContentItem[] = rankedInsights.map((r) => ({
      title: r.title || "Creative Post Asset",
      platform: r.platform,
      views: r.views,
      engagements: r.likes + r.comments + r.shares,
      engagementRate: r.engagement_percentage,
      reachTier: r.reach_tier,
      engagementTier: r.engagement_tier,
      performanceTier: r.performance_tier,
      totalScore: r.total_score,
      postUrl: r.post_url,
      publishedAt: r.published_at ? new Date(r.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined,
    }));

    // 5. Build Platform Breakdown Table
    let totalFollowers = 0;
    let totalFollowersGained = 0;
    const platformBreakdown: WeeklyPdfReportData["platforms"] = [];

    const platformsToRender = activeSocialSet.size > 0 ? Array.from(activeSocialSet) : Object.keys(platformAggregates);
    for (const plat of platformsToRender) {
      const followers = followerMap[plat] || 0;
      const gained = followerGainMap[plat] || 0;
      const stat = platformAggregates[plat] || { views: 0, engagements: 0, postCount: 0 };
      const engRate = stat.views > 0 ? (stat.engagements / stat.views) * 100 : 0;

      totalFollowers += followers;
      totalFollowersGained += gained;

      platformBreakdown.push({
        platform: plat,
        displayName: PLATFORM_NAMES[plat] || plat.charAt(0).toUpperCase() + plat.slice(1),
        followers,
        newFollowers: gained,
        engagementRate: engRate,
        views: stat.views,
        engagements: stat.engagements,
        postCount: stat.postCount,
      });
    }

    platformBreakdown.sort((a, b) => b.followers - a.followers || b.views - a.views);

    // 6. Extract Real AI Teardown from analytics_summaries
    // Fetch all types and merge: prefer social for social clients, website/seo for others
    const summaryRows = (latestSummaryRow as any[]) || [];
    
    // Group summaries by type, picking the best (period-closest) entry per type
    const summaryByType: Record<string, any> = {};
    for (const s of summaryRows) {
      const t = s.type || "social";
      if (summaryByType[t]) continue; // already have a newer one
      summaryByType[t] = s;
    }

    // Pick the primary summary: only consider types the client actually has configured
    const allowedTypes: string[] = [];
    if (hasSocial) allowedTypes.push("social");
    if (hasWebEcomm) allowedTypes.push("website");
    if (hasSeo) allowedTypes.push("seo");
    if (hasAds) allowedTypes.push("ads");
    // Fallback: if nothing is configured, allow any type so the report isn't completely empty
    if (allowedTypes.length === 0) allowedTypes.push("social", "website", "seo");

    const primarySummary = allowedTypes.map(t => summaryByType[t]).find(Boolean) || summaryRows[0] || null;
    const rawAiSummary = primarySummary?.summary_data || null;
    const aiMetrics = rawAiSummary?.metrics || {};

    // Merge insights ONLY from summary types the client actually uses
    const mergedStrengths: string[] = [];
    const mergedWeaknesses: string[] = [];
    const mergedActions: string[] = [];
    const mergedHighlights: string[] = [];
    
    for (const t of allowedTypes) {
      const s = summaryByType[t]?.summary_data;
      if (!s) continue;
      if (s.strengths) mergedStrengths.push(...s.strengths);
      if (s.weaknesses) mergedWeaknesses.push(...s.weaknesses);
      if (s.smartActions) mergedActions.push(...s.smartActions);
      if (s.highlights) mergedHighlights.push(...s.highlights);
    }

    // For website-only clients (like HAIRtamin), use website/seo metrics as KPIs
    const websiteSummary = summaryByType["website"]?.summary_data?.metrics || {};
    const seoSummary = summaryByType["seo"]?.summary_data?.metrics || {};

    // Determine final KPIs: social data first, then website, then seo
    const socialViews = computedTotalViews;
    const socialEng = computedTotalEngagements;
    const hasRealSocialData = socialViews > 0 || platformBreakdown.length > 0;

    let finalTotalViews: number;
    let finalTotalEngagements: number;
    let finalEngRate: number;
    let finalTopPlatform: string;

    if (hasRealSocialData) {
      // Social client: use social metrics
      finalTotalViews = aiMetrics.total_views && aiMetrics.total_views > 0 ? aiMetrics.total_views : socialViews;
      finalTotalEngagements = aiMetrics.total_interactions && aiMetrics.total_interactions > 0 ? aiMetrics.total_interactions : socialEng;
      finalEngRate = aiMetrics.engagement_rate && aiMetrics.engagement_rate > 0 
        ? aiMetrics.engagement_rate 
        : (finalTotalViews > 0 ? (finalTotalEngagements / finalTotalViews) * 100 : 0);
      finalTopPlatform = aiMetrics.top_platform || (platformBreakdown[0]?.displayName ?? "Social Media");
    } else {
      // Website/SEO-only client (e.g., HAIRtamin): use website and SEO metrics
      finalTotalViews = websiteSummary.total_views || websiteSummary.total_sessions || seoSummary.gsc_clicks || 0;
      finalTotalEngagements = websiteSummary.unique_visitors || websiteSummary.total_users || seoSummary.gsc_impressions || 0;
      finalEngRate = websiteSummary.engagement_rate || (100 - (websiteSummary.bounce_rate || 0)) || 0;
      finalTopPlatform = websiteSummary.top_source || seoSummary.top_keyword || "Website";
    }

    const finalFollowersGained = aiMetrics.followers_gained !== undefined ? aiMetrics.followers_gained : totalFollowersGained;

    const aiTeardown = {
      strengths: mergedStrengths.length > 0 ? mergedStrengths : (rawAiSummary?.strengths || []),
      weaknesses: mergedWeaknesses.length > 0 ? mergedWeaknesses : (rawAiSummary?.weaknesses || []),
      smartActions: mergedActions.length > 0 ? mergedActions : (rawAiSummary?.smartActions || []),
      highlights: mergedHighlights.length > 0 ? mergedHighlights : (rawAiSummary?.highlights || []),
    };

    // 7. Assemble Report Data Payload
    const reportData: WeeklyPdfReportData = {
      client: {
        id: client.id,
        name: client.name,
        logo_url: client.logo_url,
      },
      brandTheme,
      period: {
        start: startISO,
        end: endISO,
        label: dateLabel,
        isCurrentWeek: true,
      },
      connectedChannelsCount: activeChannelsList.length || 1,
      channelScopes: activeChannelsList,
      metrics: {
        totalViews: finalTotalViews,
        totalEngagements: finalTotalEngagements,
        avgEngagementRate: finalEngRate,
        totalFollowers: totalFollowers,
        followersGained: finalFollowersGained,
        topPlatform: finalTopPlatform,
      },
      aiTeardown,
      platforms: platformBreakdown,
      topContent: topContentList,
      ecosystem: {
        hasSocial,
        hasAds,
        hasWebEcomm,
        hasSeo,
        activeChannelsList,
      },
    };

    // 8. Generate PDF
    const pdfBuffer = await generateWeeklyReportPdf(reportData);

    const safeClientSlug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${safeClientSlug}-weekly-report-${dateShort.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[Weekly PDF API Error]:", error);
    return NextResponse.json({ error: "Failed to generate weekly report PDF", details: error?.message }, { status: 500 });
  }
}

