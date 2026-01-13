import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV line handling quoted fields + configurable delimiter
function parseCSVLine(line: string, delimiter: string = ","): string[] {
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
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;

  if (semi > comma && semi > tab) return ";";
  if (tab > comma && tab > semi) return "\t";
  return ",";
}

// Metricool's LinkedIn export sometimes includes commas inside the Title field without quoting.
// In that case, a naive split produces more values than headers; we stitch the overflow back
// into the first column (Title) so the rest of the columns line up.
function alignValuesToHeaders(headers: string[], values: string[], delimiter: string): string[] {
  if (values.length === headers.length) return values;

  if (values.length > headers.length) {
    const overflow = values.length - headers.length;
    const mergedFirst = values.slice(0, overflow + 1).join(delimiter);
    return [mergedFirst, ...values.slice(overflow + 1)];
  }

  // Pad missing trailing columns with empty strings
  return [...values, ...Array(headers.length - values.length).fill("")];
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

// Parse date string to ISO format - handles various LinkedIn date formats
function parseDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.trim() === "") return "";
  
  const trimmed = dateStr.trim();
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed;
  }
  
  // Try parsing common formats like "Jan 5, 2025", "January 5, 2025", "5 Jan 2025"
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  // Try DD/MM/YYYY or MM/DD/YYYY formats
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    // Assume MM/DD/YYYY for US format
    const month = parseInt(first, 10);
    const day = parseInt(second, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(parseInt(year, 10), month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  
  // Return original if all parsing fails
  return trimmed;
}

// Numeric field names for LinkedIn posts CSV
const numericFields = new Set([
  "Reactions", "LikeReactions", "PraiseReactions", "AppreciationReactions",
  "EmpathyReactions", "InterestReactions", "EntertainmentReactions",
  "Comments", "Shares", "Impressions", "Unique Impressions", "Engagement",
  "Vid. Views", "Viewers"
]);

function looksLikeUrl(s: string): boolean {
  const t = (s || "").trim();
  return /^https?:\/\//i.test(t) || t.startsWith("www.");
}

function looksLikeDate(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  // Common Metricool LinkedIn exports: "2026-01-13 10:37" or ISO-like
  if (/^\d{4}-\d{2}-\d{2}(\s+\d{1,2}:\d{2})?/.test(t)) return true;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return true;
  // e.g. "Jan 5, 2026"
  if (/^[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}$/.test(t)) return true;
  // e.g. "5 Jan 2026"
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(t)) return true;
  return false;
}

// LinkedIn CSV rows sometimes come back with Title containing commas *without quoting*.
// We recover by locating the Date+URL tokens and treating everything before Date as Title.
function alignLinkedInTitleDateUrl(tokens: string[], headers: string[]): string[] {
  if (headers[0] !== "Title" || headers[1] !== "Date" || headers[2] !== "URL") {
    return tokens;
  }

  // Prefer: [ ...titleParts, date, url, ...metrics ]
  let dateIdx = -1;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (looksLikeDate(tokens[i]) && looksLikeUrl(tokens[i + 1])) {
      dateIdx = i;
      break;
    }
  }

  // Fallback: find URL then check previous token for date
  if (dateIdx === -1) {
    for (let i = 1; i < tokens.length; i++) {
      if (looksLikeUrl(tokens[i]) && looksLikeDate(tokens[i - 1])) {
        dateIdx = i - 1;
        break;
      }
    }
  }

  if (dateIdx === -1) return tokens;

  const urlIdx = dateIdx + 1;
  const title = tokens.slice(0, dateIdx).join(",");
  const date = tokens[dateIdx] ?? "";
  const url = tokens[urlIdx] ?? "";

  const restExpected = headers.length - 3;
  const restTokens = tokens.slice(urlIdx + 1);

  let rest: string[];
  if (restTokens.length >= restExpected) {
    // Keep the right-most columns aligned (metrics tend to be at the end)
    rest = restTokens.slice(restTokens.length - restExpected);
  } else {
    rest = [...restTokens, ...Array(restExpected - restTokens.length).fill("")];
  }

  return [title, date, url, ...rest];
}

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
    // Log first 1000 chars of raw CSV for debugging
    console.log("Raw CSV sample:", responseText.substring(0, 1000));

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
    // Metricool's LinkedIn export can have unquoted multi-line Titles, so we need to
    // recombine "broken" lines that don't have enough columns. We'll detect the expected
    // column count from the header and stitch lines until we hit that count or a clear
    // delimiter pattern at the end (like ",VIDEO" or ",IMAGE").
    const normalizedText = responseText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rawLines = normalizedText.split("\n");

    if (rawLines.length === 0 || !rawLines[0].trim()) {
      return new Response(
        JSON.stringify({ success: true, rows: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const delimiter = detectDelimiter(rawLines[0]);

    // First line is headers
    const headers = parseCSVLine(rawLines[0], delimiter);
    const expectedCols = headers.length;
    console.log("CSV delimiter:", JSON.stringify(delimiter), "headers:", headers, "expectedCols:", expectedCols);

    // Stitch lines that are split mid-cell (multi-line unquoted Title)
    const dataLines: string[] = [];
    let buffer = "";
    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line.trim()) continue;

      if (!buffer) {
        buffer = line;
      } else {
        // Append to buffer with a space (or could use original newline, but space is safer for Title text)
        buffer += " " + line;
      }

      // Check if we have enough columns now
      const testTokens = parseCSVLine(buffer, delimiter);
      if (testTokens.length >= expectedCols) {
        dataLines.push(buffer);
        buffer = "";
      }
    }
    // If there's leftover, push it anyway
    if (buffer.trim()) {
      dataLines.push(buffer);
    }

    console.log("Stitched data lines count:", dataLines.length);

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
    for (let i = 0; i < dataLines.length; i++) {
      const rawValues = parseCSVLine(dataLines[i], delimiter);
      // First try LinkedIn-specific recovery for Title/Date/URL misalignment
      const linkedInAligned = alignLinkedInTitleDateUrl(rawValues, headers);
      // Then pad/truncate to match header count
      const values = alignValuesToHeaders(headers, linkedInAligned, delimiter);
      const row: Record<string, string | number> = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j] || "";
        const fieldName = columnMap[header] || header.toLowerCase().replace(/\s+/g, "_");
        const isNumeric = numericFields.has(header);

        // Special handling for date field - parse to ISO
        if (header === "Date" || fieldName === "date") {
          row[fieldName] = parseDateToISO(value);
        } else {
          row[fieldName] = parseValue(value, isNumeric);
        }
      }
      
      // Compute engagement rate if not provided
      if ((row.engagement === undefined || row.engagement === 0) && row.impressions && typeof row.impressions === 'number' && row.impressions > 0) {
        const interactions = (
          (typeof row.reactions_total === 'number' ? row.reactions_total : 0) +
          (typeof row.comments === 'number' ? row.comments : 0) +
          (typeof row.shares === 'number' ? row.shares : 0)
        );
        row.engagement = (interactions / row.impressions) * 100;
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
