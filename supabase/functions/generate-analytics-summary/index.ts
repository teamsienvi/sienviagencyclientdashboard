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
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { clientId, type } = await req.json();

        if (!clientId || !type || !['social', 'website'].includes(type)) {
            return new Response(
                JSON.stringify({ error: 'Missing clientId or type (social|website)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!geminiKey) {
            return new Response(
                JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get client info
        const { data: client } = await supabase
            .from('clients')
            .select('id, name')
            .eq('id', clientId)
            .single();

        if (!client) {
            return new Response(
                JSON.stringify({ error: 'Client not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = now.toISOString().split('T')[0];

        let dataContext = '';

        if (type === 'social') {
            dataContext = await gatherSocialData(supabase, clientId, startStr, endStr);
        } else {
            dataContext = await gatherWebsiteData(supabase, clientId, startStr, endStr);
        }

        if (!dataContext || dataContext.trim().length < 20) {
            return new Response(
                JSON.stringify({
                    strengths: ['No data available yet for analysis'],
                    weaknesses: ['Insufficient data to identify weaknesses'],
                    smartActions: ['Continue collecting data for at least 1 week'],
                    highlights: ['Analytics tracking is set up and collecting data'],
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Call Gemini
        const prompt = buildPrompt(client.name, type, dataContext, startStr, endStr);
        const summary = await callGemini(geminiKey, prompt);

        // Cache the result
        await supabase
            .from('analytics_summaries')
            .upsert({
                client_id: clientId,
                type,
                summary_data: summary,
                period_start: startStr,
                period_end: endStr,
                generated_at: now.toISOString(),
            }, { onConflict: 'client_id,type' })
            .select();

        return new Response(
            JSON.stringify(summary),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// ── Social Data Gathering ──────────────────────────────────────────────

async function gatherSocialData(supabase: any, clientId: string, startStr: string, endStr: string): Promise<string> {
    const sections: string[] = [];

    // 1. Social account metrics (followers, engagement per platform)
    const { data: metrics } = await supabase
        .from('social_account_metrics')
        .select('platform, followers, new_followers, engagement_rate, total_content, period_start, period_end')
        .eq('client_id', clientId)
        .gte('period_end', startStr)
        .order('period_end', { ascending: false })
        .limit(50);

    if (metrics?.length) {
        sections.push('## Social Account Metrics (last 30 days)\n' +
            metrics.map((m: any) =>
                `- ${m.platform}: ${m.followers} followers (${m.new_followers > 0 ? '+' : ''}${m.new_followers || 0} new), engagement: ${(m.engagement_rate || 0).toFixed(2)}%, content: ${m.total_content || 0} posts`
            ).join('\n'));
    }

    // 2. Follower timeline (growth trends)
    const { data: timeline } = await supabase
        .from('social_follower_timeline')
        .select('platform, date, followers')
        .eq('client_id', clientId)
        .gte('date', startStr)
        .order('date', { ascending: true })
        .limit(100);

    if (timeline?.length) {
        const byPlatform: Record<string, any[]> = {};
        timeline.forEach((t: any) => {
            if (!byPlatform[t.platform]) byPlatform[t.platform] = [];
            byPlatform[t.platform].push(t);
        });
        const trends = Object.entries(byPlatform).map(([plat, data]) => {
            const first = data[0]?.followers || 0;
            const last = data[data.length - 1]?.followers || 0;
            const change = last - first;
            return `- ${plat}: ${first} → ${last} (${change > 0 ? '+' : ''}${change})`;
        });
        sections.push('## Follower Growth Trends\n' + trends.join('\n'));
    }

    // 3. Top performing content (social_content + social_content_metrics)
    const { data: content } = await supabase
        .from('social_content')
        .select(`
      id, platform, content_type, title, published_at, url,
      social_content_metrics!inner(likes, comments, shares, reach, impressions, views, engagements, watch_time_hours)
    `)
        .eq('client_id', clientId)
        .gte('published_at', startStr)
        .order('published_at', { ascending: false })
        .limit(30);

    if (content?.length) {
        const formatted = content.map((c: any) => {
            const m = Array.isArray(c.social_content_metrics)
                ? c.social_content_metrics[0]
                : c.social_content_metrics;
            return `- [${c.platform}/${c.content_type}] "${c.title || 'Untitled'}" — likes:${m?.likes || 0}, comments:${m?.comments || 0}, shares:${m?.shares || 0}, reach:${m?.reach || 0}, views:${m?.views || 0}`;
        });
        sections.push('## Recent Content Performance\n' + formatted.join('\n'));
    }

    // 4. Demographics
    const { data: demos } = await supabase
        .from('social_account_demographics')
        .select('platform, gender_male, gender_female, gender_unknown, countries')
        .eq('client_id', clientId)
        .order('collected_at', { ascending: false })
        .limit(10);

    if (demos?.length) {
        const formatted = demos.map((d: any) => {
            const total = (d.gender_male || 0) + (d.gender_female || 0) + (d.gender_unknown || 0);
            const countries = d.countries ? JSON.stringify(d.countries).slice(0, 200) : 'N/A';
            return `- ${d.platform}: ${total > 0 ? `Male:${((d.gender_male / total) * 100).toFixed(0)}% Female:${((d.gender_female / total) * 100).toFixed(0)}%` : 'N/A'}, Top countries: ${countries}`;
        });
        sections.push('## Audience Demographics\n' + formatted.join('\n'));
    }

    // 5. Meta Ads performance
    const { data: ads } = await supabase
        .from('meta_ads_daily')
        .select('date_start, campaign_name, spend, impressions, reach, link_clicks, cpc, ctr, roas, purchases, revenue')
        .eq('client_id', clientId)
        .eq('level', 'campaign')
        .gte('date_start', startStr)
        .order('date_start', { ascending: false })
        .limit(50);

    if (ads?.length) {
        const totalSpend = ads.reduce((s: number, a: any) => s + (a.spend || 0), 0);
        const totalImpressions = ads.reduce((s: number, a: any) => s + (a.impressions || 0), 0);
        const totalClicks = ads.reduce((s: number, a: any) => s + (a.link_clicks || 0), 0);
        const totalReach = ads.reduce((s: number, a: any) => s + (a.reach || 0), 0);
        const totalPurchases = ads.reduce((s: number, a: any) => s + (a.purchases || 0), 0);
        const totalRevenue = ads.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
        const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 'N/A';
        const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 'N/A';
        const avgROAS = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 'N/A';

        sections.push(`## Meta Ads Performance (30 days)
- Total Spend: $${totalSpend.toFixed(2)}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Reach: ${totalReach.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Avg CPC: $${avgCPC}
- Avg CTR: ${avgCTR}%
- Total Purchases: ${totalPurchases}
- Total Revenue: $${totalRevenue.toFixed(2)}
- ROAS: ${avgROAS}x`);

        // Top campaigns
        const campaignMap: Record<string, { spend: number; clicks: number; impressions: number }> = {};
        ads.forEach((a: any) => {
            const name = a.campaign_name || 'Unknown';
            if (!campaignMap[name]) campaignMap[name] = { spend: 0, clicks: 0, impressions: 0 };
            campaignMap[name].spend += a.spend || 0;
            campaignMap[name].clicks += a.link_clicks || 0;
            campaignMap[name].impressions += a.impressions || 0;
        });
        const topCampaigns = Object.entries(campaignMap)
            .sort((a, b) => b[1].spend - a[1].spend)
            .slice(0, 5)
            .map(([name, d]) => `  - "${name}": $${d.spend.toFixed(2)} spend, ${d.clicks} clicks, ${d.impressions} impressions`);
        if (topCampaigns.length) {
            sections.push('### Top Campaigns by Spend\n' + topCampaigns.join('\n'));
        }
    }

    // 6. Metricool platforms configured
    const { data: platforms } = await supabase
        .from('client_metricool_config')
        .select('platform, followers')
        .eq('client_id', clientId)
        .eq('is_active', true);

    if (platforms?.length) {
        sections.push('## Connected Platforms\n' +
            platforms.map((p: any) => `- ${p.platform}: ${p.followers || 0} followers`).join('\n'));
    }

    return sections.join('\n\n');
}

// ── Website Data Gathering ─────────────────────────────────────────────

async function gatherWebsiteData(supabase: any, clientId: string, startStr: string, endStr: string): Promise<string> {
    const sections: string[] = [];

    // 1. Sessions overview
    const { data: sessions } = await supabase
        .from('web_analytics_sessions')
        .select('id, visitor_id, started_at, device_type, country, referrer, utm_source, utm_medium, is_bounce, duration_seconds')
        .eq('client_id', clientId)
        .gte('started_at', startStr)
        .order('started_at', { ascending: false })
        .limit(500);

    if (sessions?.length) {
        const uniqueVisitors = new Set(sessions.map((s: any) => s.visitor_id)).size;
        const bounces = sessions.filter((s: any) => s.is_bounce).length;
        const bounceRate = ((bounces / sessions.length) * 100).toFixed(1);
        const avgDuration = sessions.reduce((s: number, x: any) => s + (x.duration_seconds || 0), 0) / sessions.length;

        // Device breakdown
        const devices: Record<string, number> = {};
        sessions.forEach((s: any) => {
            const d = s.device_type || 'unknown';
            devices[d] = (devices[d] || 0) + 1;
        });

        // Country breakdown
        const countries: Record<string, number> = {};
        sessions.forEach((s: any) => {
            const c = s.country || 'Unknown';
            countries[c] = (countries[c] || 0) + 1;
        });
        const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Traffic sources
        const sources: Record<string, number> = {};
        sessions.forEach((s: any) => {
            let source = 'Direct';
            if (s.utm_source) source = s.utm_source;
            else if (s.referrer) {
                try { source = new URL(s.referrer).hostname; } catch { source = s.referrer; }
            }
            sources[source] = (sources[source] || 0) + 1;
        });
        const topSources = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 5);

        sections.push(`## Website Traffic Overview (30 days)
- Total Sessions: ${sessions.length}
- Unique Visitors: ${uniqueVisitors}
- Bounce Rate: ${bounceRate}%
- Avg Session Duration: ${avgDuration.toFixed(0)}s
- Devices: ${Object.entries(devices).map(([d, c]) => `${d}:${c}`).join(', ')}
- Top Countries: ${topCountries.map(([c, n]) => `${c}:${n}`).join(', ')}
- Top Traffic Sources: ${topSources.map(([s, n]) => `${s}:${n}`).join(', ')}`);
    }

    // 2. Page views
    const { data: pageViews } = await supabase
        .from('web_analytics_page_views')
        .select('page_url, page_title, viewed_at')
        .eq('client_id', clientId)
        .gte('viewed_at', startStr)
        .order('viewed_at', { ascending: false })
        .limit(500);

    if (pageViews?.length) {
        const pageCount: Record<string, number> = {};
        pageViews.forEach((pv: any) => {
            let path = pv.page_url;
            try { path = new URL(pv.page_url).pathname; } catch { }
            pageCount[path] = (pageCount[path] || 0) + 1;
        });
        const topPages = Object.entries(pageCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

        sections.push(`## Page Views
- Total Page Views: ${pageViews.length}
- Pages per Session: ${sessions?.length ? (pageViews.length / sessions.length).toFixed(1) : 'N/A'}

### Top Pages
${topPages.map(([p, c]) => `- ${p}: ${c} views`).join('\n')}`);
    }

    return sections.join('\n\n');
}

// ── Gemini Integration ─────────────────────────────────────────────────

function buildPrompt(clientName: string, type: string, dataContext: string, startDate: string, endDate: string): string {
    const area = type === 'social' ? 'social media and advertising' : 'website analytics';
    return `You are a marketing analytics expert for a digital agency. Analyze the following ${area} data for the client "${clientName}" for the period ${startDate} to ${endDate}.

Based on this data, provide a structured analysis with exactly 4 sections:

1. **Strengths** (3-5 items): What is working well? Use specific numbers.
2. **Weaknesses** (3-5 items): What needs improvement? Be specific.
3. **SMART Action Plan** (3-5 items): Specific, measurable actions for next week. Each should be actionable.
4. **Highlights** (2-3 items): Notable achievements or interesting trends.

Important rules:
- Be specific. Reference actual numbers from the data.
- Keep each item to 1-2 sentences max.
- Be actionable and practical — this is for an agency team.
- If ads data is available, include ROI/ROAS analysis.
- Return ONLY valid JSON with this structure, no markdown:

{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "smartActions": ["...", "..."],
  "highlights": ["...", "..."]
}

Here is the data:

${dataContext}`;
}

async function callGemini(apiKey: string, prompt: string): Promise<any> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini error:', errText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No response from Gemini');
    }

    try {
        return JSON.parse(text);
    } catch {
        // Try extracting JSON from markdown code blocks
        const jsonMatch = text.match(/```json?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        throw new Error('Failed to parse Gemini response as JSON');
    }
}
