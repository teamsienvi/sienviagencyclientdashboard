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
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  const res = await fetch(`${url}/rest/v1/clients?name=ilike.*oxi*&select=id,name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const clients = await res.json();
  console.log('Oxisure:', JSON.stringify(clients));

  if (clients.length > 0) {
    const cfgRes = await fetch(`${url}/rest/v1/client_metricool_config?client_id=eq.${clients[0].id}&select=platform,user_id,blog_id,is_active`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const cfgs = await cfgRes.json();
    console.log('Configs:', JSON.stringify(cfgs));
  }
}
run();
