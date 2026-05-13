import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1].trim()] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%Serenity Scrolls%');
    if (!clients || clients.length === 0) {
      console.log('Client not found');
      process.exit(0);
    }
    const clientId = clients[0].id;
    console.log('Client ID:', clientId);
    
    const { data: configs } = await supabase.from('client_platform_configs').select('*').eq('client_id', clientId).in('platform', ['instagram', 'facebook']);
    console.log('Configs:', configs?.map(c => c.platform));
    
    for (const config of configs || []) {
      const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const periodEnd = new Date().toISOString();
      
      console.log('Invoking sync-meta for', config.platform);
      
      // Make direct HTTP request to see exact error
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-meta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          clientId: clientId,
          accountId: config.id,
          platform: config.platform,
          accessToken: config.access_token,
          accountExternalId: config.account_id,
          periodStart,
          periodEnd
        })
      });
      
      const text = await res.text();
      console.log('Status:', res.status, 'Response:', text);
    }
  } catch (err) {
    console.error('Script Error:', err);
  }
  process.exit(0);
}
run();
