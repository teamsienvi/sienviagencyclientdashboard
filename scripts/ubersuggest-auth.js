const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function main() {
  const email = process.env.UBERSUGGEST_EMAIL;
  const password = process.env.UBERSUGGEST_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables.');
    process.exit(1);
  }

  // Dynamic import for node-fetch since we need to hit the Supabase REST API
  const fetch = (await import('node-fetch')).default;

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let authToken = null;

  // Listen to network requests to intercept the Bearer token
  page.on('request', request => {
    const headers = request.headers();
    if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
      // Typically Ubersuggest calls their own API under *.neilpatel.com
      if (request.url().includes('neilpatel.com/api')) {
         authToken = headers['authorization'];
      }
    }
  });

  try {
    console.log('Navigating to Ubersuggest Login...');
    await page.goto('https://app.neilpatel.com/en/login', { waitUntil: 'networkidle' });

    // Perform the manual login steps
    console.log('Filling out credentials...');
    // Note: User will need to adjust the selectors based on the current Ubersuggest page structure
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);
    await page.click('button[type="submit"]');

    console.log('Waiting for authentication and network idle...');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // We navigate to a dashboard page to ensure an API call fires
    await page.goto('https://app.neilpatel.com/en/dashboard', { waitUntil: 'networkidle' });

    if (authToken) {
      console.log('Successfully intercepted Authorization token!');
      
      // Save it to Supabase
      console.log('Writing token to Supabase...');
      const response = await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          service_name: 'ubersuggest',
          token: authToken,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Supabase request failed: ${response.statusText}`);
      }
      console.log('Token successfully stored in Supabase!');
    } else {
      console.error('Failed to capture token. The login might have changed or Cloudflare blocked the request.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during automation:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
