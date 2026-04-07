import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We use the anon key for triggering Edge Functions safely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function syncAllClients() {
  console.log("🔍 Fetching clients with active Ubersuggest tracking...");
  
  // Find all active mapped clients
  const { data: configs, error } = await supabase
    .from('client_seo_config')
    .select('client_id, domain')
    .eq('is_active', true);

  if (error || !configs) {
    console.error("❌ Failed to fetch SEO configs:", error);
    return;
  }

  console.log(`✅ Found ${configs.length} tracked clients.`);

  for (const config of configs) {
    console.log(`\n🚀 Triggering sync for domain: ${config.domain}`);
    
    // Invoke the deployed Edge Function!
    const { data, error: invokeError } = await supabase.functions.invoke('sync-ubersuggest', {
      body: { clientId: config.client_id },
    });

    if (invokeError) {
      console.error(`❌ Failed to sync ${config.domain}:`, invokeError.message || invokeError);
    } else {
      console.log(`✅ Successfully synced ${config.domain}!`);
      console.log("   Audit Score:", data?.data?.siteAuditScore);
      console.log("   Keyword Alerts found:", data?.data?.trackedKeywordsCount);
    }
  }
}

syncAllClients();
