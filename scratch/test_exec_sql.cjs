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
const clientId = 'd6980a31-7b9c-48c6-a6c8-f4633d6bfa33';

async function run() {
  const sql = `
    INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, is_active, is_business)
    VALUES 
    ('${clientId}', 'instagram', '4380439', '5693754', true, true),
    ('${clientId}', 'facebook', '4380439', '5693754', true, true)
    ON CONFLICT (client_id, platform) DO UPDATE SET 
      user_id = EXCLUDED.user_id,
      blog_id = EXCLUDED.blog_id;
  `;
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });
  
  console.log(await res.text());
}

run().catch(console.error);
