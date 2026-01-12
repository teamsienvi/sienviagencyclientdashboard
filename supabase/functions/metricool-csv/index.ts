import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

// Convert value to number if possible, empty numeric -> 0
function parseValue(value: string, isNumericField: boolean): string | number {
  const trimmed = value.trim();
  
  if (isNumericField) {
    if (trimmed === "" || trimmed === "-" || trimmed === "N/A") {
      return 0;
    }
    // Handle percentage values
    if (trimmed.endsWith("%")) {
      const num = parseFloat(trimmed.replace("%", ""));
      return isNaN(num) ? 0 : num;
    }
    // Handle time format (e.g., "00:00:05")
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed; // Keep as string for time values
    }
    const num = parseFloat(trimmed.replace(/,/g, ""));
    return isNaN(num) ? 0 : num;
  }
  
  return trimmed;
}

// Numeric field names for LinkedIn posts CSV
const numericFields = new Set([
  "Reactions", "LikeReactions", "PraiseReactions", "AppreciationReactions",
  "EmpathyReactions", "InterestReactions", "EntertainmentReactions",
  "Comments", "Shares", "Impressions", "Unique Impressions", "Engagement",
  "Vid. Views", "Viewers"
]);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");
    if (!METRICOOL_AUTH) {
      console.error("METRICOOL_AUTH secret not configured");
      return new Response(
        JSON.stringify({ error: "METRICOOL_AUTH secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { path, params } = await req.json();
    
    if (!path) {
      return new Response(
        JSON.stringify({ error: "path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the URL with query parameters
    const queryString = params ? new URLSearchParams(params).toString() : "";
    const url = `https://app.metricool.com${path}${queryString ? `?${queryString}` : ""}`;
    
    console.log("Fetching Metricool CSV:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    const responseText = await response.text();
    console.log("Metricool CSV response status:", response.status);

    // If non-200, return upstream status and body for debugging
    if (!response.ok) {
      console.error("Metricool upstream error:", response.status, responseText);
      return new Response(
        JSON.stringify({ 
          success: false,
          upstreamStatus: response.status, 
          upstreamBody: responseText 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV to JSON rows
    const lines = responseText.split("\n").filter(line => line.trim());
    
    if (lines.length === 0) {
      return new Response(
        JSON.stringify({ success: true, rows: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First line is headers
    const headers = parseCSVLine(lines[0]);
    console.log("CSV headers:", headers);

    // Map CSV columns to JSON field names for LinkedIn
    const columnMap: Record<string, string> = {
      "Title": "title",
      "Date": "date",
      "URL": "url",
      "Reactions": "reactions_total",
      "LikeReactions": "reactions_like",
      "PraiseReactions": "reactions_praise",
      "AppreciationReactions": "reactions_appreciation",
      "EmpathyReactions": "reactions_empathy",
      "InterestReactions": "reactions_interest",
      "EntertainmentReactions": "reactions_entertainment",
      "Comments": "comments",
      "Shares": "shares",
      "Impressions": "impressions",
      "Unique Impressions": "unique_impressions",
      "Engagement": "engagement",
      "Vid. Views": "video_views",
      "Viewers": "viewers",
      "Time Watched": "time_watched_total",
      "Time Watched (avg)": "time_watched_avg",
      "Type": "type",
    };

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string | number> = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j] || "";
        const fieldName = columnMap[header] || header.toLowerCase().replace(/\s+/g, "_");
        const isNumeric = numericFields.has(header);
        row[fieldName] = parseValue(value, isNumeric);
      }
      
      rows.push(row);
    }

    console.log(`Parsed ${rows.length} rows from CSV`);

    return new Response(
      JSON.stringify({ success: true, rows }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in metricool-csv:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
