/**
 * Reads the UBERSUGGEST_TOKEN secret (the Authorization Bearer token from your browser's
 * network request to /api/projects) and saves it to Supabase for the edge function.
 *
 * HOW TO GET YOUR TOKEN (do this when it expires):
 * 1. Open https://app.neilpatel.com in Chrome and log in
 * 2. Open DevTools (F12) → Network tab → reload page
 * 3. In the filter box type: api/projects
 * 4. Click the request → go to "Request Headers"
 * 5. Find the "authorization" header, copy the value (starts with "Bearer app#")
 * 6. Go to GitHub → repo → Settings → Secrets → Actions
 * 7. Set UBERSUGGEST_TOKEN = the copied authorization value
 */

async function run() {
  const token = process.env.UBERSUGGEST_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !supabaseUrl || !supabaseKey) {
    console.error("Missing required env vars: UBERSUGGEST_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("Verifying token against /api/projects...");
  const res = await fetch("https://app.neilpatel.com/api/projects", {
    headers: {
      Authorization: token,
      Accept: "application/json",
      ts: String(Math.floor(Date.now() / 1000)),
    },
  });

  if (!res.ok) {
    console.error(`❌ Token invalid or expired (HTTP ${res.status}). Update UBERSUGGEST_TOKEN secret.`);
    process.exit(1);
  }

  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects || data.data || [];
  console.log(`✓ Token valid — ${projects.length} project(s): ${projects.map((p) => p.domain || p.url || p.name).join(", ")}`);

  if (projects.length === 0) {
    console.warn("⚠ Token works but no projects returned — account may have no tracked domains.");
  }

  // Save token to Supabase for the edge function
  console.log("Saving to Supabase...");
  await upsert(supabaseUrl, supabaseKey, "ubersuggest", token);
  console.log("✅ Ubersuggest token saved to Supabase successfully.");
}

async function upsert(supabaseUrl, supabaseKey, serviceName, token) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseKey}`,
    apikey: supabaseKey,
    Prefer: "resolution=merge-duplicates,return=minimal",
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, {
    method: "POST",
    headers,
    body: JSON.stringify({ service_name: serviceName, token, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const patch = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.${serviceName}`,
      { method: "PATCH", headers, body: JSON.stringify({ token, updated_at: new Date().toISOString() }) }
    );
    if (!patch.ok) throw new Error(`Supabase save failed: ${await patch.text()}`);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
