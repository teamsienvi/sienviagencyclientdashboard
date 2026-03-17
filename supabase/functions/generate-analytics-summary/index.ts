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
        const { clientId, type } = await req.json();

        if (!clientId || !type) {
            throw new Error("clientId and type are required");
        }
        if (type !== "social" && type !== "website") {
            throw new Error("type must be 'social' or 'website'");
        }

        console.log(`Generating ${type} summary for client ${clientId}`);

        // Fetch client info
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", clientId)
            .single();

        if (clientError || !client) {
            throw new Error(`Client not found: ${clientError?.message}`);
        }

        // Calculate date range (last 7 days)
        const periodEnd = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 7);
        const startStr = periodStart.toISOString().split("T")[0];
        const endStr = periodEnd.toISOString().split("T")[0];

        let analyticsContext = "";

        if (type === "social") {
            analyticsContext = await collectSocialData(supabase, clientId, startStr, endStr);
        } else {
            analyticsContext = await collectWebsiteData(supabase, clientId, startStr, endStr);
        }

        if (!analyticsContext || analyticsContext.trim().length < 20) {
            // Return a structured "no data" response instead of throwing
            const noDataResponse = {
                strengths: ["Not enough data available yet to identify strengths."],
                weaknesses: ["Insufficient analytics data collected for this period."],
                smartActions: ["Ensure social accounts are connected and syncing data regularly."],
                highlights: ["Data collection is in progress — check back after more metrics are gathered."],
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
        const summaryData = await callGemini(googleApiKey, prompt);

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
): Promise<string> {
    const sections: string[] = [];

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
                    (m: any) =>
                        `- ${m.platform}: ${m.followers?.toLocaleString() ?? "?"} followers, ` +
                        `${m.engagement_rate ?? "?"}% engagement rate, ` +
                        `${m.new_followers ?? "?"} new followers this period, ` +
                        `${m.total_content ?? "?"} total posts, ` +
                        `last updated: ${m.collected_at ? new Date(m.collected_at).toLocaleDateString() : "?"}`
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
                        (p: any) =>
                            `- ${p.platform}: ${p.followers?.toLocaleString() ?? "?"} followers, ` +
                            `${p.engagement_rate ?? "?"}% engagement, ` +
                            `${p.total_content ?? "?"} posts published, ` +
                            `${p.new_followers ?? "?"} new followers`
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
                            (p: any) =>
                                `- ${p.platform}: ${p.views?.toLocaleString() ?? "?"} views, ` +
                                `${p.engagement_percent ?? 0}% engagement, ` +
                                `${p.followers?.toLocaleString() ?? "?"} followers at time of post, ` +
                                `reach tier: ${p.reach_tier ?? "N/A"}, engagement tier: ${p.engagement_tier ?? "N/A"}`
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

    // 3. Recent content with metrics (social_content + social_content_metrics join)
    const { data: content } = await supabase
        .from("social_content")
        .select(`id, platform, content_type, published_at, url, title,
            social_content_metrics (
                views, reach, impressions, likes, comments, shares, engagements,
                collected_at
            )`)
        .eq("client_id", clientId)
        .gte("published_at", startStr)
        .order("published_at", { ascending: false })
        .limit(30);

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
                `## Recent Content Performance (last 7 days, ranked by views)\n` +
                withMetrics
                    .map((c: any) => {
                        const m = c.latestMetric;
                        return `- ${c.platform} ${c.content_type || "post"} (${c.published_at?.split("T")[0] || "?"}): ` +
                            `${c.primaryViews?.toLocaleString()} views, ` +
                            `${m.likes ?? 0} likes, ${m.comments ?? 0} comments, ` +
                            `${m.shares ?? 0} shares, reach: ${m.reach?.toLocaleString() ?? "?"}` +
                            (c.title ? ` — "${c.title.substring(0, 50)}"` : "");
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
        const trendLines = Object.entries(byPlatform).map(([platform, points]) => {
            const first = points[0]?.followers ?? 0;
            const last = points[points.length - 1]?.followers ?? 0;
            const change = last - first;
            return `- ${platform}: ${first.toLocaleString()} → ${last.toLocaleString()} (${change >= 0 ? '+' : ''}${change})`;
        });
        sections.push("## Follower Trend (7 days)\n" + trendLines.join("\n"));
    }

    // Log what data we collected for debugging
    console.log(`Social data sections collected for client ${clientId}: ${sections.length} sections`);

    return sections.join("\n\n");
}

async function collectWebsiteData(
    supabase: any,
    clientId: string,
    startStr: string,
    endStr: string
): Promise<string> {
    const sections: string[] = [];

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
            `- Unique Visitors: ${uniqueVisitors}\n` +
            `- Devices: ${Object.entries(devices).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c}`).join(", ")}\n` +
            `- Top Countries: ${Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c}: ${n}`).join(", ")}\n` +
            `- Top Referrers: ${Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r, n]) => `${r}: ${n}`).join(", ")}\n` +
            `- Top Pages:\n${topPages.map(([path, count]) => `  - ${path}: ${count} views`).join("\n")}`;

        if (Object.keys(utmSources).length > 0) {
            output += `\n- Traffic Sources (UTM): ${Object.entries(utmSources).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, n]) => `${s}: ${n}`).join(", ")}`;
        }

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
            `## Sessions\n` +
            `- Total Sessions: ${sessions.length}\n` +
            `- Bounce Rate: ${bounceRate}%\n` +
            `- Avg Pages/Session: ${pagesPerSession.toFixed(1)}\n` +
            `- Avg Session Duration: ${avgDurationStr}`
        );
    }

    return sections.join("\n\n");
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
    const label = type === "social" ? "social media" : "website";
    const platformClause = platforms.length > 0
        ? `\nThis client is active on: ${platforms.join(", ")}. Only reference these platforms.`
        : "";

    return `You are a senior social media strategist at a digital marketing agency. You are writing a performance brief for ${clientName}'s ${label} analytics for the week of ${startStr} to ${endStr}.${platformClause}

Here is the raw analytics data:

${data}

Your task: Produce a concise, insight-driven executive summary. Focus on what a marketing manager needs to know to make decisions THIS week.

For each category, write 2-4 bullet points. Each bullet should:
- Reference specific numbers from the data (followers, views, engagement rates, etc.)
- Compare metrics where possible (e.g. "engagement rate of 3.2% is above the 1-2% industry average")
- Be actionable — don't just describe, explain what it means and what to do about it

Category definitions:
- "strengths": What's performing well. IMPORTANT: Analyze which CONTENT FORMAT is the strongest performer — compare photos/static posts vs reels/short video vs carousels/stories. Identify the format that gets the most engagement, views, and reach. Cite specific content pieces and their numbers. Example: "Reels outperformed static posts by 3x in reach (2,500 avg vs 800 avg), making short-form video the strongest content format this week."
- "weaknesses": What's underperforming or missing. Be honest but constructive. Identify content formats or platforms that are lagging.
- "smartActions": 2-4 specific, actionable social media strategies and content hooks the team should execute THIS week. Be concrete and creative — suggest specific content ideas, hooks, captions angles, or posting tactics based on what performed well in the data. Examples: "Create 3 Reels using the 'day in the life' hook that drove 805 views on TikTok this week" or "Test carousel posts on Instagram with educational tips — the single photo format only got 2% engagement." Do NOT give generic advice like "improve engagement" or "post more consistently."
- "highlights": Key milestones, trending content, or notable changes worth celebrating or flagging.

CRITICAL RULES:
- ONLY reference data that is actually present above. Do NOT invent or assume any numbers.
- If data is sparse, acknowledge the limitation and recommend actions to improve data collection.
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

async function callGemini(apiKey: string, prompt: string): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
            },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error("Gemini API error:", response.status, errBody);
        throw new Error(`Gemini API returned ${response.status}: ${errBody.substring(0, 500)}`);
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