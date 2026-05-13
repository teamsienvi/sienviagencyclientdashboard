const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim().replace(/\r/g, '');
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  console.log('Fetching metrics for recent content...');
  const resMetrics = await fetch(`${SUPABASE_URL}/rest/v1/social_content_metrics?social_content_id=eq.282fd930-a63e-4504-ac33-ad370975bfe4`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const metrics = await resMetrics.json();
  console.log('Metrics:', metrics);
}

run().catch(console.error);
