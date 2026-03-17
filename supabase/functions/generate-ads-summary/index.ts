import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Shredder Ads Analyzer System Prompt ────────────────────────────────────
const SHREDDER_SYSTEM_PROMPT = `You are The Billion-Dollar Ad Surgeon — an elite ads operator and strategist. You are brutally honest, direct, and outcome-obsessed. You think in systems and root causes, not surface tweaks. You care about the user's success enough to call out excuses and force high standards.

MISSION:
1) Identify the critical gaps holding the ads back.
2) Design specific action plans to close those gaps.
3) Push beyond comfort zone, call out blind spots and rationalizations.
4) Focus on leverage that maximizes profit.
5) Provide specific frameworks and mental models.

HARD TRUTHS DOCTRINE (always apply):
- PCM coverage is often incomplete. Fun (≈"Rebel"), Feel (≈"Harmonizer"), Facts (≈"Thinker") coverage must be evaluated.
- Creative is judged without enough context variables (offer, audience, stage, platform norms).
- Most teams optimize thumbnails and hooks while ignoring message-market match and proof architecture.
- Without brutal, machine-readable checklists, analysis drifts into vibes. Use hard signals tied to outcomes.
- Stop thinking ad-by-ad. Think system: pre-click message → post-click congruence → economics.

SCORING MODEL - Overall Creative Effectiveness (OCE):
OCE = 0.35*HookIndex + 0.25*MessageClarity + 0.20*ProofDensity + 0.10*FrictionInverse + 0.10*PCM_Alignment

ENFORCEMENT CHECKLISTS:
- One Promise Rule: one primary outcome in first 5-7 seconds
- Proof in the Hook: stat/demo/visual proof before second 7
- CTA Congruence: CTA verb mirrors offer type (try/buy/book)
- Visual Text Budget: ≤7 words per card on short-form; ≤3 overlays per 10s
- Social Risk Killers: show guarantee/trial/returns
- Platform Native: lo-fi UGC for TikTok/Meta; polished demo for YouTube
- Post-click Match: LP headline + hero restate the same promise

OPERATING RULES:
- Kill rules: Pause any variant with OCE < 45 after 1k impressions
- Scale rules: Duplicate & budget-increase any variant with OCE > 70 and CPA below target for 48h`;

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

        if (!googleApiKey) {
            throw new Error("No Gemini/Google API key configured");
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
                // For Excel files, read as CSV-like text using a simple parser
                fileContent = await parseExcelToText(fileBytes);
            } else {
                throw new Error("Unsupported file format. Please upload .xlsx or .csv files.");
            }
        } else {
            // JSON body fallback (for testing or direct data input)
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

        // Build the analysis prompt
        const prompt = buildAdsPrompt(client.name, adPlatform, fileContent, fileName);

        // Call Gemini
        const summaryData = await callGemini(googleApiKey, prompt);

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
// Simple XLSX parser for Deno — extracts text content from Excel files
async function parseExcelToText(fileBytes: Uint8Array): Promise<string> {
    try {
        // Use the SheetJS library from esm.sh for Excel parsing
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
        // If Excel parsing fails, try treating as plain text
        return new TextDecoder().decode(fileBytes);
    }
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────
function buildAdsPrompt(
    clientName: string,
    adPlatform: string,
    rawData: string,
    fileName: string
): string {
    // Truncate data if too large (Gemini context limit)
    const maxDataLength = 15000;
    const truncatedData = rawData.length > maxDataLength
        ? rawData.substring(0, maxDataLength) + "\n\n[... data truncated for analysis ...]"
        : rawData;

    return `${SHREDDER_SYSTEM_PROMPT}

──────────────────────────────────────────────────────────────

ANALYZE THE FOLLOWING AD PERFORMANCE DATA.

Client: ${clientName}
Platform: ${adPlatform}
Data Source: ${fileName}
Analysis Mode: narrative + structured output

──────────────────────────────────────────────────────────────
RAW AD DATA:
${truncatedData}
──────────────────────────────────────────────────────────────

Based on this ad data, provide a brutally honest analysis. Look at:
- Spend efficiency (CPC, CPM trends)
- Conversion performance (CPA, ROAS, conversion rates)
- Creative effectiveness (CTR patterns, which campaigns/ads perform best vs worst)
- Budget allocation (is spend going to the right campaigns?)
- Audience/targeting signals (any patterns in which segments convert better?)

OUTPUT FORMAT — respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "strengths": ["3-5 things working well with specific numbers from the data"],
  "weaknesses": ["3-5 critical gaps or underperforming areas with specific numbers"],
  "smartActions": ["3-5 specific, actionable fixes ranked by impact. Each must tie to a metric (CTR, CPA, ROAS). Include concrete suggestions like 'Kill Campaign X (CPA $45 vs target $20)' or 'Scale Campaign Y — ROAS 4.2x, increase budget 30%'"],
  "highlights": ["2-4 key observations, milestones, or urgent flags worth noting"],
  "hardTruths": ["2-4 uncomfortable truths the team needs to hear — no sugar coating"]
}

RULES:
- ONLY reference numbers actually present in the data. Do NOT invent metrics.
- Be specific: name campaigns, ad sets, or ads by name when the data provides them.
- Tie every recommendation to a measurable outcome (CTR, CPA, ROAS, spend).
- If data is limited, acknowledge it and focus on what IS available.
- No fluff. No pleasantries. Direct and actionable.
- Each bullet should be 1-2 sentences max.`;
}

// ─── Gemini API ─────────────────────────────────────────────────────────────
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
    const parts = result?.candidates?.[0]?.content?.parts;

    if (!parts || parts.length === 0) {
        throw new Error("Empty response from Gemini");
    }

    let text = "";
    for (const part of parts) {
        if (part.text) text = part.text;
    }

    if (!text) {
        throw new Error("Empty text response from Gemini");
    }

    console.log("Gemini raw text (first 300 chars):", text.substring(0, 300));

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
            smartActions: parsed.smartActions || ["Continue collecting data for more detailed recommendations."],
            highlights: parsed.highlights || ["Summary data is limited for this period."],
            hardTruths: parsed.hardTruths || ["Insufficient data to deliver hard truths. Upload more comprehensive ad metrics."],
        };
    } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr, "Full raw text:", text);
        throw new Error("Failed to parse AI response as JSON. Raw preview: " + text.substring(0, 500));
    }
}
