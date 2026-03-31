import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── OpenAI Assistant ID Mapping ────────────────────────────────────────────
const ASSISTANT_IDS: Record<string, string> = {
    meta: "asst_iZ6DPy2JACkHIcGIR9n8sUZG",
    google: "asst_iP6yG99Hn5ErReNxgBwzZ1Kq",
    amazon: "asst_YQf5tpRHLbcXtdNuNwIn6RWJ",
    tiktok: "asst_417YSXWwLtO5paLn3mVTR71c",     // general "billion-dollar" assistant
    all: "asst_417YSXWwLtO5paLn3mVTR71c",         // fallback to general
};

// Special TikTok GMV Max preamble
const TIKTOK_PREAMBLE = `Give me the strength, weakness and smart action plan and highlights. For this tiktok gmv max campaign, remember that I can't move any budget since gmv max has campaign budget not budget per sku. Also I can't choose sku I can't manually choose sku the gmv max campaign is set for all sku.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 highly specific, step-by-step actions for a Client Action Plan, tailored exactly to the client's actual data — only using controllable levers"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths — state what is controllable vs blocked"]
}

`;

// Default analysis instructions for non-TikTok platforms
const DEFAULT_INSTRUCTIONS = `Analyze the following ad performance data. Provide a brutally honest analysis looking at:
- Spend efficiency (CPC, CPM trends)
- Conversion performance (CPA, ROAS, conversion rates)
- Creative effectiveness (CTR patterns, which campaigns/ads perform best vs worst)
- Budget allocation (is spend going to the right campaigns?)
- Audience/targeting signals (any patterns in which segments convert better?)

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 highly specific, step-by-step actions for a Client Action Plan, tailored exactly to the client's actual data"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths the team needs to hear — no sugar coating"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns, ad sets, or ads by name when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.

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
            throw new Error("OPENAI_API_KEY is not configured. Set it via: supabase secrets set OPENAI_API_KEY=sk-...");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse multipart form data
        const contentType = req.headers.get("content-type") || "";
        let clientId: string;
        let adPlatform: string;
        let fileContent: string;
        let fileName: string;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            clientId = formData.get("clientId") as string;
            adPlatform = formData.get("adPlatform") as string || "all";
            const file = formData.get("file") as File;

            if (!file) {
                throw new Error("No file uploaded. Please upload an Excel (.xlsx) or CSV (.csv) file with ad metrics.");
            }

            fileName = file.name;
            const fileBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);

            // Parse different file formats
            if (fileName.endsWith(".csv")) {
                fileContent = new TextDecoder().decode(fileBytes);
            } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
                fileContent = await parseExcelToText(fileBytes);
            } else {
                throw new Error("Unsupported file format. Please upload .xlsx or .csv files.");
            }
        } else {
            // JSON body fallback
            const body = await req.json();
            clientId = body.clientId;
            adPlatform = body.adPlatform || "all";
            fileContent = body.rawData || "";
            fileName = body.fileName || "manual-input";
        }

        if (!clientId) {
            throw new Error("clientId is required");
        }

        console.log(`Generating ads summary for client ${clientId}, platform: ${adPlatform}, file: ${fileName}`);

        // Fetch client name
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", clientId)
            .single();

        if (clientError || !client) {
            throw new Error(`Client not found: ${clientError?.message}`);
        }

        if (!fileContent || fileContent.trim().length < 20) {
            throw new Error("File appears empty or too small. Please upload a file with ad metrics data.");
        }

        // Truncate data if too large
        const maxDataLength = 30000;
        const truncatedData = fileContent.length > maxDataLength
            ? fileContent.substring(0, maxDataLength) + "\n\n[... data truncated for analysis ...]"
            : fileContent;

        // Build the user message
        const preamble = adPlatform === "tiktok" ? TIKTOK_PREAMBLE : DEFAULT_INSTRUCTIONS;
        const userMessage = `${preamble}Client: ${client.name}\nPlatform: ${adPlatform}\nData Source: ${fileName}\n\n──────────────────────────────────────────────────────────────\nRAW AD DATA:\n${truncatedData}\n──────────────────────────────────────────────────────────────`;

        // Resolve the assistant ID
        const assistantId = ASSISTANT_IDS[adPlatform] || ASSISTANT_IDS["all"];
        console.log(`Using OpenAI assistant: ${assistantId} for platform: ${adPlatform}`);

        // Call OpenAI Assistant
        const summaryData = await callOpenAIAssistant(openaiApiKey, assistantId, userMessage);

        // Cache the result
        try {
            await supabase
                .from("ads_analytics_summaries" as any)
                .upsert(
                    {
                        client_id: clientId,
                        type: adPlatform,
                        summary_data: summaryData,
                        file_name: fileName,
                        generated_at: new Date().toISOString(),
                    },
                    { onConflict: "client_id,type" }
                );
        } catch (cacheErr) {
            console.warn("Failed to cache ads summary:", cacheErr);
        }

        return new Response(JSON.stringify(summaryData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error in generate-ads-summary:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ─── Excel Parser ───────────────────────────────────────────────────────────
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

// ─── OpenAI Assistants API ──────────────────────────────────────────────────
const OPENAI_BASE = "https://api.openai.com/v1";

async function openaiRequest(
    apiKey: string,
    path: string,
    method: string,
    body?: unknown
): Promise<any> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
    };

    const res = await fetch(`${OPENAI_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`OpenAI API error ${res.status}:`, errText);
        throw new Error(`OpenAI API ${res.status}: ${errText.substring(0, 500)}`);
    }

    return res.json();
}

