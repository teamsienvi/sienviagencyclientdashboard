import { chromium } from "playwright";

/**
 * Logs into Ubersuggest via Playwright using the React native input value setter
 * to properly trigger React's controlled form state (so the submit button enables).
 * Captures session cookies after successful login and saves them to Supabase.
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

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Use React's native input value setter to properly trigger controlled input state.
    // page.type() / page.fill() do NOT trigger React's onChange for controlled inputs.
    // This is the only reliable method to enable a React-controlled submit button.
    console.log("Setting form values via React native input setter...");
    await page.evaluate(
      ({ emailVal, passwordVal }) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;

        const emailInput = document.querySelector('input[type="email"]') ||
                           document.querySelector('input[name="email"]');
        const passwordInput = document.querySelector('input[type="password"]') ||
                              document.querySelector('input[name="password"]');

        if (emailInput) {
          nativeInputValueSetter.call(emailInput, emailVal);
          emailInput.dispatchEvent(new Event("input", { bubbles: true }));
          emailInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (passwordInput) {
          nativeInputValueSetter.call(passwordInput, passwordVal);
          passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
          passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      { emailVal: email, passwordVal: password }
    );

    // Give React time to process the state change and enable the button
    await page.waitForTimeout(2000);

    // Wait for submit button to become enabled
    try {
      await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 8000 });
      console.log("Submit button is now enabled.");
      await page.click('button[type="submit"]');
    } catch (_e) {
      console.log("Button still disabled — attempting force click...");
      await page.click('button[type="submit"]', { force: true });
    }

    // Wait for post-login redirect (up to 20 seconds)
    console.log("Waiting for post-login redirect...");
    try {
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 20000 });
      console.log("✓ Login successful. Current URL:", page.url());
    } catch (_e) {
      console.log("Redirect timeout. Current URL:", page.url());
      // Still try to proceed — session cookies might be set
    }

    // Extra settle time for session cookies to be written
    await page.waitForTimeout(4000);

    // Capture ALL cookies (all domains) — auth cookie may be on .neilpatel.com parent domain
    const allCookies = await context.cookies();
    console.log(`Total cookies captured: ${allCookies.length}`);
    console.log(`Cookie names: ${allCookies.map((c) => c.name).join(", ")}`);

    // Filter to neilpatel.com cookies only (session cookies will be here)
    const neilCookies = allCookies.filter((c) => c.domain.includes("neilpatel.com"));
    console.log(`neilpatel.com cookies (${neilCookies.length}): ${neilCookies.map((c) => c.name).join(", ")}`);

    if (neilCookies.length === 0) {
      throw new Error("No neilpatel.com cookies captured — login likely failed. Check credentials.");
    }

    const cookieString = neilCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Verify cookies work against /api/projects
    console.log("Verifying session against /api/projects...");
    const verifyRes = await fetch("https://app.neilpatel.com/api/projects", {
      headers: { Cookie: cookieString, Accept: "application/json" },
    });
    const verifyData = await verifyRes.json();
    const projectsArray = Array.isArray(verifyData)
      ? verifyData
      : verifyData.projects || verifyData.data || verifyData.result || [];

    console.log(`✓ /api/projects returned ${projectsArray.length} project(s): ${projectsArray.map((p) => p.domain || p.url || p.name).join(", ")}`);

    if (projectsArray.length === 0) {
      console.warn("⚠ Projects list empty — login may not have completed or account has no projects.");
    }

    // Save cookie string to Supabase integration_credentials table
    console.log("Saving session cookies to Supabase...");
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.ubersuggest`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ token: cookieString, updated_at: new Date().toISOString() }),
      }
    );

    if (!patchRes.ok) {
      // Insert if row doesn't exist
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

    console.log("✅ Ubersuggest session cookies saved successfully.");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
