import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const googleApiKey = Deno.env.get("GEMINI_API_KEY")
            || Deno.env.get("GOOGLE_API_KEY")
            || Deno.env.get("YOUTUBE_API_KEY");

        const keySource = Deno.env.get("GEMINI_API_KEY") ? "GEMINI_API_KEY"
            : Deno.env.get("GOOGLE_API_KEY") ? "GOOGLE_API_KEY"
                : Deno.env.get("YOUTUBE_API_KEY") ? "YOUTUBE_API_KEY" : "none";
        console.log("Using API key from:", keySource, "key prefix:", googleApiKey?.substring(0, 8) + "...");

        if (!googleApiKey) {
            throw new Error("No Gemini/Google API key configured. Set GEMINI_API_KEY, GOOGLE_API_KEY, or YOUTUBE_API_KEY");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { clientId, type, dateRange } = await req.json();

        if (!clientId || !type) {
            throw new Error("clientId and type are required");
        }
        if (type !== "social" && type !== "website" && type !== "lms" && type !== "ads") {
            throw new Error("type must be 'social', 'website', 'lms', or 'ads'");
        }

        console.log(`Generating ${type} summary for client ${clientId} (${dateRange || "7d"})`);

        // Fetch client info
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", clientId)
            .single();

        if (clientError || !client) {
            throw new Error(`Client not found: ${clientError?.message}`);
        }

        // Calculate date range based on param (default 7 days)
        const periodEnd = new Date();
        const periodStart = new Date();
        const daysToSubtract = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
        periodStart.setDate(periodStart.getDate() - daysToSubtract);
        const startStr = periodStart.toISOString().split("T")[0];
        const endStr = periodEnd.toISOString().split("T")[0];

        let analyticsContext = "";
        let collectedMetrics: any = {};

        if (type === "social") {
            const result = await collectSocialData(supabase, clientId, startStr, endStr);
            analyticsContext = result.context;
            collectedMetrics = result.metrics;
        } else if (type === "website") {
            const result = await collectWebsiteData(supabase, clientId, startStr, endStr);
            analyticsContext = result.context;
            collectedMetrics = result.metrics;
        } else if (type === "ads") {
            const result = await collectAdsData(supabase, clientId, startStr, endStr);
            analyticsContext = result.context;
            collectedMetrics = result.metrics;
        }

        if (!analyticsContext || analyticsContext.trim().length < 5) {
            // Return a structured "no data" response instead of throwing
            const noDataResponse = {
                strengths: ["Not enough data available yet to identify strengths."],
                weaknesses: ["Insufficient analytics data collected for this period."],
                smartActions: ["Ensure web trackers or Substack GA4 integrations are correctly configured."],
                highlights: ["Data collection is in progress — check back after more metrics are gathered."],
                metrics: {
                    total_views: 0,
                    engagement_rate: 0,
                    followers_gained: 0,
                    unique_visitors: 0,
                    total_sales: 0,
                    total_spend: 0,
                    total_conversions: 0,
                    roas: 0,
                    top_platform: "None"
                }
            };
            return new Response(JSON.stringify(noDataResponse), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Extract the list of platforms actually present in the data
        const detectedPlatforms = extractPlatforms(analyticsContext);
        console.log(`Detected platforms for ${client.name}:`, detectedPlatforms);

        // Call Gemini API
        const prompt = buildPrompt(client.name, type, analyticsContext, startStr, endStr, detectedPlatforms);
        const aiSummary = await callGemini(googleApiKey, prompt);

        // Merge metrics into the AI summary
        const summaryData = {
            ...aiSummary,
            metrics: {
                total_views: collectedMetrics.total_views || 0,
                engagement_rate: collectedMetrics.engagement_rate || 0,
                followers_gained: collectedMetrics.followers_gained || 0,
                unique_visitors: collectedMetrics.unique_visitors || 0,
                total_sales: collectedMetrics.total_sales || 0,
                total_spend: collectedMetrics.total_spend || 0,
                total_conversions: collectedMetrics.total_conversions || 0,
                roas: collectedMetrics.roas || 0,
                top_platform: collectedMetrics.top_platform || (detectedPlatforms.length > 0 ? detectedPlatforms[0] : "None"),
                ...collectedMetrics // Include any platform-specific metrics
            }
        };

        // Try to cache the result (non-blocking — if table doesn't exist, we still return data)
        try {
            await supabase
                .from("analytics_summaries")
                .upsert(
                    {
                        client_id: clientId,
                        type,
                        summary_data: summaryData,
                        period_start: startStr,
                        period_end: endStr,
                        generated_at: new Date().toISOString(),
                    },
                    { onConflict: "client_id,type" }
                );
        } catch (cacheErr) {
            console.warn("Failed to cache summary (table may not exist):", cacheErr);
        }

        return new Response(JSON.stringify(summaryData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error in generate-analytics-summary:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ─── Data Collection ────────────────────────────────────────────────────────

async function collectSocialData(
    supabase: any,
    clientId: string,
    startStr: string,
    endStr: string
): Promise<{ context: string; metrics: any }> {
    const sections: string[] = [];
    const metricsResult = {
        total_views: 0,
        engagement_rate: 0,
        followers_gained: 0,
        top_platform: "None"
    };

    // First, determine which platforms are currently connected/active for this client
    const activePlatforms = new Set<string>();

    // Check Metricool-connected platforms
    const { data: metricoolConfigs } = await supabase
        .from("client_metricool_config")
        .select("platform")
        .eq("client_id", clientId)
        .eq("is_active", true);

    if (metricoolConfigs) {
        metricoolConfigs.forEach((c: any) => {
            if (c.platform) activePlatforms.add(c.platform.toLowerCase());
        });
    }

    // Check social_accounts (X/Twitter, etc.)
    const { data: socialAccounts } = await supabase
        .from("social_accounts")
        .select("platform")
        .eq("client_id", clientId)
        .eq("is_active", true);

    if (socialAccounts) {
        socialAccounts.forEach((a: any) => {
            if (a.platform) activePlatforms.add(a.platform.toLowerCase());
        });
    }

    // Check Meta OAuth connections (Instagram/Facebook)
    const { data: metaOauth } = await supabase
        .from("social_oauth_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .limit(1);

    if (metaOauth && metaOauth.length > 0) {
        activePlatforms.add("instagram");
        activePlatforms.add("facebook");
    }

    // Check YouTube connection
    const { data: ytMap } = await supabase
        .from("client_youtube_map")
        .select("id")
        .eq("client_id", clientId)
        .eq("active", true)
        .limit(1);

    if (ytMap && ytMap.length > 0) {
        activePlatforms.add("youtube");
    }

    console.log(`Active platforms for client ${clientId}:`, [...activePlatforms]);

    // Helper to check if a platform name from data matches an active platform
    const isPlatformActive = (platform: string): boolean => {
        if (activePlatforms.size === 0) return true; // no config = include all
        const p = platform.toLowerCase();
        return activePlatforms.has(p) ||
            (p === "twitter" && activePlatforms.has("x")) ||
            (p === "x" && activePlatforms.has("twitter"));
    };

    // 0. Real-time Metricool Overview KPIs (Most accurate follower counts for AI)
    if (metricoolConfigs && metricoolConfigs.length > 0) {
        const prevEnd = new Date(startStr);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 7);
        const prevStartStr = prevStart.toISOString().split("T")[0];
        const prevEndStr = prevEnd.toISOString().split("T")[0];

        const liveMetrics: string[] = [];
        
        await Promise.all(metricoolConfigs.map(async (c: any) => {
            if (!c.platform) return;
            const platform = c.platform.toLowerCase();
            try {
                const { data, error } = await supabase.functions.invoke("metricool-social-weekly", {
                    body: { 
                        clientId, 
                        platform, 
                        from: startStr, 
                        to: endStr, 
                        prevFrom: prevStartStr, 
                        prevTo: prevEndStr 
                    }
                });

                if (!error && data?.success && data?.current) {
                    const current = data.current;
                    // Use debug lastPoint for most accurate Followers
                    const followers = current.followersDebug?.lastPoint?.value ?? null;
                    const engagement = current.engagementAgg ?? null;
                    const postsCount = current.postsCount ?? null;
                    
                    if (followers != null || engagement != null || postsCount != null) {
                        const parts = [`- ${platform}:`];
                        if (followers != null) parts.push(`${followers.toLocaleString()} followers`);
                        if (engagement != null) parts.push(`${engagement}% engagement rate`);
                        if (postsCount != null) parts.push(`${postsCount} total posts`);
                        liveMetrics.push(parts.join(" "));

                        // Update global metrics result
                        metricsResult.total_views += (current.pageViews || 0);
                        metricsResult.engagement_rate = Math.max(metricsResult.engagement_rate, engagement || 0);
                        if (data.difference?.followers != null) {
                            metricsResult.followers_gained += (data.difference.followers || 0);
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch live Metricool data for ${platform}:`, err);
            }
        }));

        if (liveMetrics.length > 0) {
            sections.push(
                "## Live Follower & Platform Metrics (Most Accurate)\n" + liveMetrics.join("\n")
            );
        }
    }

    // 1. Social account metrics (latest per platform) — only active platforms
    const { data: metrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers, engagement_rate, total_content, new_followers, collected_at")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false })
        .limit(20);

    if (metrics && metrics.length > 0) {
        const seen = new Set<string>();
        const unique = metrics.filter((m: any) => {
            if (!isPlatformActive(m.platform)) return false;
            if (seen.has(m.platform)) return false;
            seen.add(m.platform);
            return true;
        });
        sections.push(
            "## Platform Metrics (latest snapshot)\n" +
            unique
                .map(
                    (m: any) => {
                        const parts = [`- ${m.platform}:`];
                        if (m.followers != null) parts.push(`${m.followers.toLocaleString()} followers`);
                        if (m.engagement_rate != null) parts.push(`${m.engagement_rate}% engagement rate`);
                        if (m.new_followers != null) parts.push(`${m.new_followers} new followers this period`);
                        if (m.total_content != null) parts.push(`${m.total_content} total posts`);
                        return parts.join(" ");
                    }
                )
                .join("\n")
        );
    }

    // 2. Platform data from reports (linked through report_id)
    const { data: reports } = await supabase
        .from("reports")
        .select("id, week_start, week_end")
        .eq("client_id", clientId)
        .order("week_end", { ascending: false })
        .limit(2);

    if (reports && reports.length > 0) {
        const reportIds = reports.map((r: any) => r.id);
        const { data: platformData } = await supabase
            .from("platform_data")
            .select("platform, followers, engagement_rate, total_content, new_followers, report_id")
            .in("report_id", reportIds);

        if (platformData && platformData.length > 0) {
            const seen = new Set<string>();
            const unique = platformData.filter((p: any) => {
                if (!isPlatformActive(p.platform)) return false;
                if (seen.has(p.platform)) return false;
                seen.add(p.platform);
                return true;
            });
            sections.push(
                "## Platform Summary (from latest reports)\n" +
                unique
                    .map(
                        (p: any) => {
                            const parts = [`- ${p.platform}:`];
                            if (p.followers != null) parts.push(`${p.followers.toLocaleString()} followers`);
                            if (p.engagement_rate != null) parts.push(`${p.engagement_rate}% engagement`);
                            if (p.total_content != null) parts.push(`${p.total_content} posts published`);
                            if (p.new_followers != null) parts.push(`${p.new_followers} new followers`);
                            return parts.join(" ");
                        }
                    )
                    .join("\n")
            );
        }

        // 2b. Top performing posts from reports
        const { data: topPosts } = await supabase
            .from("top_performing_posts")
            .select("platform, views, followers, engagement_percent, reach_tier, engagement_tier, link")
            .in("report_id", reportIds)
            .order("views", { ascending: false })
            .limit(10);

        if (topPosts && topPosts.length > 0) {
            const filteredPosts = topPosts.filter((p: any) => isPlatformActive(p.platform));
            if (filteredPosts.length > 0) {
                sections.push(
                    "## Top Performing Posts\n" +
                    filteredPosts
                        .map(
                            (p: any) => {
                                const parts = [`- ${p.platform}:`];
                                if (p.views != null) parts.push(`${p.views.toLocaleString()} views`);
                                if (p.engagement_percent) parts.push(`${p.engagement_percent}% engagement`);
                                if (p.reach_tier) parts.push(`reach tier: ${p.reach_tier}`);
                                if (p.engagement_tier) parts.push(`engagement tier: ${p.engagement_tier}`);
                                return parts.join(" ");
                            }
                        )
                        .join("\n")
                );
            }
        }

        // 2c. Platform content details from reports (engagement data per post)
        const { data: platformContent } = await supabase
            .from("platform_content")
            .select("content_type, post_date, views, likes, comments, shares, reach, impressions, engagements, platform_data_id")
            .in("platform_data_id", platformData?.map((p: any) => p.id) || reportIds)
            .order("views", { ascending: false })
            .limit(20);

        if (platformContent && platformContent.length > 0) {
            sections.push(
                "## Content Performance Details\n" +
                platformContent
                    .map(
                        (c: any) =>
                            `- ${c.content_type}: ${c.views?.toLocaleString() ?? 0} views, ` +
                            `${c.likes ?? 0} likes, ${c.comments ?? 0} comments, ` +
                            `${c.shares ?? 0} shares, reach: ${c.reach?.toLocaleString() ?? "?"}, ` +
                            `posted: ${c.post_date || "?"}`
                    )
                    .join("\n")
            );
        }
    }

    // 3. Recent content with metrics - filter by metric collection date, NOT published_at
    // This ensures posts from any date whose metrics were synced in this period are included
    const { data: recentMetrics } = await supabase
        .from("social_content_metrics")
        .select(`
            views, reach, impressions, likes, comments, shares, engagements,
            collected_at, period_end,
            platform,
            social_content!inner (
                id, platform, content_type, published_at, url, title, client_id
            )
        `)
        .eq("social_content.client_id", clientId)
        .gte("period_end", startStr)
        .order("period_end", { ascending: false })
        .limit(100);

    // Deduplicate: keep only the freshest metric row per content item
    const contentMetricsByPost: Record<string, any> = {};
    recentMetrics?.forEach((row: any) => {
        const key = row.social_content?.id || row.social_content_id;
        if (!key) return;
        const existing = contentMetricsByPost[key];
        if (!existing || (row.period_end || "") > (existing.period_end || "")) {
            contentMetricsByPost[key] = row;
        }
    });
    
    const content = Object.values(contentMetricsByPost).map((row: any) => ({
        ...row.social_content,
        social_content_metrics: [row]
    }));

    if (content && content.length > 0) {
        const withMetrics = content
            .filter((c: any) => isPlatformActive(c.platform) && c.social_content_metrics && c.social_content_metrics.length > 0)
            .map((c: any) => {
                const sorted = [...c.social_content_metrics].sort((a: any, b: any) =>
                    new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
                );
                const m = sorted[0];
                const views = Math.max(m.views || 0, m.impressions || 0);
                return { ...c, latestMetric: m, primaryViews: views };
            })
            .sort((a: any, b: any) => b.primaryViews - a.primaryViews)
            .slice(0, 15);

        if (withMetrics.length > 0) {
            sections.push(
                `## Recent Content Performance (ranked by views)\n` +
                withMetrics
                    .map((c: any) => {
                        const m = c.latestMetric;
                        const parts = [`- ${c.platform} ${c.content_type || "post"} (${c.published_at?.split("T")[0] || "unknown date"}):`];
                        parts.push(`${c.primaryViews?.toLocaleString()} views`);
                        if (m.likes) parts.push(`${m.likes} likes`);
                        if (m.comments) parts.push(`${m.comments} comments`);
                        if (m.shares) parts.push(`${m.shares} shares`);
                        if (m.reach) parts.push(`reach: ${m.reach.toLocaleString()}`);
                        if (c.title) parts.push(`— "${c.title.substring(0, 50)}"`);
                        return parts.join(" ");
                    })
                    .join("\n")
            );
        }
    }

    // 4. Demographics if available
    const { data: demographics } = await supabase
        .from("social_account_demographics")
        .select("platform, countries, gender_female, gender_male, gender_unknown, period_start, period_end")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false })
        .limit(10);

    if (demographics && demographics.length > 0) {
        const seen = new Set<string>();
        const unique = demographics.filter((d: any) => {
            if (!isPlatformActive(d.platform)) return false;
            if (seen.has(d.platform)) return false;
            seen.add(d.platform);
            return true;
        });
        sections.push(
            "## Audience Demographics\n" +
            unique
                .map((d: any) => {
                    let line = `- ${d.platform}: `;
                    if (d.gender_female != null || d.gender_male != null) {
                        line += `Female: ${d.gender_female ?? 0}%, Male: ${d.gender_male ?? 0}%, `;
                        line += `Unknown: ${d.gender_unknown ?? 0}%`;
                    }
                    if (d.countries && typeof d.countries === 'object') {
                        const topCountries = Object.entries(d.countries as Record<string, number>)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .slice(0, 5)
                            .map(([c, v]) => `${c}: ${v}%`)
                            .join(", ");
                        if (topCountries) line += ` | Countries: ${topCountries}`;
                    }
                    return line;
                })
                .join("\n")
        );
    }

    // 5. Follower timeline (recent trend)
    const { data: followerTimeline } = await supabase
        .from("social_follower_timeline")
        .select("platform, date, followers")
        .eq("client_id", clientId)
        .gte("date", startStr)
        .order("date", { ascending: true })
        .limit(50);

    if (followerTimeline && followerTimeline.length > 0) {
        const byPlatform: Record<string, any[]> = {};
        followerTimeline.forEach((f: any) => {
            if (!isPlatformActive(f.platform)) return;
            if (!byPlatform[f.platform]) byPlatform[f.platform] = [];
            byPlatform[f.platform].push(f);
        });
        let timelineTotalChange = 0;
        const trendLines = Object.entries(byPlatform).map(([platform, points]) => {
            const first = points[0]?.followers ?? 0;
            const last = points[points.length - 1]?.followers ?? 0;
            const change = last - first;
            timelineTotalChange += change;
            return `- ${platform}: ${first.toLocaleString()} → ${last.toLocaleString()} (${change >= 0 ? '+' : ''}${change})`;
        });
        
        // Only use timeline change if we didn't already get live Metricool data for these platforms
        if (metricsResult.followers_gained === 0) {
            metricsResult.followers_gained = timelineTotalChange;
        }
        
        sections.push("## Follower Trend (7 days)\n" + trendLines.join("\n"));
    }
    
    // Fallback: if no Metricool follower timeline data, derive followers_gained from
    // social_account_metrics.new_followers (populated by direct API syncs)
    if (metricsResult.followers_gained === 0 && metrics && metrics.length > 0) {
        let totalNewFollowers = 0;
        const seenPlatforms = new Set<string>();
        metrics.forEach((m: any) => {
            if (!isPlatformActive(m.platform)) return;
            if (seenPlatforms.has(m.platform)) return;
            seenPlatforms.add(m.platform);
            if (m.new_followers != null && m.new_followers !== 0) {
                totalNewFollowers += m.new_followers;
            }
        });
        if (totalNewFollowers !== 0) {
            metricsResult.followers_gained = totalNewFollowers;
        }
    }

    // 6. Identify Top Platform based on views/engagements
    const platformStats: Record<string, { views: number, engagements: number }> = {};
    
    // Aggregate from content data
    if (content && content.length > 0) {
        content.forEach((c: any) => {
            if (!c.social_content_metrics || c.social_content_metrics.length === 0) return;
            const m = [...c.social_content_metrics].sort((a: any, b: any) => 
                new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
            )[0];
            const views = Math.max(m.views || 0, m.impressions || 0);
            const engagements = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
            
            if (!platformStats[c.platform]) platformStats[c.platform] = { views: 0, engagements: 0 };
            platformStats[c.platform].views += views;
            platformStats[c.platform].engagements += engagements;
        });
    }

    const topPlatformEntry = Object.entries(platformStats).sort((a, b) => b[1].views - a[1].views)[0];
    if (topPlatformEntry) {
        metricsResult.top_platform = topPlatformEntry[0];
    } else if (activePlatforms.size > 0) {
        metricsResult.top_platform = [...activePlatforms][0];
    }

    // Log what data we collected for debugging
    console.log(`Social data sections collected for client ${clientId}: ${sections.length} sections. Top Platform: ${metricsResult.top_platform}`);

    return { context: sections.join("\n\n"), metrics: metricsResult };
}

async function collectWebsiteData(
    supabase: any,
    clientId: string,
    startStr: string,
    endStr: string
): Promise<{ context: string; metrics: any }> {
    const sections: string[] = [];
    const metricsResult = {
        total_views: 0,
        engagement_rate: 0,
        followers_gained: 0,
        unique_visitors: 0,
        total_sales: 0,
        top_platform: "Website"
    };

    try {
        // 0. Check for Substack GA4 integration
        const { data: substackConfig } = await supabase
            .from('client_substack_config')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .maybeSingle();

        if (substackConfig) {
            try {
                const { data: ga4Data, error: ga4Err } = await supabase.functions.invoke("fetch-substack-ga4", {
                    body: { clientId, startDate: startStr, endDate: endStr }
                });
                
                if (!ga4Err && ga4Data && ga4Data.ok !== false && (ga4Data.analytics || ga4Data.summary)) {
                    // Handle various response shapes from fetch-substack-ga4
                    const a = ga4Data.analytics?.analytics || ga4Data.analytics || ga4Data.summary || ga4Data;
                    
                    console.log(`Substack data found for ${clientId}: views=${a.pageViews || a.totalPageViews}, visitors=${a.visitors || a.uniqueVisitors}`);

                    let subOutput = `## Substack Newsletter Performance (${startStr} to ${endStr})\n` +
                        `- Total Page Views: ${a.pageViews ?? a.totalPageViews ?? 0}\n` +
                        `- Unique Readers: ${a.visitors ?? a.uniqueVisitors ?? 0}\n` +
                        `- Total Sessions: ${a.totalSessions ?? a.sessions ?? 0}\n` +
                        `- Avg Read Time: ${a.avgDuration ?? a.avgSessionDuration ?? 0} seconds\n` +
                        `- Bounce Rate: ${a.bounceRate ?? 0}%\n`;
                    
                    if (a.topPages && Array.isArray(a.topPages) && a.topPages.length > 0) {
                        subOutput += `- Top Read Articles:\n` + 
                            a.topPages.slice(0, 5).map((p: any) => `  - ${p.title || p.url}: ${p.views} views`).join('\n') + `\n`;
                    }
                    
                    if (a.trafficSources && Array.isArray(a.trafficSources) && a.trafficSources.length > 0) {
                        subOutput += `- Traffic Sources: ` +
                            a.trafficSources.slice(0, 5).map((t: any) => `${t.source}: ${t.sessions} sessions`).join(', ') + `\n`;
                    }

                    // Update metrics for the return object
                metricsResult.total_views += (a.pageViews ?? a.totalPageViews ?? 0);
                metricsResult.unique_visitors += (a.visitors ?? a.uniqueVisitors ?? 0);
                if (a.bounceRate !== undefined) {
                    metricsResult.engagement_rate = Math.max(metricsResult.engagement_rate, 100 - (a.bounceRate ?? 0));
                }

                sections.push(subOutput);
                } else {
                    console.warn(`Substack invoke for ${clientId} returned no analytics or error:`, ga4Err);
                }
            } catch (e) {
                console.error("Failed to fetch Substack GA4 data for summary", e);
            }
        }

        // 0b. Check for Shopify integration
        const { data: shopifyConn } = await supabase
            .from('shopify_oauth_connections')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .maybeSingle();

        if (shopifyConn) {
            try {
                const { data: shopifyData, error: shopifyErr } = await supabase.functions.invoke("shopify-analytics", {
                    body: { clientId, endpoint: "summary", start: startStr, end: endStr }
                });
                if (!shopifyErr && shopifyData && shopifyData.success) {
                    const s = shopifyData.data;
                    console.log(`Shopify data found for ${clientId}: sales=${s.totalSales}, orders=${s.orders}`);
                    metricsResult.total_sales += (s.totalSales || 0);
                    
                    sections.push(`## Shopify E-Commerce Performance (${startStr} to ${endStr})\n` +
                        `- Total Sales: $${s.totalSales.toLocaleString()}\n` +
                        `- Net Sales: $${s.netSales.toLocaleString()}\n` +
                        `- Total Orders: ${s.orders}\n` +
                        `- Avg Order Value: $${s.averageOrderValue.toLocaleString()}\n` +
                        `- New Customers: ${s.newCustomers}\n`);
                }
            } catch (e) {
                console.error("Failed to fetch Shopify data for summary", e);
            }
        }

        // Website analytics data is stored in the agency's own Supabase
        // (the track-analytics edge function inserts into web_analytics_page_views
        //  and web_analytics_sessions using the agency's client_id)

        // 1. Page views — filtered by client_id
        const { data: pageViews } = await supabase
            .from("web_analytics_page_views")
            .select("page_url, page_title, visitor_id, device_type, country, referrer, viewed_at, utm_source, utm_medium, utm_campaign")
            .eq("client_id", clientId)
            .gte("viewed_at", startStr)
            .lte("viewed_at", endStr + "T23:59:59Z")
            .limit(500);

        if (pageViews && pageViews.length > 0) {
            const uniqueVisitors = new Set(pageViews.map((pv: any) => pv.visitor_id)).size;
            const devices: Record<string, number> = {};
            const countries: Record<string, number> = {};
            const referrers: Record<string, number> = {};
            const pageCounts: Record<string, number> = {};
            const utmSources: Record<string, number> = {};

            pageViews.forEach((pv: any) => {
                if (pv.device_type) devices[pv.device_type] = (devices[pv.device_type] || 0) + 1;
                if (pv.country) countries[pv.country] = (countries[pv.country] || 0) + 1;
                if (pv.referrer) {
                    try {
                        const host = new URL(pv.referrer).hostname;
                        referrers[host] = (referrers[host] || 0) + 1;
                    } catch {
                        referrers[pv.referrer] = (referrers[pv.referrer] || 0) + 1;
                    }
                }
                const path = pv.page_url || pv.page_title || "unknown";
                pageCounts[path] = (pageCounts[path] || 0) + 1;
                if (pv.utm_source) {
                    const src = pv.utm_medium ? `${pv.utm_source}/${pv.utm_medium}` : pv.utm_source;
                    utmSources[src] = (utmSources[src] || 0) + 1;
                }
            });

            const topPages = Object.entries(pageCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            let output =
                `## Website Analytics (${startStr} to ${endStr})\n` +
                `- Total Page Views: ${pageViews.length}\n` +
                `- Unique Visitors: ${uniqueVisitors || 0}\n` +
                `- Devices: ${Object.entries(devices).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c}`).join(", ")}\n` +
                `- Top Countries: ${Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c}: ${n}`).join(", ")}\n` +
                `- Top Referrers: ${Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r, n]) => `${r}: ${n}`).join(", ")}\n` +
                `- Top Pages:\n${topPages.map(([path, count]) => `  - ${path}: ${count} views`).join("\n")}`;

            if (Object.keys(utmSources).length > 0) {
                output += `\n- Traffic Sources (UTM): ${Object.entries(utmSources).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, n]) => `${s}: ${n}`).join(", ")}`;
            }

            metricsResult.total_views += pageViews.length;
            metricsResult.unique_visitors += uniqueVisitors;
            sections.push(output);
        }

        // 2. Sessions — filtered by client_id, with duration and page count
        const { data: sessions } = await supabase
            .from("web_analytics_sessions")
            .select("visitor_id, device_type, country, referrer, created_at, bounce, page_count, started_at, ended_at, utm_source, utm_medium")
            .eq("client_id", clientId)
            .gte("created_at", startStr)
            .lte("created_at", endStr + "T23:59:59Z")
            .limit(500);

        if (sessions && sessions.length > 0) {
            const bounceCount = sessions.filter((s: any) => s.bounce).length;
            const bounceRate = ((bounceCount / sessions.length) * 100).toFixed(1);

            // Calculate avg pages per session
            const pagesPerSession = sessions.reduce((sum: number, s: any) => sum + (s.page_count || 1), 0) / sessions.length;

            // Calculate avg session duration
            let avgDurationStr = "N/A";
            const durations = sessions
                .filter((s: any) => s.started_at && s.ended_at)
                .map((s: any) => new Date(s.ended_at).getTime() - new Date(s.started_at).getTime());
            if (durations.length > 0) {
                const avgMs = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
                const avgSec = Math.round(avgMs / 1000);
                avgDurationStr = avgSec >= 60 ? `${Math.floor(avgSec / 60)}m ${avgSec % 60}s` : `${avgSec}s`;
            }

            sections.push(
                `## Website Visitor Metrics\n` +
                `- Total Sessions: ${sessions.length}\n` +
                `- Bounce Rate: ${bounceRate}%\n` +
                `- Avg Pages/Session: ${pagesPerSession.toFixed(1)}\n` +
                `- Avg Session Duration: ${avgDurationStr}`
            );
        }
    } catch (webErr) {
        console.error("Error in website data collection:", webErr);
    }

    return { context: sections.join("\n\n"), metrics: metricsResult };
}

async function collectAdsData(
    supabase: any,
    clientId: string,
    startStr: string,
    endStr: string
): Promise<{ context: string; metrics: any }> {
    const sections: string[] = [];
    const metricsResult = {
        total_views: 0,
        engagement_rate: 0,
        followers_gained: 0,
        total_spend: 0,
        total_conversions: 0,
        total_clicks: 0,
        total_conv_value: 0,
        roas: 0,
        top_platform: "Ads"
    };

    const prevStart = new Date(startStr);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(endStr);
    prevEnd.setDate(prevEnd.getDate() - 7);

    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevEndStr = prevEnd.toISOString().split("T")[0];

    const { data: adsData, error } = await supabase.functions.invoke("metricool-ads", {
        body: {
            clientId,
            from: startStr,
            to: endStr,
            prevFrom: prevStartStr,
            prevTo: prevEndStr
        }
    });

    if (error || !adsData || !adsData.success) {
        console.error("Failed to fetch metricool-ads:", error || adsData?.error);
        return { context: "No ads data available or failed to fetch.", metrics: metricsResult };
    }

    const report = adsData.data;
    const allCampaigns: any[] = [];

    if (report?.metaAds) {
        const current = report.metaAds.current;
        metricsResult.total_views += current.impressions;
        metricsResult.total_spend += current.spend;
        metricsResult.total_clicks += current.clicks;
        metricsResult.total_conversions += current.conversions;
        metricsResult.total_conv_value += current.conversionValue;
        
        if (current.campaigns) allCampaigns.push(...current.campaigns.map((c: any) => ({ ...c, platform: 'Meta' })));

        sections.push(`## Meta Ads (Facebook/Instagram)\n- Spend: $${current.spend.toFixed(2)}\n- Impressions: ${current.impressions}\n- Clicks: ${current.clicks}\n- Conversions: ${current.conversions}\n- Conv. Value: $${current.conversionValue.toFixed(2)}\n- ROAS: ${current.roas.toFixed(2)}x\n- Top Campaigns by spend:\n` + current.campaigns.slice(0, 5).map((c: any) => `  - ${c.name}: Spend $${c.spent.toFixed(2)}, Conversions: ${c.conversions}, ROAS: ${c.purchaseRoas.toFixed(2)}x`).join("\n"));
    }
    if (report?.googleAds) {
        const current = report.googleAds.current;
        metricsResult.total_views += current.impressions;
        metricsResult.total_spend += current.spend;
        metricsResult.total_clicks += current.clicks;
        metricsResult.total_conversions += current.conversions;
        metricsResult.total_conv_value += current.allConversionsValue;

        if (current.campaigns) allCampaigns.push(...current.campaigns.map((c: any) => ({ ...c, name: c.name, spent: c.spent, conversions: c.conversions, platform: 'Google' })));

        sections.push(`## Google Ads\n- Spend: $${current.spend.toFixed(2)}\n- Impressions: ${current.impressions}\n- Clicks: ${current.clicks}\n- Conversions: ${current.conversions}\n- Conv. Value: $${current.allConversionsValue.toFixed(2)}\n- ROAS: ${current.roas.toFixed(2)}x\n- Top Campaigns by spend:\n` + current.campaigns.slice(0, 5).map((c: any) => `  - ${c.name}: Spend $${c.spent.toFixed(2)}, Conversions: ${c.conversions}, ROAS: ${c.purchaseROAS.toFixed(2)}x`).join("\n"));
    }
    if (report?.tiktokAds) {
        const current = report.tiktokAds.current;
        metricsResult.total_views += current.impressions;
        metricsResult.total_spend += current.spend;
        metricsResult.total_clicks += current.clicks;
        metricsResult.total_conversions += current.conversions;
        metricsResult.total_conv_value += current.conversionValue;

        if (current.campaigns) allCampaigns.push(...current.campaigns.map((c: any) => ({ ...c, spent: c.spent, platform: 'TikTok' })));

        sections.push(`## TikTok Ads\n- Spend: $${current.spend.toFixed(2)}\n- Impressions: ${current.impressions}\n- Clicks: ${current.clicks}\n- Conversions: ${current.conversions}\n- Conv. Value: $${current.conversionValue.toFixed(2)}\n- ROAS: ${current.roas.toFixed(2)}x\n- Top Campaigns by spend:\n` + current.campaigns.slice(0, 5).map((c: any) => `  - ${c.name}: Spend $${c.spent.toFixed(2)}, Conversions: ${c.conversions}`).join("\n"));
    }

    // Calculate aggregate ROAS
    if (metricsResult.total_spend > 0) {
        metricsResult.roas = metricsResult.total_conv_value / metricsResult.total_spend;
        // Use ROAS as a proxy for engagement rate in the primary box
        metricsResult.engagement_rate = metricsResult.roas * 10;
    }

    // Identify top platform/campaign
    const topCampaign = allCampaigns.sort((a, b) => (b.spent || 0) - (a.spent || 0))[0];
    if (topCampaign) {
        metricsResult.top_platform = topCampaign.name || topCampaign.platform || "Ads";
    }

    if (sections.length === 0) {
        return { context: "No ad campaigns were active during this period.", metrics: metricsResult };
    }

    return { context: sections.join("\n\n"), metrics: metricsResult };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract platform names mentioned in the analytics context string */
function extractPlatforms(data: string): string[] {
    // Platforms that won't produce false positives with simple includes()
    const safePlatforms = [
        "instagram", "facebook", "tiktok", "youtube",
        "linkedin", "pinterest", "threads", "snapchat",
        "meta ads", "google ads", "tiktok ads", "amazon ads",
    ];
    const lower = data.toLowerCase();
    const found = safePlatforms.filter((p) => lower.includes(p));

    // "x" needs word-boundary matching to avoid false positives ("text", "max", etc.)
    // Check for "- x:" or "x:" at start of a platform line, or "twitter" anywhere
    const hasX = /\btwitter\b/.test(lower) || /(?:^|[\s,\-])x(?:\s*[:(])/m.test(lower);
    if (hasX) found.push("X (Twitter)");

    return found.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

// ─── Gemini API ─────────────────────────────────────────────────────────────

function buildPrompt(
    clientName: string,
    type: string,
    data: string,
    startStr: string,
    endStr: string,
    platforms: string[]
): string {
    const label = type === "ads" ? "advertising" : (type === "social" ? "social media" : "website");
    const platformClause = platforms.length > 0
        ? `\nThis client is active on: ${platforms.join(", ")}. Only reference these platforms.`
        : "";

    return `You are a senior digital strategist at a marketing agency. You are writing a performance brief for ${clientName}'s ${label} analytics for the week of ${startStr} to ${endStr}.${platformClause}

Here is the raw analytics data:

${data}

Your task: Produce a concise, insight-driven executive summary. Focus on what a marketing manager needs to know to make decisions THIS week.

For each category, write 2-4 bullet points. Each bullet should:
- Reference specific numbers from the data (spend, roas, followers, views, engagement rates, etc.)
- Compare metrics where possible (e.g. "engagement rate of 3.2% is above the 1-2% industry average")
- Be actionable — don't just describe, explain what it means and what to do about it

Category definitions:
- "strengths": What's performing well. IMPORTANT: Analyze which page, campaign, copy, or content format is the strongest performer. Cite specific metrics. Example for web: "The 'New Home Collection' page drove 45% of all traffic this week with an impressive 2-minute average read time."
- "weaknesses": What's underperforming or missing. Identify pages with high bounce rates, underperforming ad sets, or low-engagement social formats.
- "smartActions": 2-4 highly specific, actionable steps. Example for Shopify: "Since the 'Bestsellers' page has a high exit rate, consider adding a limited-time discount pop-up or improving the mobile checkout flow to capture the 60% of users currently bouncing."
- "highlights": Key milestones, trending content, or notable changes.

CRITICAL RULES:
- ONLY reference data that is actually present above. Do NOT invent or assume any numbers.
- Focus your analysis ONLY on the data provided. Do NOT mention missing data, incomplete metrics, or platforms lacking data as weaknesses. Weaknesses should ONLY be about actual performance problems visible in the numbers (e.g. low engagement, declining reach, poor content mix).
- Keep each bullet to 1-2 sentences max.
- Use plain language, no jargon. Write as if briefing a busy client.

Respond with ONLY a valid JSON object in this exact format (no markdown, no code fences, just raw JSON):
{
  "strengths": ["item 1", "item 2"],
  "weaknesses": ["item 1", "item 2"],
  "smartActions": ["item 1", "item 2"],
  "highlights": ["item 1", "item 2"]
}`;
}

async function callGemini(apiKey: string, prompt: string, maxRetries = 3): Promise<any> {
    // Dynamically fetch available models to ensure we only request models that actually exist and are supported
    const modelsReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!modelsReq.ok) {
        throw new Error(`Failed to fetch models from Gemini API: ${modelsReq.status}`);
    }
    const modelsData = await modelsReq.json();
    
    // Find supported models that are valid for generateContent. We prioritize 2.5, then 2.0, then 1.5
    const availableModels = modelsData.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace('models/', ''));
        
    const candidateModels = [];
    if (availableModels.includes("gemini-2.5-flash")) candidateModels.push("gemini-2.5-flash");
    if (availableModels.includes("gemini-2.5-pro")) candidateModels.push("gemini-2.5-pro");
    if (availableModels.includes("gemini-2.0-flash")) candidateModels.push("gemini-2.0-flash");
    if (availableModels.includes("gemini-1.5-flash-latest")) candidateModels.push("gemini-1.5-flash-latest");
    if (availableModels.includes("gemini-1.5-flash-002")) candidateModels.push("gemini-1.5-flash-002");
    if (availableModels.includes("gemini-1.5-flash")) candidateModels.push("gemini-1.5-flash");
    
    // Fallback to whatever first model contains 'flash' if our specific candidates aren't there
    if (candidateModels.length === 0) {
        const anyFlash = availableModels.find((m: string) => m.includes("flash"));
        if (anyFlash) candidateModels.push(anyFlash);
        else candidateModels.push(availableModels[0] || "gemini-2.5-flash"); // hail mary
    }

    let response: Response | null = null;
    let lastErrBody = "";

    // Retry loop using the valid candidate models
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Shift to older/different models if our first choice throws 503 repeatedly
        const currentModel = candidateModels[Math.min(attempt, candidateModels.length - 1)];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

        if (attempt > 0) {
            const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.log(`Gemini API overloaded. Retrying ${attempt}/${maxRetries} with ${currentModel} in ${Math.round(backoffMs)}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (response.ok) {
            break;
        }

        lastErrBody = await response.text();
        console.error(`Gemini API error (Attempt ${attempt + 1} with ${currentModel}):`, response.status, lastErrBody);
        
        // Let it retry on 503, 429, OR 500/504
        if (![503, 500, 502, 504, 429].includes(response.status)) {
            // Throw immediately for 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found (if model name was somehow wrong even after fetch)
            throw new Error(`Gemini API returned ${response.status}: ${lastErrBody.substring(0, 500)}`);
        }
    }

    if (!response || !response.ok) {
        throw new Error(`Gemini API failed after ${maxRetries} retries (all fallback models exhausted). Last error: ${response?.status}: ${lastErrBody.substring(0, 500)}`);
    }

    const result = await response.json();

    // Log the response structure for debugging
    console.log("Gemini response candidates count:", result?.candidates?.length);
    const parts = result?.candidates?.[0]?.content?.parts;
    console.log("Gemini response parts count:", parts?.length);

    if (!parts || parts.length === 0) {
        console.error("No parts in Gemini response:", JSON.stringify(result));
        throw new Error("Empty response from Gemini");
    }

    // With responseMimeType set, the response should be clean JSON in the text part
    let text = "";
    for (const part of parts) {
        if (part.text) {
            text = part.text;
        }
    }

    if (!text) {
        console.error("No text found in any Gemini response parts:", JSON.stringify(parts));
        throw new Error("Empty text response from Gemini");
    }

    console.log("Gemini raw text (first 300 chars):", text.substring(0, 300));

    // Parse the JSON response — strip markdown fences and extract JSON object
    try {
        // Most robust approach: find the JSON object between first { and last }
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            console.error("No JSON object found in Gemini response:", text.substring(0, 500));
            throw new Error("No JSON object in response");
        }

        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);

        // Validate required fields, provide defaults if missing
        return {
            strengths: parsed.strengths || ["Analysis could not identify specific strengths from available data."],
            weaknesses: parsed.weaknesses || ["Analysis could not identify specific weaknesses from available data."],
            smartActions: parsed.smartActions || ["Continue collecting data for more detailed recommendations."],
            highlights: parsed.highlights || ["Summary data is limited for this period."],
        };
    } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr, "Full raw text:", text);
        throw new Error("Failed to parse AI response as JSON. Raw preview: " + text.substring(0, 500));
    }
}