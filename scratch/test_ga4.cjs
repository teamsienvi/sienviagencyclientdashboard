const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) acc[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

async function run() {
  try {
    const fffId = "79099b9d-0281-4a95-8076-dcff0fd128a4";
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startStr = lastWeek.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    const fnRes = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/fetch-ga4-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ clientId: fffId, startDate: startStr, endDate: endStr })
    });
    const text = await fnRes.text();
    console.log("Response status:", fnRes.status);
    console.log("Response body:", text);
  } catch(e) { console.error(e); }
}
run();
