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
// Use service role key if available for invoking functions without RLS issues, or anon key.
// Edge functions invoked via Supabase JS client use the provided auth token. If none, they might fail if require auth.
const serviceKey = supabaseKey;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('Fetching clients with active SEO configuration...');
  const { data: seoConfigs, error } = await supabase
    .from('client_seo_config')
    .select('client_id, domain')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch seo configs:', error);
    return;
  }

  console.log(`Found ${seoConfigs.length} clients with Ubersuggest (SEO) enabled.`);

  for (const config of seoConfigs) {
    console.log(`\nTriggering sync-ubersuggest for client: ${config.client_id} (${config.domain})`);
    
    const { data, error: invokeError } = await supabase.functions.invoke('sync-ubersuggest', {
      body: { clientId: config.client_id },
    });

    if (invokeError) {
      console.error(`❌ Failed to sync ${config.domain}:`, invokeError);
    } else {
      console.log(`✅ Successfully synced ${config.domain}:`, data);
    }
  }
  
  console.log('\nAll sync tasks completed.');
}

run();
