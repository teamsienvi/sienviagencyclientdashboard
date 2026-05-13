import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[match[1].trim()] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const authHeaders = {
    Authorization: 'Bearer app#tier2__1e3ed4c022059542579c38310288627317809cc5',
    Cookie: 'id=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTA0NTE1MzMxNzg4MTgxNjA0MDcxIiwiZXhwIjoxNzc5NTk2ODU4fQ.hzgNpG0I2iTxBhlUP_2tzEkTkxpTgVLKhTq5kp8Aoyo',
    Accept: "application/json",
    ts: String(Math.floor(Date.now() / 1000)),
  };

  // Fetch projects
  const projectsRes = await fetch("https://app.neilpatel.com/api/projects", { headers: authHeaders });
  const projectsRaw = await projectsRes.json();
  const projectsArray = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects || projectsRaw.data || projectsRaw.result || [];
  
  const fff = projectsArray.find((p: any) => p.domain === 'fatherfigureformula.com');
  if (!fff) { console.log('fatherfigureformula.com not found'); return; }

  console.log("FFF project from API:");
  console.log("  score:", fff.score);
  console.log("  keywords:", fff.keywords ? Object.keys(fff.keywords) : []);

  const alertsRes = await fetch("https://app.neilpatel.com/api/user/alerts", { headers: authHeaders });
  const allAlertsData: any[] = alertsRes.ok ? await alertsRes.json() : [];
  
  const fffAlerts = allAlertsData.filter((a: any) => a.projectId === fff.id || a.project_id === fff.id);
  console.log(`\nFFF alerts (${fffAlerts.length} total):`);
  for (const a of fffAlerts) {
    const type = a.alertType || a.alert_type;
    console.log(`  [${type}] score=${a.content?.score?.new ?? "—"} keywords=${a.content?.keywords?.length ?? "—"}`);
  }

  // Check DB
  const { data: dbRow } = await supabase
    .from("report_seo_metrics" as any)
    .select("site_audit_score, tracked_keywords, collected_at")
    .eq("client_id", "95791e88-87cd-4621-af7e-df46f5ad93ac")
    .order("collected_at", { ascending: false })
    .limit(1)
    .single();

  if (dbRow) {
    const kws = (dbRow as any).tracked_keywords || [];
    console.log(`\nFFF in DB (as of ${(dbRow as any).collected_at}):`);
    console.log("  site_audit_score:", (dbRow as any).site_audit_score);
    console.log("  keywords:", kws.map((k: any) => `${k.keyword}: ${k.desktop_new ?? "pending"}`));
  }

  // Check if the score shows in domain overview
  const locId = fff.locations?.[0]?.loc_id || 2840;
  const lang = fff.locations?.[0]?.lang || "en";
  const oRes = await fetch(`https://app.neilpatel.com/api/domain_overview?domain=fatherfigureformula.com&locId=${locId}&lang=${lang}`, { headers: authHeaders });
  if (oRes.ok) {
    const oData = await oRes.json();
    console.log("\nFFF domain overview:");
    console.log("  domainAuthority:", oData.domainAuthority);
    console.log("  traffic:", oData.traffic);
    console.log("  organic:", oData.organic);
    console.log("  backlinks:", oData.backlinks);
  }
  
  // Check full project endpoint
  const pRes = await fetch(`https://app.neilpatel.com/api/projects/${fff.id}`, { headers: authHeaders });
  if (pRes.ok) {
    const pData = await pRes.json();
    console.log("\nFFF full project score:", pData.project?.score ?? pData.score ?? "(not found)");
  }
}

run();
