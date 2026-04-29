import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Amazon-specific OpenAI assistant
const AMAZON_ASSISTANT_ID = "asst_YQf5tpRHLbcXtdNuNwIn6RWJ";

// Prompt engineered to match the exact PDF report format
const AMAZON_PROMPT = `You are an expert Amazon Ads analyst. Analyze the following Amazon Ads report data and produce a structured, actionable report.

IMPORTANT: You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no text outside the JSON. Your response must start with { and end with }.

Extract or calculate these values from the data:
- Ad Sales (total revenue attributed to ads)
- Ad Spend (total cost)
- ACoS = (Ad Spend / Ad Sales) * 100
- ROAS = Ad Sales / Ad Spend
- Orders (total order count)
- CTR = (Clicks / Impressions) * 100
- CVR = (Orders / Clicks) * 100
- Avg CPC = Ad Spend / Clicks

Identify:
- Top 5 campaigns by revenue (Sales), include their Spend, Sales, ACoS, Orders, ROAS
- Top 6 search terms with highest spend but ZERO sales (these are wasting budget)

Then write:
- executiveSummary: 3-4 bullet points referencing the actual numbers from the data
- clientNeedsToKnow: 1 honest paragraph about overall account health
- channelSnapshot: 1 paragraph about campaign type breakdown (Sponsored Products vs Brands vs Display, or whatever types are in the data)
- actionPlan: 4-5 specific bullet points for the next 7 days, referencing actual campaign names from the data
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

        if (!openaiApiKey) {
            throw new Error("OPENAI_API_KEY is not configured.");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse multipart form data
        const contentType = req.headers.get("content-type") || "";
        let clientId: string;
        let fileContent: string;
        let fileName: string;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            clientId = formData.get("clientId") as string;
            const reportPeriod = formData.get("reportPeriod") as string || new Date().toISOString().substring(0, 7); // Default to YYYY-MM
            const file = formData.get("file") as File;

            if (!file) {
                throw new Error("No file uploaded. Please upload an Excel (.xlsx) or CSV (.csv) Amazon Ads report.");
            }

            fileName = file.name;
            const fileBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);

            if (fileName.endsWith(".csv")) {
                fileContent = new TextDecoder().decode(fileBytes);
            } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
                fileContent = await parseExcelToText(fileBytes);
            } else {
                throw new Error("Unsupported file format. Please upload .xlsx or .csv files.");
            }
        } else {
            const body = await req.json();
            clientId = body.clientId;
            fileContent = body.rawData || "";
            fileName = body.fileName || "manual-input";
            reportPeriod = body.reportPeriod || new Date().toISOString().substring(0, 7);
        }

        if (!clientId) throw new Error("clientId is required");
        if (!fileContent || fileContent.trim().length < 20) {
            throw new Error("File appears empty or too small.");
        }

        console.log(`Analyzing Amazon Ads for client ${clientId}, file: ${fileName}`);

        // Fetch client name
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", clientId)
            .single();

        if (clientError || !client) throw new Error(`Client not found: ${clientError?.message}`);

        // Truncate if too large
        const maxDataLength = 30000;
        const truncatedData = fileContent.length > maxDataLength
            ? fileContent.substring(0, maxDataLength) + "\n\n[... data truncated ...]"
            : fileContent;

        const userMessage = `${AMAZON_PROMPT}\nClient: ${client.name}\nFile: ${fileName}\n\n${"─".repeat(60)}\nAMAZON ADS DATA:\n${truncatedData}\n${"─".repeat(60)}`;

        // Calculate simple hash for file
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(fileContent);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 1. Upsert Pending Status
        const { error: upsertError } = await supabase
            .from("amazon_ads_reports")
            .upsert({
                client_id: clientId,
                report_period: reportPeriod,
                source_file_name: fileName,
                source_file_hash: fileHash,
                generation_status: 'pending'
            }, { onConflict: 'client_id, report_period' });

        if (upsertError) {
            console.error("Failed to upsert pending status:", upsertError);
        }

        // Execute analysis directly
        console.log("Calling OpenAI assistant for Amazon Ads analysis...");
        
        // Background task wrapper to avoid blocking the HTTP response if it takes too long
        // (Supabase Edge Functions allow up to 5 minutes execution time)
        const processReport = async () => {
            try {
                const parsedReport = await callOpenAIAssistant(openaiApiKey, AMAZON_ASSISTANT_ID, userMessage);
                
                const { error: updateError } = await supabase
                    .from("amazon_ads_reports")
                    .update({
                        parsed_data: parsedReport,
                        generated_at: new Date().toISOString(),
                        generation_status: 'complete'
                    })
                    .eq("client_id", clientId)
                    .eq("report_period", reportPeriod);
                    
                if (updateError) {
                     console.error("Failed to update report status:", updateError);
                } else {
                     console.log("Successfully analyzed and saved Amazon Ads report.");
                }
            } catch (err) {
                console.error("Background processing failed:", err);
                await supabase
                    .from("amazon_ads_reports")
                    .update({ generation_status: 'failed' })
                    .eq("client_id", clientId)
                    .eq("report_period", reportPeriod);
            }
        };

        // If EdgeRuntime is available, use waitUntil to keep the isolate alive
        if (typeof (globalThis as any).EdgeRuntime !== 'undefined' && (globalThis as any).EdgeRuntime.waitUntil) {
            (globalThis as any).EdgeRuntime.waitUntil(processReport());
            return new Response(JSON.stringify({ status: 'pending', message: 'Report is processing in the background' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } else {
            // Otherwise execute synchronously
            await processReport();
            
            // Check if it failed
            const { data: checkData } = await supabase
                .from("amazon_ads_reports")
                .select("generation_status, parsed_data")
                .eq("client_id", clientId)
                .eq("report_period", reportPeriod)
                .single();
                
            if (checkData?.generation_status === 'failed') {
                throw new Error("Analysis failed during processing.");
            }
            
            return new Response(JSON.stringify({ status: 'complete', data: checkData?.parsed_data, message: 'Report processed successfully' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

    } catch (error) {
        console.error("Error in analyze-amazon-ads:", error);
        
        // Try to update failure status if we have the necessary identifiers
        // (In a real background worker, this would be handled cleanly)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ─── Excel Parser ─────────────────────────────────────────────────────────────
async function parseExcelToText(fileBytes: Uint8Array): Promise<string> {
    try {
        const XLSX = await import("https://esm.sh/xlsx@0.18.5");
        const workbook = XLSX.read(fileBytes, { type: "array" });
        const allSheetData: string[] = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
                allSheetData.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            }
        }
        return allSheetData.join("\n\n");
    } catch (err) {
        console.error("Excel parse error:", err);
        return new TextDecoder().decode(fileBytes);
    }
}

// ─── OpenAI Assistants API ────────────────────────────────────────────────────
const OPENAI_BASE = "https://api.openai.com/v1";

async function openaiRequest(apiKey: string, path: string, method: string, body?: unknown): Promise<any> {
    const res = await fetch(`${OPENAI_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API ${res.status}: ${errText.substring(0, 500)}`);
    }
    return res.json();
}

async function callOpenAIAssistant(apiKey: string, assistantId: string, userMessage: string): Promise<any> {
    const thread = await openaiRequest(apiKey, "/threads", "POST", {});
    const threadId = thread.id;

    await openaiRequest(apiKey, `/threads/${threadId}/messages`, "POST", {
        role: "user",
        content: userMessage,
    });

    const run = await openaiRequest(apiKey, `/threads/${threadId}/runs`, "POST", {
        assistant_id: assistantId,
    });
    const runId = run.id;

    // Poll for completion (max 3 minutes)
    const maxWait = 180_000;
    const pollInterval = 2_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        const runStatus = await openaiRequest(apiKey, `/threads/${threadId}/runs/${runId}`, "GET");

        if (runStatus.status === "completed") break;
        if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
            throw new Error(`OpenAI run ${runStatus.status}: ${runStatus.last_error?.message || runStatus.status}`);
        }
        await new Promise((r) => setTimeout(r, pollInterval));
    }

    if (Date.now() - startTime >= maxWait) {
        throw new Error("Analysis timed out after 3 minutes. Try a smaller file.");
    }

    const messages = await openaiRequest(apiKey, `/threads/${threadId}/messages?order=desc&limit=1`, "GET");
    const assistantMessage = messages.data?.[0];

    if (!assistantMessage || assistantMessage.role !== "assistant") {
        throw new Error("No assistant response found");
    }

    let text = "";
    for (const content of assistantMessage.content) {
        if (content.type === "text") { text = content.text.value; break; }
    }

    if (!text) throw new Error("Empty response from OpenAI assistant");

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
