/**
 * Reads the UBERSUGGEST_COOKIE secret (manually copied from your browser) and
 * saves it to Supabase so the sync-ubersuggest edge function can use it.
 *
 * HOW TO GET YOUR COOKIE (do this once, repeat when it expires):
 * 1. Open https://app.neilpatel.com in Chrome and log in
 * 2. Open DevTools (F12) → Console tab
 * 3. Type: copy(document.cookie) and press Enter
 * 4. Go to GitHub → your repo → Settings → Secrets → Actions
 * 5. Update/create secret: UBERSUGGEST_COOKIE → paste the copied value
 */

async function run() {
  const cookieString = process.env.UBERSUGGEST_COOKIE;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cookieString || !supabaseUrl || !supabaseKey) {
    console.error("Missing required environment variables: UBERSUGGEST_COOKIE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("Verifying session cookie against /api/projects...");
  const res = await fetch("https://app.neilpatel.com/api/projects", {
    headers: { Cookie: cookieString, Accept: "application/json" },
  });

  if (!res.ok) {
    console.error(`❌ Cookie is invalid or expired (HTTP ${res.status}). Update UBERSUGGEST_COOKIE secret.`);
    process.exit(1);
  }

  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects || data.data || [];
  console.log(`✓ Cookie valid — ${projects.length} project(s): ${projects.map((p) => p.domain || p.url || p.name).join(", ")}`);

  if (projects.length === 0) {
    console.warn("⚠ Cookie works but no projects returned — account may have no tracked domains.");
  }

  // Save cookie to Supabase for the edge function to use
  console.log("Saving to Supabase...");
  await upsert(supabaseUrl, supabaseKey, "ubersuggest", cookieString);

  console.log("✅ Ubersuggest session saved to Supabase successfully.");
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
