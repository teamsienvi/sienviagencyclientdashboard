import { chromium } from "playwright";

/**
 * Logs into Ubersuggest and intercepts the authenticated /api/projects and
 * /api/user/alerts responses. Stores them in Supabase for the edge function to use.
 *
 * Key fixes:
 * - isLoggedIn flag: only capture responses AFTER login redirect (ignores pre-auth session checks)
 * - form.requestSubmit(): the only method that submits a React form without requiring the button to be enabled
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

  let capturedProjects = null;
  let capturedAlerts = null;
  let isLoggedIn = false; // Guard: only intercept responses AFTER successful login

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Only capture responses AFTER we're confirmed logged in
  page.on("response", async (response) => {
    if (!isLoggedIn) return; // Skip ALL pre-login API calls
    const url = response.url();
    const status = response.status();
    try {
      if (url.includes("neilpatel.com/api/projects") && status === 200 && !capturedProjects) {
        const data = await response.json();
        const arr = Array.isArray(data) ? data : data.projects || data.data || data.result || [];
        if (arr.length > 0) {
          capturedProjects = data;
          console.log(`✓ Intercepted /api/projects — ${arr.length} project(s): ${arr.map((p) => p.domain || p.url).join(", ")}`);
        }
      }
      if (url.includes("neilpatel.com/api/user/alerts") && status === 200 && !capturedAlerts) {
        capturedAlerts = await response.json();
        console.log(`✓ Intercepted /api/user/alerts`);
      }
    } catch (_e) {}
  });

  try {
    console.log("Navigating to login page...");
    await page.goto("https://app.neilpatel.com/en/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.waitForTimeout(1000); // Let React initialize

    // Set input values using React's native setter (triggers controlled input onChange)
    console.log("Setting form values...");
    await page.evaluate(
      ({ emailVal, passwordVal }) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const emailEl = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
        const passEl = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
        if (emailEl) {
          setter.call(emailEl, emailVal);
          emailEl.dispatchEvent(new Event("input", { bubbles: true }));
          emailEl.dispatchEvent(new Event("change", { bubbles: true }));
          emailEl.dispatchEvent(new Event("blur", { bubbles: true }));
        }
        if (passEl) {
          setter.call(passEl, passwordVal);
          passEl.dispatchEvent(new Event("input", { bubbles: true }));
          passEl.dispatchEvent(new Event("change", { bubbles: true }));
          passEl.dispatchEvent(new Event("blur", { bubbles: true }));
        }
      },
      { emailVal: email, passwordVal: password }
    );

    await page.waitForTimeout(2000); // Let React process state change

    // Submit the form — use requestSubmit() which triggers browser validation + submit event
    // This works even when the submit button has a disabled attribute
    console.log("Submitting form via requestSubmit()...");
    const submitted = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) {
        form.requestSubmit();
        return true;
      }
      return false;
    });

    if (!submitted) {
      // Last resort: force click the submit button
      console.log("No form found — force clicking submit button...");
      await page.click('button[type="submit"]', { force: true });
    }

    // Wait for redirect away from login (up to 25 seconds)
    console.log("Waiting for post-login redirect...");
    try {
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 25000 });
      console.log("✓ Login successful! URL:", page.url());
      isLoggedIn = true; // NOW start capturing API responses
    } catch (_e) {
      console.log("Redirect timeout — checking current URL:", page.url());
      // If we're no longer on /login, consider it success
      if (!page.url().includes("/login")) {
        console.log("✓ Actually redirected successfully.");
        isLoggedIn = true;
      } else {
        throw new Error("Login failed — still on login page. Check credentials or Cloudflare is blocking.");
      }
    }

    // Navigate to dashboard to trigger authenticated API calls
    if (!capturedProjects) {
      console.log("Navigating to dashboard to trigger /api/projects...");
      await page.goto("https://app.neilpatel.com/en/ubersuggest", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(6000);
    }

    // Navigate to alerts page if not yet captured
    if (!capturedAlerts) {
      console.log("Navigating to trigger /api/user/alerts...");
      await page.goto("https://app.neilpatel.com/en/user_alerts", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      }).catch(() => {});
      await page.waitForTimeout(5000);
    }

    // Final fallback: in-browser fetch (uses authenticated session cookies)
    if (!capturedProjects) {
      console.log("Attempting in-browser authenticated fetch of /api/projects...");
      const result = await page.evaluate(async () => {
        try {
          const res = await fetch("https://app.neilpatel.com/api/projects", { credentials: "include" });
          return { ok: res.ok, status: res.status, data: await res.json() };
        } catch (e) { return { error: String(e) }; }
      });
      console.log("In-browser /api/projects result:", JSON.stringify(result).slice(0, 300));
      if (result.ok && result.data) capturedProjects = result.data;
    }

    if (!capturedAlerts) {
      console.log("Attempting in-browser authenticated fetch of /api/user/alerts...");
      const result = await page.evaluate(async () => {
        try {
          const res = await fetch("https://app.neilpatel.com/api/user/alerts", { credentials: "include" });
          return { ok: res.ok, status: res.status, data: await res.json() };
        } catch (e) { return { error: String(e) }; }
      });
      console.log("In-browser /api/user/alerts result:", JSON.stringify(result).slice(0, 300));
      if (result.ok && result.data) capturedAlerts = result.data;
    }

  } finally {
    await browser.close();
  }

  if (!capturedProjects) {
    console.error("❌ Failed to capture projects data — login failed or account has no projects.");
    process.exit(1);
  }

  const projectCount = Array.isArray(capturedProjects) ? capturedProjects.length
    : capturedProjects.projects?.length || 0;
  console.log(`Saving ${projectCount} project(s) to Supabase cache...`);

  await upsertCredential(supabaseUrl, supabaseKey, "ubersuggest_projects", JSON.stringify(capturedProjects));
  if (capturedAlerts) {
    await upsertCredential(supabaseUrl, supabaseKey, "ubersuggest_alerts", JSON.stringify(capturedAlerts));
  }

  console.log("✅ Ubersuggest data cached in Supabase successfully.");
}

async function upsertCredential(supabaseUrl, supabaseKey, serviceName, data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseKey}`,
    apikey: supabaseKey,
    Prefer: "resolution=merge-duplicates,return=minimal",
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, {
    method: "POST",
    headers,
    body: JSON.stringify({ service_name: serviceName, token: data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.${serviceName}`,
      { method: "PATCH", headers, body: JSON.stringify({ token: data, updated_at: new Date().toISOString() }) }
    );
    if (!patchRes.ok) throw new Error(`Failed to save ${serviceName}: ${await patchRes.text()}`);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
