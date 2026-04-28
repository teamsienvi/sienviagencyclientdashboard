import fs from "fs";

const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";
const FILE_PATH = "C:\\Users\\Iris\\Downloads\\BulkSheetExport.xlsx";
// Snarky Pets client ID
const CLIENT_ID = "d8a121fe-cdd9-4e19-90dc-dd32b159f973";

async function main() {
  const fileBuffer = fs.readFileSync(FILE_PATH);
  console.log(`File: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

  const blob = new globalThis.Blob([fileBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const form = new globalThis.FormData();
  form.append("clientId", CLIENT_ID);
  form.append("file", blob, "BulkSheetExport.xlsx");

  console.log("Calling analyze-amazon-ads with Snarky Pets... (30-90s)");
  const start = Date.now();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-amazon-ads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: form,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`HTTP ${res.status} — ${elapsed}s`);

  const text = await res.text();
  // Print raw response first
  console.log("\n=== RAW RESPONSE (first 2000 chars) ===");
  console.log(text.slice(0, 2000));

  let data;
  try { data = JSON.parse(text); } catch { return; }

  if (data.error) { console.error("\n❌ Error:", data.error); return; }

  console.log("\n=== PARSED RESULT ===");
  console.log("kpis:", JSON.stringify(data.kpis));
  console.log("executiveSummary length:", data.executiveSummary?.length);
  console.log("topRevenueCampaigns length:", data.topRevenueCampaigns?.length);
  console.log("wastefulSearchTerms length:", data.wastefulSearchTerms?.length);
  console.log("actionPlan length:", data.actionPlan?.length);
  console.log("finalRecommendation:", data.finalRecommendation?.slice(0,100));
}

main().catch(console.error);
