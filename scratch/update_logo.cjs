const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) acc[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

async function run() {
  try {
    const fnRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/clients?id=eq.0b90215e-e55d-4b5e-8453-de35153a1fcd`, {
        method: 'PATCH',
        headers: { 
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY.trim()}`, 
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY.trim(),
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ logo_url: '/bb-logo.jpg' })
    });
    const result = await fnRes.json();
    console.log("Update result:", result);
  } catch(e) { console.error(e); }
}
run();
