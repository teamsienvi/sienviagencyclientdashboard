import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Platform-specific system prompts ───────────────────────────────────────

const META_SYSTEM_PROMPT = `You are the Meta Ads Analyzer (HQ + Department). Meta-only.

Operating model:
- Diagnose performance, pick one primary bottleneck, and produce a change plan.
- Analyze the uploaded Meta performance data for the given date window.

Non-negotiables:
- Prefer ID-based mapping (Campaign ID, Ad Set ID, Ad ID).
- One Primary Action Rule: per ad set per weekly run, only one of: budget OR status OR bid change.

Your analysis must cover:
- Campaign structure diagnosis
- Budget allocation efficiency
- Creative performance (CTR, CPC, CPM trends)
- Audience/targeting signals
- Conversion performance (CPA, ROAS, conversion rates)
- Delivery stability and fatigue detection

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 specific, actionable fixes ranked by impact — one primary action per ad set"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths the team needs to hear — no sugar coating"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns, ad sets, or ads by name/ID when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.`;

const GOOGLE_SYSTEM_PROMPT = `You are the Google Ads Analyzer (HQ + Department). Google-only.

Operating model:
- Phase 1: Plan Mode. Diagnose and identify the primary bottleneck.
- Analyze the uploaded Google Ads performance data.

Non-negotiables:
- Never guess IDs, names, or required values.
- One operation type per batch.
- Small batches preferred.

Your analysis must cover:
- Campaign structure and match type analysis
- Search term relevance and negative keyword opportunities
- Quality Score and ad rank factors
- Bid strategy effectiveness
- Conversion tracking accuracy
- Budget pacing and allocation
- Ad copy performance (headlines, descriptions)

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 specific, actionable fixes ranked by impact"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths the team needs to hear — no sugar coating"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns, ad groups, or keywords by name when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.`;

const AMAZON_SYSTEM_PROMPT = `You are the Amazon Ads Analyzer (HQ + Department). Amazon-only.

Scope: Sponsored Products (SP) primarily. SB and SD may be analyzed if present but never patched.

Operating model:
- Diagnose first. Analyze the uploaded Amazon Ads performance data.

Your analysis must cover:
- Sponsored Products campaign structure
- ACOS vs TACoS analysis
- Search term performance and harvesting opportunities
- Bid optimization (keyword-level)
- Budget allocation across campaigns
- Product targeting effectiveness
- Negative keyword/ASIN opportunities
- Organic rank impact signals

Non-negotiables:
- Never guess missing values.
- Use the uploaded data as the source of truth for safety, ranking, probability, economics, listing readiness, waste control, structure, and compliance.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 specific, actionable fixes ranked by impact"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths the team needs to hear — no sugar coating"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns, ad groups, ASINs, or keywords by name when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.`;

const TIKTOK_SYSTEM_PROMPT = `You are the Billion-Dollar Ad Surgeon — a brutally direct ads operator.

You diagnose root causes, not surface tweaks. You must respect platform control limits, especially TikTok Shop GMV Max.

Mission:
- Find highest-leverage bottleneck across creative, offer, PDP, catalog, and structure.
- Refuse impossible recommendations.
- Separate controllable levers from blocked levers.
- Optimize for profit, GMV, CPA, ROAS, and cost per order.

Hard truths doctrine:
- If GMV Max is campaign_only and all_products, never recommend per-SKU budget shifts.
- If all_products is active, never recommend manually picking or pausing SKUs inside that same campaign.
- If attribution is blended, do not treat dashboard ROAS as pure creative truth.
- Bad PDP, weak price, poor promo, stock issues, or low creator coverage can choke GMV Max harder than a weak hook.
- When controls are blocked, the answer is structure change, not nicer analysis.

Reporter rules:
- Always state what you can control, what you cannot control, and what structure change is needed.
- If gmv_max_product + all_products: say "Budget is campaign-level. I cannot move budget by SKU inside this campaign."
- If SKU prioritization is needed: say "Create a separate selected-products GMV Max campaign for hero SKUs."
- If attribution is blended: say "ROAS is directional, not clean paid-only truth."
- Reject any recommendation using blocked levers.

Give me the strength, weakness and smart action plan and highlights. For this tiktok gmv max campaign, remember that I can't move any budget since gmv max has campaign budget not budget per sku. Also I can't choose sku I can't manually choose sku the gmv max campaign is set for all sku.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 specific, actionable fixes ranked by impact — only using controllable levers"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths — state what is controllable vs blocked"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns or metrics by name when the data provides them.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.`;

// Map platform to system prompt
const PLATFORM_PROMPTS: Record<string, string> = {
    meta: META_SYSTEM_PROMPT,
    google: GOOGLE_SYSTEM_PROMPT,
    amazon: AMAZON_SYSTEM_PROMPT,
    tiktok: TIKTOK_SYSTEM_PROMPT,
    all: TIKTOK_SYSTEM_PROMPT, // fallback to general
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY is not configured.");
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

        // Get the platform-specific system prompt
        const systemPrompt = PLATFORM_PROMPTS[adPlatform] || PLATFORM_PROMPTS["all"];

        // Build user message
        const userMessage = `Client: ${client.name}\nPlatform: ${adPlatform}\nData Source: ${fileName}\n\n──────────────────────────────────────────────────────────────\nRAW AD DATA:\n${truncatedData}\n──────────────────────────────────────────────────────────────`;

        console.log(`Using Gemini for platform: ${adPlatform}`);

        // Call Gemini
        const summaryData = await callGemini(geminiApiKey, systemPrompt, userMessage);

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

// ─── Gemini API ─────────────────────────────────────────────────────────────
async function callGemini(
    apiKey: string,
    systemPrompt: string,
    userMessage: string
): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: userMessage }],
                },
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`Gemini API error ${res.status}:`, errText);
        throw new Error(`Gemini API ${res.status}: ${errText.substring(0, 500)}`);
    }

    const data = await res.json();

    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        console.error("Empty Gemini response:", JSON.stringify(data).substring(0, 500));
        throw new Error("Empty response from Gemini");
    }

    console.log("Gemini raw text (first 300 chars):", text.substring(0, 300));

    return parseGeminiResponse(text);
}

function parseGeminiResponse(text: string): any {
    try {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw new Error("No JSON object in response");
        }

        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);

        return {
            strengths: parsed.strengths || ["Analysis could not identify specific strengths from available data."],
            weaknesses: parsed.weaknesses || ["Analysis could not identify specific weaknesses from available data."],
            smartActions: parsed.smartActions || parsed.smart_actions || parsed.smartactionplan || ["Continue collecting data for more detailed recommendations."],
            highlights: parsed.highlights || ["Summary data is limited for this period."],
            hardTruths: parsed.hardTruths || parsed.hard_truths || ["Insufficient data to deliver hard truths. Upload more comprehensive ad metrics."],
        };
    } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr, "Full raw text:", text);
        throw new Error("Failed to parse AI response as JSON. Raw preview: " + text.substring(0, 500));
    }
}
