import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[match[1].trim()] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: clients, error: clientErr } = await supabase.from('clients').select('id, name, supabase_url');
  if (clientErr) { console.error(clientErr); return; }

  for (const client of clients) {
    const { data: metricool } = await supabase.from('client_metricool_config').select('platform, is_active').eq('client_id', client.id);
    const { data: ga4 } = await supabase.from('client_ga4_config').select('ga4_property_id').eq('client_id', client.id);
    const { data: seo } = await supabase.from('client_seo_config').select('domain').eq('client_id', client.id).eq('is_active', true);
    
    console.log(`\n--- ${client.name} ---`);
    const activeMetricool = metricool ? metricool.filter(m => m.is_active).map(m => m.platform) : [];
    console.log(`Social/Ads Platforms: ${activeMetricool.length > 0 ? activeMetricool.join(', ') : 'None'}`);
    console.log(`Supabase URL: ${client.supabase_url ? 'Yes' : 'No'}`);
    console.log(`GA4: ${ga4 && ga4.length > 0 ? ga4[0].ga4_property_id : 'None'}`);
    console.log(`SEO: ${seo && seo.length > 0 ? seo[0].domain : 'None'}`);
  }
}

run();
