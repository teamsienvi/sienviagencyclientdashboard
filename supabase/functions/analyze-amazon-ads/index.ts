import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use gpt-4o-mini via Chat Completions — fast, no polling, no timeout issues
const OPENAI_CHAT_MODEL = "gpt-4o-mini";

// Prompt engineered to match the exact PDF report format
const AMAZON_PROMPT = `You are an expert Amazon Ads analyst. Analyze the following Amazon Ads report data and produce a structured, actionable report.

IMPORTANT: You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON. Your response must start with { and end with }.

This is a BIWEEKLY (14-day) report. If a date range is provided, analyze trends across the full period.

- Ad Sales (Use the EXACT pre-calculated total provided)
- Ad Spend (Use the EXACT pre-calculated total provided)
- ACoS = (Ad Spend / Ad Sales) * 100
- ROAS = Ad Sales / Ad Spend
- Orders (Use the EXACT pre-calculated total provided)
- Clicks (Use the EXACT pre-calculated total provided)
- Impressions (Use the EXACT pre-calculated total provided)
- CTR = (Clicks / Impressions) * 100
- CVR = (Orders / Clicks) * 100
- Avg CPC = Ad Spend / Clicks

Identify:
- ALL campaigns by revenue (Sales), sorted highest first. Include their Spend, Sales, ACoS, Orders, ROAS. Do not limit the number — include every campaign row.
- Top 6 search terms with highest spend but ZERO sales (these are wasting budget)

Then write:
- executiveSummary: 3-4 bullet points referencing the actual numbers from the data. Include a mention of the 14-day reporting window.
- clientNeedsToKnow: 1 honest paragraph about overall account health over the biweekly period
- channelSnapshot: 1 paragraph about campaign type breakdown (Sponsored Products vs Brands vs Display, or whatever types are in the data)
- actionPlan: 4-5 specific bullet points for the next 14 days, referencing actual campaign names from the data
- finalRecommendation: 1 closing paragraph with a clear verdict

Return EXACTLY this JSON structure (use null for any value you cannot determine):

{
  "kpis": {
    "adSales": 0.00,
    "adSpend": 0.00,
    "acos": 0.0,
    "roas": 0.00,
    "orders": 0,
    "ctr": 0.0,
    "cvr": 0.0,
    "avgCpc": 0.00
  },
  "executiveSummary": ["bullet 1", "bullet 2", "bullet 3"],
  "clientNeedsToKnow": "paragraph text",
  "channelSnapshot": "paragraph text",
  "topRevenueCampaigns": [
    { "name": "Campaign Name", "spend": 0.00, "sales": 0.00, "acos": 0.0, "orders": 0, "roas": 0.00 }
  ],
  "wastefulSearchTerms": [
    { "term": "search term", "clicks": 0, "spend": 0.00, "sales": 0.00, "action": "Negate or cut bid" }
  ],
  "actionPlan": ["action 1", "action 2", "action 3"],
  "finalRecommendation": "paragraph text"
}

RULES:
- Only use numbers actually present in the data. Do NOT invent metrics.
- Be specific: reference actual campaign names and search terms from the data.
- wastefulSearchTerms: ONLY include terms where sales = 0 and spend > 0. Sort by spend descending.
- topRevenueCampaigns: sort by sales descending.
- Each executiveSummary bullet must include at least one specific number (dollar amount, percentage, count).
- If a field cannot be determined from the data, use null.
- No fluff. Direct and actionable.

`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

        if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not configured.");

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // All parsing happens client-side — we only receive JSON here
        const body = await req.json();
        const clientId: string = body.clientId;
        const fileContent: string = body.rawData || "";
        const fileName: string = body.fileName || "report";
        const reportPeriod: string = body.reportPeriod || new Date().toISOString().substring(0, 7);
        const exactTotals = body.exactTotals || { spend: 0, sales: 0, orders: 0, clicks: 0, impressions: 0 };
        const dateRange = body.dateRange || null; // e.g. { from: '2026-07-13', to: '2026-07-26' }

        if (!clientId) throw new Error("clientId is required");
        if (!fileContent || fileContent.trim().length < 20) throw new Error("File appears empty or too small.");

        console.log(`Analyzing Amazon Ads for client ${clientId}, file: ${fileName}`);

        // Fetch client name
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", clientId)
            .single();

        if (clientError || !client) throw new Error(`Client not found: ${clientError?.message}`);

        // Truncate if still too large
        const maxDataLength = 50000;
        const truncatedData = fileContent.length > maxDataLength
            ? fileContent.substring(0, maxDataLength) + "\n\n[... data truncated for size ...]"
            : fileContent;

        const dateRangeContext = dateRange
            ? `\nREPORTING PERIOD: ${dateRange.from} to ${dateRange.to} (14-day biweekly window)\n`
            : '';

        const preCalculatedContext = `
${"─".repeat(60)}
PRE-CALCULATED ACCURATE TOTALS (use these EXACTLY for the top-level KPIs):
- Ad Spend: ${exactTotals.spend.toFixed(2)}
- Ad Sales: ${exactTotals.sales.toFixed(2)}
- Orders: ${exactTotals.orders}
- Clicks: ${exactTotals.clicks}
- Impressions: ${exactTotals.impressions}${dateRangeContext}
${"─".repeat(60)}
`;

        const userMessage = `${AMAZON_PROMPT}\nClient: ${client.name}\nFile: ${fileName}\n\n${preCalculatedContext}\n\n${"─".repeat(60)}\nAMAZON ADS DATA:\n${truncatedData}\n${"─".repeat(60)}`;

        // Upsert pending
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fileContent));
        const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const { error: upsertError } = await supabase.from("amazon_ads_reports").upsert({
            client_id: clientId,
            report_period: reportPeriod,
            source_file_name: fileName,
            source_file_hash: fileHash,
            generation_status: 'pending'
        }, { onConflict: 'client_id, report_period' });

        if (upsertError) console.error("Failed to upsert pending status:", upsertError);

        // Execute analysis via Chat Completions (single call, no polling, fast)
        console.log("Calling OpenAI Chat Completions for Amazon Ads analysis...");
        try {
            const parsedReport = await callChatCompletion(openaiApiKey, userMessage);

            const { error: updateError } = await supabase
                .from("amazon_ads_reports")
                .update({
                    parsed_data: parsedReport,
                    generated_at: new Date().toISOString(),
                    generation_status: 'complete'
                })
                .eq("client_id", clientId)
                .eq("report_period", reportPeriod);

            if (updateError) console.error("Failed to update report status:", updateError);

            return new Response(JSON.stringify({ status: 'complete', data: parsedReport }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (aiErr) {
            console.error("AI analysis failed:", aiErr);
            await supabase.from("amazon_ads_reports")
                .update({ generation_status: 'failed' })
                .eq("client_id", clientId)
                .eq("report_period", reportPeriod);
            throw aiErr;
        }

    } catch (error) {
        console.error("Error in analyze-amazon-ads:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ─── Chat Completions API (fast, single call, no polling) ────────────────────
async function callChatCompletion(apiKey: string, userMessage: string): Promise<any> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: OPENAI_CHAT_MODEL,
            response_format: { type: "json_object" },
            max_tokens: 4096,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content: "You are an expert Amazon Ads analyst. Always respond with valid JSON only."
                },
                {
                    role: "user",
                    content: userMessage
                }
            ]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API ${res.status}: ${errText.substring(0, 500)}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("Empty response from OpenAI");
    return parseAmazonResponse(text);
}


function parseAmazonResponse(text: string): any {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));

            // Normalise — ensure all expected keys exist
            return {
                kpis: {
                    adSales: parsed.kpis?.adSales ?? null,
                    adSpend: parsed.kpis?.adSpend ?? null,
                    acos: parsed.kpis?.acos ?? null,
                    roas: parsed.kpis?.roas ?? null,
                    orders: parsed.kpis?.orders ?? null,
                    ctr: parsed.kpis?.ctr ?? null,
                    cvr: parsed.kpis?.cvr ?? null,
                    avgCpc: parsed.kpis?.avgCpc ?? null,
                },
                executiveSummary: parsed.executiveSummary || [],
                clientNeedsToKnow: parsed.clientNeedsToKnow || "",
                channelSnapshot: parsed.channelSnapshot || "",
                topRevenueCampaigns: parsed.topRevenueCampaigns || [],
                wastefulSearchTerms: parsed.wastefulSearchTerms || [],
                actionPlan: parsed.actionPlan || [],
                finalRecommendation: parsed.finalRecommendation || "",
            };
        } catch (e) {
            console.warn("JSON parse failed:", e);
        }
    }

    // Fallback: return empty structure
    return {
        kpis: { adSales: null, adSpend: null, acos: null, roas: null, orders: null, ctr: null, cvr: null, avgCpc: null },
        executiveSummary: [text.substring(0, 300)],
        clientNeedsToKnow: "",
        channelSnapshot: "",
        topRevenueCampaigns: [],
        wastefulSearchTerms: [],
        actionPlan: [],
        finalRecommendation: "",
    };
}

