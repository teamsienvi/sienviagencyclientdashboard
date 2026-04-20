import { chromium } from "playwright";

/**
 * Logs into Ubersuggest via Playwright, then captures the browser SESSION COOKIES
 * (not the Authorization header — Ubersuggest uses cookie-based auth for its API).
 * Stores the cookie string in Supabase `integration_credentials` so the edge function
 * can use it as a Cookie header in server-side API calls.
 */
async function run() {
  const email = process.env.UBERSUGGEST_EMAIL;
  const password = process.env.UBERSUGGEST_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !supabaseUrl || !supabaseKey) {
    console.error("Missing required environment variables.");
    process.exit(1);
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    console.log("Navigating to Ubersuggest login page...");
    await page.goto("https://app.neilpatel.com/en/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("Filling login form...");
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.click('input[type="email"], input[name="email"]');
    await page.type('input[type="email"], input[name="email"]', email, { delay: 60 });

    await page.click('input[type="password"], input[name="password"]');
    await page.type('input[type="password"], input[name="password"]', password, { delay: 60 });

    // Wait for submit button to become enabled
    try {
      await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 8000 });
      console.log("Submit button enabled.");
    } catch (_e) {
      console.log("Button still disabled — using keyboard Enter to submit...");
    }

    // Submit via keyboard Enter (bypasses disabled button state)
    await page.focus('input[type="password"], input[name="password"]');
    await page.keyboard.press("Enter");

    console.log("Waiting for post-login redirect...");
    // Wait for URL to change away from /login, indicating successful auth
    try {
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 15000 });
      console.log("✓ Login successful — redirected to:", page.url());
    } catch (_e) {
      console.log("URL still on login page — login may have failed. Continuing anyway...");
    }

    // Extra wait for API calls and cookies to settle
    await page.waitForTimeout(3000);

    // Capture ALL cookies for neilpatel.com after login
    const cookies = await context.cookies("https://app.neilpatel.com");
    console.log(`Captured ${cookies.length} cookies after login.`);

    if (cookies.length === 0) {
      throw new Error("No cookies captured after login — login likely failed.");
    }

    // Format as Cookie header string: "name=value; name2=value2"
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    console.log(`Cookie names: ${cookies.map((c) => c.name).join(", ")}`);

    // Verify the cookies work by calling the projects API
    console.log("Verifying cookies against /api/projects...");
    const verifyRes = await fetch("https://app.neilpatel.com/api/projects", {
      headers: { Cookie: cookieString, Accept: "application/json" },
    });
    const verifyData = await verifyRes.json();
    const projectsArray = Array.isArray(verifyData)
      ? verifyData
      : verifyData.projects || verifyData.data || verifyData.result || [];
    console.log(`✓ Projects API returned ${projectsArray.length} projects: ${projectsArray.map((p) => p.domain || p.url || p.name).join(", ")}`);

    if (projectsArray.length === 0) {
      console.warn("⚠ Projects list is empty — token may be for a different account or login failed.");
    }

    // Save cookie string to Supabase (stored in the `token` column)
    console.log("Saving cookie session to Supabase...");
    const res = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.ubersuggest`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          token: cookieString,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!res.ok) {
      // Row doesn't exist yet — insert it
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          service_name: "ubersuggest",
          token: cookieString,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!insertRes.ok) {
        throw new Error(`Insert failed: ${await insertRes.text()}`);
      }
    }

    console.log("✅ Ubersuggest session cookies refreshed and saved successfully.");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
