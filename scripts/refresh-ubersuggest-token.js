import { chromium } from "playwright";

async function run() {
  const email = process.env.UBERSUGGEST_EMAIL;
  const password = process.env.UBERSUGGEST_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !supabaseUrl || !supabaseKey) {
    console.error("Missing required environment variables.");
    process.exit(1);
  }

  let capturedToken = null;
  // Only capture tokens AFTER login is submitted — pre-auth requests use anonymous tokens
  let captureEnabled = false;

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Only capture tokens from authenticated API calls (post-login)
  page.on("request", (request) => {
    if (!captureEnabled) return;
    const url = request.url();
    if (url.includes("neilpatel.com/api") || url.includes("neilpatel.com/auth")) {
      const auth = request.headers()["authorization"];
      if (auth && auth.length > 20 && !capturedToken) {
        capturedToken = auth;
        console.log("✓ Token captured from authenticated API request.");
      }
    }
  });

  try {
    console.log("Navigating to Ubersuggest login page...");
    await page.goto("https://app.neilpatel.com/en/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Use page.type() (simulates real keystrokes) instead of page.fill()
    // This properly triggers React onChange events and enables the submit button
    console.log("Filling login form...");
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.click('input[type="email"], input[name="email"]');
    await page.type('input[type="email"], input[name="email"]', email, { delay: 60 });

    await page.click('input[type="password"], input[name="password"]');
    await page.type('input[type="password"], input[name="password"]', password, { delay: 60 });

    // Wait for submit button to become enabled after React form validation
    console.log("Waiting for submit button to enable...");
    try {
      await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 8000 });
      console.log("Submit button enabled.");
    } catch (_e) {
      console.log("Button still disabled — trying to trigger input events manually...");
      await page.evaluate(() => {
        ["email", "password"].forEach((type) => {
          const el = document.querySelector(`input[type="${type}"]`);
          if (el) {
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });
      await page.waitForTimeout(1500);
    }

    // Enable token capture BEFORE submitting
    captureEnabled = true;
    console.log("Submitting login form via keyboard Enter (bypasses disabled button)...");

    // Press Enter in the password field — this submits the form regardless of button state
    // Keyboard submission does NOT check if the submit button is disabled
    await page.focus('input[type="password"], input[name="password"]');
    await page.keyboard.press("Enter");

    // Wait for post-login API calls to fire
    await page.waitForTimeout(8000);


    // Navigate to dashboard if token still not captured
    if (!capturedToken) {
      console.log("Navigating to dashboard to trigger API calls...");
      try {
        await page.goto("https://app.neilpatel.com/en/ubersuggest", {
          waitUntil: "load",
          timeout: 20000,
        });
        await page.waitForTimeout(4000);
      } catch (_e) {
        console.log("Dashboard navigation timed out, continuing...");
      }
    }

    // Last resort: check localStorage for JWT tokens
    if (!capturedToken) {
      console.log("Attempting to extract token from localStorage...");
      const stored = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          if (value && (value.startsWith("Bearer ") || value.startsWith("ey")) && value.length > 50) {
            return value;
          }
        }
        return null;
      });
      if (stored) {
        capturedToken = stored.startsWith("Bearer ") ? stored : `Bearer ${stored}`;
        console.log("✓ Token extracted from localStorage.");
      }
    }

  } finally {
    await browser.close();
  }


  if (!capturedToken) {
    console.error("❌ Failed to capture Ubersuggest token. Check login credentials or page structure.");
    process.exit(1);
  }

  console.log("Saving token to Supabase...");

  // Upsert to integration_credentials using REST API
  const res = await fetch(`${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.ubersuggest`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      token: capturedToken,
      updated_at: new Date().toISOString(),
    }),
  });

  // If no row existed yet, insert instead
  if (res.status === 404 || res.status === 200 && (await checkRowExists(supabaseUrl, supabaseKey)) === false) {
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
        token: capturedToken,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!insertRes.ok) {
      throw new Error(`Insert failed: ${await insertRes.text()}`);
    }
  } else if (!res.ok) {
    throw new Error(`PATCH failed (${res.status}): ${await res.text()}`);
  }

  console.log("✅ Ubersuggest token refreshed and saved successfully.");
}

async function checkRowExists(supabaseUrl, supabaseKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/integration_credentials?service_name=eq.ubersuggest&select=service_name`,
    {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
    }
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
