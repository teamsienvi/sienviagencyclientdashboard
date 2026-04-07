import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  const clientsRes = await fetch(`${url}/rest/v1/clients?name=eq.Snarky%20A%24%24%20Humans&select=id,name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const clients = await clientsRes.json();
  console.log(clients);
  if (clients.length === 0) {
      console.log('Client not found');
      return;
  }
  const clientId = clients[0].id;

  // fetch current metricool config
  const mcRes = await fetch(`${url}/rest/v1/client_metricool_config?client_id=eq.${clientId}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const mc = await mcRes.json();
  console.log('Current metricool config:', mc);

  // set active=false for meta platforms
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
      console.log(`Updated ${platform.platform} to inactive:`, updateRes.status);
    }
  }

  // also disable connected oauth meta?
  const oauthRes = await fetch(`${url}/rest/v1/social_oauth_accounts?client_id=eq.${clientId}&platform=eq.meta`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const oauth = await oauthRes.json();
  console.log('Current oauth:', oauth);
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
}
run();
