/**
 * Sends BOTH the Authorization token AND the id session cookie to Ubersuggest's API.
 * The auth token identifies the app tier; the id cookie identifies the specific user.
 * Both are required to return user-specific project data.
 *
 * SECRETS REQUIRED (GitHub → repo → Settings → Secrets → Actions):
 *
 *   UBERSUGGEST_TOKEN  → the "authorization" header value from Network tab
 *                        e.g. "Bearer app#tier2__7a9763b8..."
 *
 *   UBERSUGGEST_SESSION → ONLY the value of the "id" cookie from the Cookie header
 *                         e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2..."
 *                         To find it: in the Cookie header, locate "id=XXXXX;" and copy XXXXX
 *
 * HOW TO REFRESH WHEN EXPIRED:
 *   1. Open https://app.neilpatel.com → F12 → Network → reload
 *   2. Click the /api/projects request → Request Headers
 *   3. Copy the new "id=..." value from the Cookie header
 *   4. Update UBERSUGGEST_SESSION secret in GitHub
 */

async function run() {
  const token = process.env.UBERSUGGEST_TOKEN;
  const session = process.env.UBERSUGGEST_SESSION;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !session || !supabaseUrl || !supabaseKey) {
    console.error("Missing required env vars. Need: UBERSUGGEST_TOKEN, UBERSUGGEST_SESSION, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Check session JWT expiry
  try {
    const payload = JSON.parse(Buffer.from(session.split(".")[1], "base64").toString());
    if (payload.exp) {
      const expiresIn = Math.round((payload.exp - Date.now() / 1000) / 3600);
      if (expiresIn < 0) {
        console.error(`❌ Session JWT already expired ${Math.abs(expiresIn)}h ago. Update UBERSUGGEST_SESSION in GitHub Secrets.`);
        process.exit(1);
      }
      console.log(`Session JWT valid for ~${expiresIn}h (user_id: ${payload.user_id})`);
    }
  } catch (_e) {
    console.log("Could not decode session JWT expiry — proceeding.");
  }

  console.log("Verifying credentials against /api/projects...");
  const res = await fetch("https://app.neilpatel.com/api/projects", {
    headers: {
      Authorization: token,
      Cookie: `id=${session}`,
      Accept: "application/json",
      ts: String(Math.floor(Date.now() / 1000)),
    },
  });

  if (!res.ok) {
    console.error(`❌ API call failed (HTTP ${res.status}). One or both secrets may be expired.`);
    process.exit(1);
  }

  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects || data.data || [];
  console.log(`✓ Auth valid — ${projects.length} project(s): ${projects.map((p) => p.domain || p.url || p.name).join(", ")}`);

  if (projects.length === 0) {
    console.warn("⚠ 0 projects returned — UBERSUGGEST_SESSION may be from the wrong account or page.");
    process.exit(1);
  }

  // Save both to Supabase in a combined format the edge function understands
  console.log("Saving to Supabase...");
  await upsert(supabaseUrl, supabaseKey, "ubersuggest_token", token);
  await upsert(supabaseUrl, supabaseKey, "ubersuggest_session", session);
  console.log("✅ Ubersuggest credentials saved to Supabase successfully.");
}

async function upsert(supabaseUrl, supabaseKey, serviceName, value) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseKey}`,
    apikey: supabaseKey,
    Prefer: "resolution=merge-duplicates,return=minimal",
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, {
    method: "POST",
    headers,
    body: JSON.stringify({ service_name: serviceName, token: value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const patch = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.${serviceName}`,
      { method: "PATCH", headers, body: JSON.stringify({ token: value, updated_at: new Date().toISOString() }) }
    );
    if (!patch.ok) throw new Error(`Failed to save ${serviceName}: ${await patch.text()}`);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
