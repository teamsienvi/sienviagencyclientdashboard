import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Diagnostic edge function: fetches raw Metricool CSV for a client/platform/period
 * and returns the raw headers + every row's type/format/url fields.
 * 
 * Used to determine exactly what type values Metricool sends for reels vs posts.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    /*
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user && !authError) {
        const { data: roleData } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
        if (roleData?.role !== "admin") {
          return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }
    */

    const { clientId, platform = "instagram", periodStart, periodEnd } = await req.json();

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get config
    const { data: config } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id, reporting_timezone")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: `No config for ${platform}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN") || Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(JSON.stringify({ error: "No Metricool auth" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tz = config.reporting_timezone || "America/Chicago";
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const endDate = periodEnd || new Date().toISOString().split("T")[0];

    // Fetch raw CSV
    const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/reels/${platform}`);
    postsUrl.searchParams.set("from", `${startDate}T00:00:00`);
    postsUrl.searchParams.set("to", `${endDate}T23:59:59`);
    postsUrl.searchParams.set("timezone", tz);
    postsUrl.searchParams.set("userId", config.user_id);
    if (config.blog_id) postsUrl.searchParams.set("blogId", config.blog_id);

    const csvRes = await fetch(postsUrl.toString(), {
      headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
    });

    if (!csvRes.ok) {
      return new Response(JSON.stringify({ error: `Metricool ${csvRes.status}`, body: (await csvRes.text()).substring(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const csvText = await csvRes.text();

    // Parse CSV
    const parseCSVLine = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ""; }
        else { current += char; }
      }
      values.push(current.trim());
      return values;
    };

    const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const records: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      if (char === '"') { inQuotes = !inQuotes; current += char; }
      else if (char === "\n" && !inQuotes) { if (current.trim()) records.push(current); current = ""; }
      else { current += char; }
    }
    if (current.trim()) records.push(current);

    if (records.length < 1) {
      return new Response(JSON.stringify({ error: "Empty CSV", csvPreview: csvText.substring(0, 500) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const headerLine = records[0].replace(/^\uFEFF/, "").trim();
    const headers = parseCSVLine(headerLine).map(h => h.trim());
    const headersLower = headers.map(h => h.toLowerCase());

    // Find type-related column indices
    const typeIdx = headersLower.findIndex(h => h === "type");
    const formatIdx = headersLower.findIndex(h => h === "format");
    const idIdx = headersLower.findIndex(h => h === "id");
    const urlIdx = headersLower.findIndex(h => h === "url");
    const timestampIdx = headersLower.findIndex(h => h === "timestamp" || h === "date" || h === "published");

    // Extract type info for every row
    const rowDetails: any[] = [];
    const typeDistribution: Record<string, number> = {};

    for (let i = 1; i < records.length; i++) {
      const values = parseCSVLine(records[i]);
      const typeVal = typeIdx >= 0 ? values[typeIdx] : null;
      const formatVal = formatIdx >= 0 ? values[formatIdx] : null;
      const idVal = idIdx >= 0 ? values[idIdx] : null;
      const urlVal = urlIdx >= 0 ? values[urlIdx] : null;
      const dateVal = timestampIdx >= 0 ? values[timestampIdx] : null;

      const effectiveType = typeVal || formatVal || "UNKNOWN";
      typeDistribution[effectiveType] = (typeDistribution[effectiveType] || 0) + 1;

      rowDetails.push({
        row: i,
        id: idVal?.substring(0, 30),
        type: typeVal,
        format: formatVal,
        hasReelInUrl: urlVal ? /\/reel\//i.test(urlVal) : false,
        url: urlVal?.substring(0, 80),
        date: dateVal,
      });
    }

    // Also check what's stored in DB
    const { data: dbContent } = await supabase
      .from("social_content")
      .select("id, content_id, content_type, title, url, published_at")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .gte("published_at", `${startDate}T00:00:00`)
      .lte("published_at", `${endDate}T23:59:59`)
      .order("published_at", { ascending: false });

    const dbTypeDist: Record<string, number> = {};
    (dbContent || []).forEach((c: any) => {
      dbTypeDist[c.content_type || "null"] = (dbTypeDist[c.content_type || "null"] || 0) + 1;
    });

    return new Response(JSON.stringify({
      success: true,
      config: { userId: config.user_id, blogId: config.blog_id, timezone: tz },
      period: { startDate, endDate },
      csvHeaders: headers,
      totalRows: records.length - 1,
      typeDistribution,
      rowDetails: rowDetails.slice(0, 30), // First 30 rows for inspection
      dbContent: {
        totalStored: (dbContent || []).length,
        typeDistribution: dbTypeDist,
        items: (dbContent || []).slice(0, 15).map((c: any) => ({
          id: c.id,
          content_id: c.content_id,
          content_type: c.content_type,
          title: c.title?.substring(0, 50),
          url: c.url?.substring(0, 80),
          published_at: c.published_at,
        })),
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
