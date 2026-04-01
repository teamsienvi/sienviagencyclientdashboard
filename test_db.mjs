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
  const clientsRes = await fetch(`${url}/rest/v1/clients?name=ilike.*Snarky%20Pets*&select=id,name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const clients = await clientsRes.json();
  const clientId = clients[0].id;

  const postsRes = await fetch(`${url}/rest/v1/social_content?client_id=eq.${clientId}&platform=eq.facebook&order=published_at.desc&limit=5&select=id,published_at,content_type,url,title`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const posts = await postsRes.json();
  console.log('Recent FB Posts:', JSON.stringify(posts, null, 2));

  // Let's also check the metricool config so we can fetch the CSV directly
  const configRes = await fetch(`${url}/rest/v1/client_metricool_config?client_id=eq.${clientId}&platform=eq.facebook&select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const config = await configRes.json();
  
  if (config.length > 0 && process.env.METRICOOL_TOKEN) {
    console.log('Fetching CSV from Metricool...');
    const userId = config[0].user_id;
    const blogId = config[0].blog_id;
    const reportingTimezone = config[0].reporting_timezone || 'UTC';
    
    let apiUrl = `https://app.metricool.com/api/v2/analytics/posts/facebook?from=2026-03-24T00:00:00&to=2026-03-31T23:59:59&timezone=${reportingTimezone}&userId=${userId}`;
    if (blogId) apiUrl += `&blogId=${blogId}`;
    
    const metricoolRes = await fetch(apiUrl, {
      headers: { 'x-mc-auth': process.env.METRICOOL_TOKEN, accept: 'text/csv' }
    });
    const csvStr = await metricoolRes.text();
    console.log('CSV Header:', csvStr.split('\n')[0]);
    console.log('CSV First Row:', csvStr.split('\n')[1]);
  } else {
    console.log('No Metricool Token to fetch CSV');
  }
}

run();
