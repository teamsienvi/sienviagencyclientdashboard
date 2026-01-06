import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TikTokPostsRequest {
  from: string;
  to: string;
  timezone: string;
  userId: string;
  blogId?: string;
}

interface TikTokPost {
  title: string | null;
  date: string | null;
  type: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  duration: string | null;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

function parseCSV(csvText: string): TikTokPost[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header line - handle potential BOM and whitespace
  const headerLine = lines[0].replace(/^\uFEFF/, "").trim();
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  
  console.log("CSV Headers:", headers);

  const rows: TikTokPost[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line - handle quoted values
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    // Map values to object
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    // Convert to TikTokPost with numeric casting
    const post: TikTokPost = {
      title: row["title"] || null,
      date: row["date"] || null,
      type: row["type"] || null,
      views: parseInt(row["views"] || "0", 10) || 0,
      likes: parseInt(row["likes"] || "0", 10) || 0,
      comments: parseInt(row["comments"] || "0", 10) || 0,
      shares: parseInt(row["shares"] || "0", 10) || 0,
      reach: parseInt(row["reach"] || "0", 10) || 0,
      duration: row["duration"] || null,
      engagement: parseFloat(row["engageme"] || row["engagement"] || "0") || 0,
      url: row["url"] || null,
      link: row["link"] || null,
      image: row["image"] || null,
    };

    rows.push(post);
  }

  return rows;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TikTokPostsRequest = await req.json();
    const { from, to, timezone, userId, blogId } = body;

    if (!from || !to || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required params: from, to, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL with searchParams to properly encode special characters like +
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/tiktok`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("timezone", timezone || "UTC");
    url.searchParams.set("userId", userId);
    if (blogId) {
      url.searchParams.set("blogId", blogId);
    }

    console.log("Metricool TikTok posts request URL:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    console.log("Metricool upstream status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Metricool upstream error:", response.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "Metricool API error",
          upstreamStatus: response.status,
          upstreamBody: errorBody,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await response.text();
    console.log("CSV response length:", csvText.length);
    console.log("CSV preview:", csvText.substring(0, 500));

    const rows = parseCSV(csvText);
    console.log("Parsed rows count:", rows.length);

    return new Response(
      JSON.stringify({ success: true, rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Edge function error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
