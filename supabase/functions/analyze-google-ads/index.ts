import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_CHAT_MODEL = "gpt-4o-mini";

const GOOGLE_ADS_PROMPT = `You are an expert Google Ads analyst. Analyze the following Google Ads campaign report data and produce a structured, actionable report.

IMPORTANT: You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON. Your response must start with { and end with }.

Your analysis must capture:
- Spend (Use the EXACT pre-calculated total provided)
- Impressions (Use the EXACT pre-calculated total provided)
- Clicks (Use the EXACT pre-calculated total provided)
- CTR = (Clicks / Impressions) * 100
- Conversions (Use the EXACT pre-calculated total provided)
- Conv. Value (Use the EXACT pre-calculated total provided)
- ROAS = Conv. Value / Spend
- Cost per Conversion = Spend / Conversions (or null if Conversions is 0)
- Avg. CPC = Spend / Clicks
- Interaction Rate (e.g. Clicks/Impressions or custom from data, use null if not provided)
- Campaign Type (e.g. Performance Max, Search, Display)
- Status (e.g. Eligible, Eligible (Limited), Paused)

Identify:
- Campaign Performance: list every campaign with its Campaign Name, Type, Status, Spend, Impressions, Clicks, CTR, Conversions, and Conv. Value.
- Google Ads Diagnosis:
  - Traffic Signal: a brief assessment of traffic volume, click quality, and CPC.
  - Conversion Health: a brief assessment of conversion tracking, conversion count, value, and blocker to scaling.
  - Account Constraint: a brief assessment of account status, bid strategy status (e.g., learning), and asset policies (e.g., limited by policy).
- Key Issues To Fix: a list of issues containing "area" (e.g. Tracking, Policy, Structure, Intent), "currentSignal", "recommendedMove", and "priority" (e.g. High, Medium, Low).
- Action Plan for the Next 7 Days: 5-6 bullet points of specific action items.
- Final Recommendation: 1 closing paragraph with a clear verdict.

Return EXACTLY this JSON structure:
{
  "kpis": {
    "spend": 0.00,
    "impressions": 0,
    "clicks": 0,
    "ctr": 0.0,
    "conversions": 0,
    "convValue": 0.00,
    "roas": 0.00,
    "costPerConv": null,
    "avgCpc": 0.00,
    "interactionRate": 0.00,
    "campaignType": "Performance Max",
    "status": "Eligible (Limited)"
  },
  "executiveSummary": ["bullet 1", "bullet 2", "bullet 3"],
  "clientNeedsToKnow": "paragraph text",
  "campaignPerformance": [
    { "campaign": "Campaign Name", "type": "Performance Max", "status": "Eligible", "spend": 0.00, "impressions": 0, "clicks": 0, "ctr": 0.00, "conversions": 0, "convValue": 0.00 }
  ],
  "diagnosis": {
    "trafficSignal": "text here",
    "conversionHealth": "text here",
    "accountConstraint": "text here"
  },
  "keyIssues": [
    { "area": "Tracking", "currentSignal": "0 purchases", "recommendedMove": "Verify tracking", "priority": "High" }
  ],
  "actionPlan": ["action 1", "action 2"],
  "finalRecommendation": "paragraph text"
}

RULES:
- ONLY use numbers actually present in the data or mathematically calculated from them. Do NOT invent metrics.
- Be specific: name campaigns, ad groups, or keywords by name when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet in lists should be 1-2 sentences max.
- Your response must start with { and end with } — nothing else.
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

        const body = await req.json();
        const clientId: string = body.clientId;
        const fileContent: string = body.rawData || "";
        const fileName: string = body.fileName || "report";
        const reportPeriod: string = body.reportPeriod || new Date().toISOString().substring(0, 7);
        const exactTotals = body.exactTotals || { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };

        if (!clientId) throw new Error("clientId is required");
        if (!fileContent || fileContent.trim().length < 20) throw new Error("File appears empty or too small.");

        console.log(`Analyzing Google Ads for client ${clientId}, file: ${fileName}`);

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

        const preCalculatedContext = `
────────────────────────────────────────────────────────────
PRE-CALCULATED ACCURATE TOTALS (use these EXACTLY for the top-level KPIs):
- Spend: ${exactTotals.spend.toFixed(2)}
- Impressions: ${exactTotals.impressions}
- Clicks: ${exactTotals.clicks}
- Conversions: ${exactTotals.conversions}
- Conversion Value (Sales): ${exactTotals.convValue.toFixed(2)}
────────────────────────────────────────────────────────────
`;

        const userMessage = `${GOOGLE_ADS_PROMPT}\nClient: ${client.name}\nFile: ${fileName}\n\n${preCalculatedContext}\n\n────────────────────────────────────────────────────────────\nGOOGLE ADS DATA:\n${truncatedData}\n────────────────────────────────────────────────────────────`;

        // Upsert pending
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fileContent));
        const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const { error: upsertError } = await supabase.from("google_ads_reports").upsert({
            client_id: clientId,
            report_period: reportPeriod,
            source_file_name: fileName,
            source_file_hash: fileHash,
            generation_status: 'pending'
        }, { onConflict: 'client_id, report_period' });

        if (upsertError) console.error("Failed to upsert pending status:", upsertError);

        // Execute analysis via Chat Completions
        console.log("Calling OpenAI Chat Completions for Google Ads analysis...");
        try {
            const parsedReport = await callChatCompletion(openaiApiKey, userMessage);

            const { error: updateError } = await supabase
                .from("google_ads_reports")
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
            await supabase.from("google_ads_reports")
                .update({ generation_status: 'failed' })
                .eq("client_id", clientId)
                .eq("report_period", reportPeriod);
            throw aiErr;
        }

    } catch (error) {
        console.error("Error in analyze-google-ads:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

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
                    content: "You are an expert Google Ads analyst. Always respond with valid JSON only matching the requested format."
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
    return parseGoogleResponse(text);
}

function parseGoogleResponse(text: string): any {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));

            // Normalise — ensure all expected keys exist
            return {
                kpis: {
                    spend: parsed.kpis?.spend ?? null,
                    impressions: parsed.kpis?.impressions ?? null,
                    clicks: parsed.kpis?.clicks ?? null,
                    ctr: parsed.kpis?.ctr ?? null,
                    conversions: parsed.kpis?.conversions ?? null,
                    convValue: parsed.kpis?.convValue ?? null,
                    roas: parsed.kpis?.roas ?? null,
                    costPerConv: parsed.kpis?.costPerConv ?? null,
                    avgCpc: parsed.kpis?.avgCpc ?? null,
                    interactionRate: parsed.kpis?.interactionRate ?? null,
                    campaignType: parsed.kpis?.campaignType || "Search",
                    status: parsed.kpis?.status || "Eligible",
                },
                executiveSummary: parsed.executiveSummary || [],
                clientNeedsToKnow: parsed.clientNeedsToKnow || "",
                campaignPerformance: parsed.campaignPerformance || [],
                diagnosis: {
                    trafficSignal: parsed.diagnosis?.trafficSignal || "",
                    conversionHealth: parsed.diagnosis?.conversionHealth || "",
                    accountConstraint: parsed.diagnosis?.accountConstraint || "",
                },
                keyIssues: parsed.keyIssues || [],
                actionPlan: parsed.actionPlan || [],
                finalRecommendation: parsed.finalRecommendation || "",
            };
        } catch (e) {
            console.error("Failed to parse JSON response:", e);
            throw new Error("Invalid JSON structure returned by model");
        }
    }
    throw new Error("No JSON object found in OpenAI response");
}
