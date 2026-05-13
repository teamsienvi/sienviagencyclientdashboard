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

const URL_BASE = env['NEXT_PUBLIC_SUPABASE_URL'];
const KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

async function run() {
  console.log('Fixing null new_followers in social_account_metrics...');
  
  // 1. Get all metrics where new_followers is null or missing
  let res = await fetch(`${URL_BASE}/rest/v1/social_account_metrics?select=*&order=period_start.desc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const allMetrics = await res.json();
  
  // Group by client and platform
  const groups = {};
  for (const m of allMetrics) {
    const k = `${m.client_id}_${m.platform}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(m);
  }
  
  let fixedCount = 0;
  
  for (const k of Object.keys(groups)) {
    const list = groups[k];
    // list is ordered by period_start desc
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      if (current.new_followers === null && current.followers !== null) {
        // Look for the next older record
        if (i + 1 < list.length) {
          const prev = list[i + 1];
          if (prev.followers !== null) {
            const newFollowers = current.followers - prev.followers;
            console.log(`Fixing ${current.platform} for client ${current.client_id.substring(0,6)}... ${prev.followers} -> ${current.followers} (diff: ${newFollowers})`);
            
            // Update the DB
            await fetch(`${URL_BASE}/rest/v1/social_account_metrics?id=eq.${current.id}`, {
              method: 'PATCH',
              headers: { 
                apikey: KEY, 
                Authorization: `Bearer ${KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ new_followers: newFollowers })
            });
            fixedCount++;
          }
        } else {
           // No previous record, new followers is 0
           console.log(`Fixing ${current.platform} (no prev record) -> 0`);
           await fetch(`${URL_BASE}/rest/v1/social_account_metrics?id=eq.${current.id}`, {
              method: 'PATCH',
              headers: { 
                apikey: KEY, 
                Authorization: `Bearer ${KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ new_followers: 0 })
            });
            fixedCount++;
        }
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} records!`);
}

run().catch(console.error);