async function callOpenAIAssistant(
    apiKey: string,
    assistantId: string,
    userMessage: string
): Promise<any> {
    // 1. Create a thread
    const thread = await openaiRequest(apiKey, "/threads", "POST", {});
    const threadId = thread.id;
    console.log(`Created thread: ${threadId}`);

    // 2. Add user message to thread
    await openaiRequest(apiKey, `/threads/${threadId}/messages`, "POST", {
        role: "user",
        content: userMessage,
    });

    // 3. Create a run
    const run = await openaiRequest(apiKey, `/threads/${threadId}/runs`, "POST", {
        assistant_id: assistantId,
    });
    let runId = run.id;
    console.log(`Created run: ${runId}`);

    // 4. Poll for completion (max 120 seconds)
    const maxWait = 120_000;
    const pollInterval = 2_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        const runStatus = await openaiRequest(
            apiKey,
            `/threads/${threadId}/runs/${runId}`,
            "GET"
        );

        console.log(`Run status: ${runStatus.status}`);

        if (runStatus.status === "completed") {
            break;
        } else if (
            runStatus.status === "failed" ||
            runStatus.status === "cancelled" ||
            runStatus.status === "expired"
        ) {
            const errMsg = runStatus.last_error?.message || runStatus.status;
            throw new Error(`OpenAI run ${runStatus.status}: ${errMsg}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // 5. Get messages
    const messages = await openaiRequest(
        apiKey,
        `/threads/${threadId}/messages?order=desc&limit=1`,
        "GET"
    );

    const assistantMessage = messages.data?.[0];
    if (!assistantMessage || assistantMessage.role !== "assistant") {
        throw new Error("No assistant response found in thread");
    }

    // Extract text content
    let text = "";
    for (const content of assistantMessage.content) {
        if (content.type === "text") {
            text = content.text.value;
            break;
        }
    }

    if (!text) {
        throw new Error("Empty text response from OpenAI assistant");
    }

    console.log("OpenAI raw text (first 300 chars):", text.substring(0, 300));

    // Parse JSON from the response
    return parseAssistantResponse(text);
}

function parseAssistantResponse(text: string): any {
    // First, try to extract JSON from the response
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            const parsed = JSON.parse(jsonStr);

            // Log actual keys so we can debug mismatches
            console.log("Parsed JSON keys:", Object.keys(parsed));

            // Flexible key resolver — checks many possible aliases
            const resolve = (keys: string[], fallback: string[]): string[] => {
                for (const k of keys) {
                    if (parsed[k] && Array.isArray(parsed[k]) && parsed[k].length > 0) {
                        return parsed[k];
                    }
                }
                return fallback;
            };

            return {
                strengths: resolve(
                    ["strengths", "strength", "Strengths", "Strength"],
                    ["Analysis could not identify specific strengths from available data."]
                ),
                weaknesses: resolve(
                    ["weaknesses", "weakness", "Weaknesses", "Weakness"],
                    ["Analysis could not identify specific weaknesses from available data."]
                ),
                smartActions: resolve(
                    ["smartActions", "smart_actions", "smartactionplan", "smart_action_plan",
                     "SmartActions", "Smart_Actions", "action_plan", "actionPlan",
                     "recommendations", "actions", "smart_action"],
                    ["Continue collecting data for more detailed recommendations."]
                ),
                highlights: resolve(
                    ["highlights", "highlight", "Highlights", "Highlight",
                     "observations", "key_observations"],
                    ["Summary data is limited for this period."]
                ),
                hardTruths: resolve(
                    ["hardTruths", "hard_truths", "HardTruths", "Hard_Truths",
                     "hardtruth", "hard_truth"],
                    ["Insufficient data to deliver hard truths. Upload more comprehensive ad metrics."]
                ),
            };
        } catch (jsonErr) {
            console.warn("JSON parse failed, falling back to text extraction:", jsonErr);
        }
    }

    // Fallback: structure plain text into the expected format
    console.log("No valid JSON found — structuring plain text response");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // Try to split by section headers (Strengths, Weaknesses, etc.)
    const sections: Record<string, string[]> = {
        strengths: [],
        weaknesses: [],
        smartActions: [],
        highlights: [],
        hardTruths: [],
    };

    let currentSection = "highlights"; // default bucket
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("strength")) { currentSection = "strengths"; continue; }
        if (lower.includes("weakness") || lower.includes("weaknesses")) { currentSection = "weaknesses"; continue; }
        if (lower.includes("smart action") || lower.includes("action plan") || lower.includes("recommendation")) { currentSection = "smartActions"; continue; }
        if (lower.includes("highlight") || lower.includes("observation")) { currentSection = "highlights"; continue; }
        if (lower.includes("hard truth") || lower.includes("uncomfortable")) { currentSection = "hardTruths"; continue; }

        // Clean bullet markers
        const cleaned = line.replace(/^[-•*\d.]+\s*/, "").trim();
        if (cleaned.length > 10) {
            sections[currentSection].push(cleaned);
        }
    }

    return {
        strengths: sections.strengths.length > 0 ? sections.strengths : ["Analysis returned in non-standard format. See highlights for details."],
        weaknesses: sections.weaknesses.length > 0 ? sections.weaknesses : ["Analysis returned in non-standard format. See highlights for details."],
        smartActions: sections.smartActions.length > 0 ? sections.smartActions : ["Re-run analysis for structured recommendations."],
        highlights: sections.highlights.length > 0 ? sections.highlights : [text.substring(0, 300)],
        hardTruths: sections.hardTruths.length > 0 ? sections.hardTruths : ["Re-run analysis for structured hard truths."],
    };
}
