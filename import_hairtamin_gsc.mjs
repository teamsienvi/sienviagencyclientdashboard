// Import HAIRtamin GSC export data into Supabase report_gsc_metrics table
// Usage: node import_hairtamin_gsc.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "path";

const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1MzcwNywiZXhwIjoyMDg3NTI5NzA3fQ.hB-L59qE7061eR_FXnZ_Uh8I5pUqD8zq9IRV9en4uRA";
const HAIRTAMIN_CLIENT_ID = "6c14388a-b7da-48fe-a8e4-57172f1f862a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CSV parser (handles quoted fields with commas/newlines) ──
function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.length > 1 || current[0] !== "") rows.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length) {
    current.push(field.trim());
    if (current.length > 1 || current[0] !== "") rows.push(current);
  }
  return rows;
}

function parsePct(s) {
  return parseFloat(s.replace("%", "")) || 0;
}

// ── Read all CSV files ──
const BASE = "C:/Users/Iris/Downloads/hairtamin_gsc_export";

const chartRaw = parseCSV(readFileSync(`${BASE}/Chart.csv`, "utf-8"));
const queriesRaw = parseCSV(readFileSync(`${BASE}/Queries.csv`, "utf-8"));
const pagesRaw = parseCSV(readFileSync(`${BASE}/Pages.csv`, "utf-8"));
const devicesRaw = parseCSV(readFileSync(`${BASE}/Devices.csv`, "utf-8"));
const countriesRaw = parseCSV(readFileSync(`${BASE}/Countries.csv`, "utf-8"));
const searchAppRaw = parseCSV(readFileSync(`${BASE}/Search appearance.csv`, "utf-8"));

// ── Parse daily breakdown ──
const dailyBreakdown = chartRaw.slice(1).map(r => ({
  date: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Compute totals ──
const totalClicks = dailyBreakdown.reduce((s, d) => s + d.clicks, 0);
const totalImpressions = dailyBreakdown.reduce((s, d) => s + d.impressions, 0);
const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
const avgPosition = dailyBreakdown.length > 0
  ? dailyBreakdown.reduce((s, d) => s + d.position, 0) / dailyBreakdown.length
  : 0;

// ── Parse top queries ──
const topQueries = queriesRaw.slice(1).map(r => ({
  query: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Parse top pages ──
const topPages = pagesRaw.slice(1).map(r => ({
  page: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Parse devices ──
const deviceBreakdown = devicesRaw.slice(1).map(r => ({
  device: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Parse countries ──
const countryBreakdown = countriesRaw.slice(1).map(r => ({
  country: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Parse search appearance ──
const searchAppearance = searchAppRaw.slice(1).map(r => ({
  type: r[0],
  clicks: parseInt(r[1]) || 0,
  impressions: parseInt(r[2]) || 0,
  ctr: parsePct(r[3]),
  position: parseFloat(r[4]) || 0,
}));

// ── Date range ──
const dates = dailyBreakdown.map(d => d.date).sort();
const dateRangeStart = dates[0];
const dateRangeEnd = dates[dates.length - 1];

console.log(`\n=== HAIRtamin GSC Import Summary ===`);
console.log(`Date range: ${dateRangeStart} to ${dateRangeEnd} (${dates.length} days)`);
console.log(`Total clicks: ${totalClicks.toLocaleString()}`);
console.log(`Total impressions: ${totalImpressions.toLocaleString()}`);
console.log(`Avg CTR: ${avgCtr.toFixed(2)}%`);
console.log(`Avg Position: ${avgPosition.toFixed(1)}`);
console.log(`Queries: ${topQueries.length}`);
console.log(`Pages: ${topPages.length}`);
console.log(`Countries: ${countryBreakdown.length}`);

// ── Insert the data ──
console.log("\nInserting GSC data into report_gsc_metrics...");
const row = {
  client_id: HAIRTAMIN_CLIENT_ID,
  date_range_start: dateRangeStart,
  date_range_end: dateRangeEnd,
  total_clicks: totalClicks,
  total_impressions: totalImpressions,
  avg_ctr: parseFloat(avgCtr.toFixed(4)),
  avg_position: parseFloat(avgPosition.toFixed(2)),
  top_queries: topQueries,
  top_pages: topPages,
  device_breakdown: deviceBreakdown,
  country_breakdown: countryBreakdown,
  daily_breakdown: dailyBreakdown,
  search_appearance: searchAppearance,
  source: "csv_import",
  collected_at: new Date().toISOString(),
};

const { data, error } = await supabase
  .from("report_gsc_metrics")
  .upsert(row, { onConflict: "client_id,date_range_start,date_range_end" })
  .select();

if (error) {
  console.error("❌ Insert error:", error.message);
  console.error("   Details:", JSON.stringify(error));
} else {
  console.log("✅ GSC data imported successfully!");
  console.log("   Record ID:", data?.[0]?.id);
}
