import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const k = line.substring(0, eqIdx).trim();
    const v = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const METRICOOL_AUTH = env['METRICOOL_AUTH'];

async function run() {
  console.log('Testing aggregation metric=all...');
  
  // Use PlayIQ Facebook config (which is usually well authenticated)
  const config = { user_id: '4380439', blog_id: '6018151' }; // PlayIQ FB

  const params = new URLSearchParams({
    userId: config.user_id,
    blogId: config.blog_id,
    network: 'facebookpages', // Use facebookpages
    from: '2026-04-29T00:00:00',
    to: '2026-05-06T23:59:59',
    timezone: 'America/Chicago',
    metric: 'all',
    subject: 'account'
  });

  const mRes = await fetch(`https://app.metricool.com/api/v2/analytics/aggregation?${params}`, {
    headers: { 'x-mc-auth': METRICOOL_AUTH, 'accept': 'application/json' }
  });
  
  console.log('Status:', mRes.status);
  console.log('Response:', await mRes.text());
}

run().catch(console.error);
