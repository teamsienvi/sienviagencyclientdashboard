const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  
  for (const client of clients) {
    const { data: metricool } = await supabase.from('client_metricool_config').select('platform, is_active').eq('client_id', client.id);
    const { data: ga4 } = await supabase.from('client_ga4_config').select('ga4_property_id').eq('client_id', client.id);
    const { data: seo } = await supabase.from('client_seo_config').select('domain').eq('client_id', client.id).eq('is_active', true);
    
    console.log(`\n--- ${client.name} ---`);
    const activeMetricool = metricool ? metricool.filter(m => m.is_active).map(m => m.platform) : [];
    console.log(`Social/Ads Platforms: ${activeMetricool.length > 0 ? activeMetricool.join(', ') : 'None'}`);
    console.log(`GA4: ${ga4 && ga4.length > 0 ? ga4[0].ga4_property_id : 'None'}`);
    console.log(`SEO: ${seo && seo.length > 0 ? seo[0].domain : 'None'}`);
  }
}

run();
