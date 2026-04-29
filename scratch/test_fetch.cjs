const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) acc[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

async function run() {
  try {
    const fffId = "041555a7-1a25-42b8-89c7-edc40afff861"; // Serenity Scrolls
    console.log("Client ID (Serenity Scrolls):", fffId);

    const fnResGen = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/generate-analytics-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ clientId: fffId, type: 'website', dateRange: '7d' })
    });
    console.log("Generate Response:", await fnResGen.text());

    const fnRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_ga4_config?client_id=eq.${fffId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'apikey': env.VITE_SUPABASE_PUBLISHABLE_KEY }
    });
    console.log("GA4 config:", await fnRes.json());
  } catch(e) { console.error(e); }
}
run();
