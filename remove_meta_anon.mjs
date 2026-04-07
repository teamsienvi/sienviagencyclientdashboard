import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  const clientsRes = await fetch(`${url}/rest/v1/clients?name=eq.Snarky%20A%24%24%20Humans&select=id,name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const clients = await clientsRes.json();
  if (!clients || clients.length === 0) {
      console.log('Client not found');
      process.exit(1);
  }
  const clientId = clients[0].id;
  console.log(`Found client ${clientId}`);

  const mcRes = await fetch(`${url}/rest/v1/client_metricool_config?client_id=eq.${clientId}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const mc = await mcRes.json();
  
  const metaPlatforms = ['facebook', 'instagram', 'meta_ads'];
  for (const platform of mc) {
    if (metaPlatforms.includes(platform.platform)) {
      const updateRes = await fetch(`${url}/rest/v1/client_metricool_config?id=eq.${platform.id}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false })
      });
      console.log(`Updated metricool ${platform.platform} to inactive:`, updateRes.status);
    }
  }

  const oauthRes = await fetch(`${url}/rest/v1/social_oauth_accounts?client_id=eq.${clientId}&platform=eq.meta`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const oauth = await oauthRes.json();
  for (const acct of oauth) {
    const updateRes = await fetch(`${url}/rest/v1/social_oauth_accounts?id=eq.${acct.id}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false })
      });
      console.log(`Updated oauth meta to inactive:`, updateRes.status);
  }
  process.exit(0);
}
run();
