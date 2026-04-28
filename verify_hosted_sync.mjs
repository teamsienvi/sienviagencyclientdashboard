import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local", process.env.NEXT_PUBLIC_SUPABASE_URL);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Use a known clientId for verification. Let's get the first active client.
async function getTestClient() {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .limit(1)
    .single();
  
  if (error || !data) {
    console.error("Failed to find a client:", error);
    process.exit(1);
  }
  return data.id;
}

async function verifyModule(clientId, platform, module) {
  console.log(`\nVerifying [${platform}] - [${module}]...`);
  
  // 1. Invoke orchestrate-sync
  const startTime = Date.now();
  const { data: syncRes, error: syncErr } = await supabase.functions.invoke('orchestrate-sync', {
    body: { clientId, platform, module, forceRetry: true }
  });

  if (syncErr) {
    let errorDetail = syncErr.message;
    if (syncErr.context && syncErr.context.json) {
      try {
        const body = await syncErr.context.json();
        errorDetail = JSON.stringify(body);
      } catch (e) {}
    }
    console.error(`❌ orchestrate-sync failed for ${platform}/${module}:`, errorDetail);
    return false;
  }
  
  console.log(`✅ orchestrate-sync responded in ${Date.now() - startTime}ms`, syncRes);
  
  // Wait a moment for background processing if applicable
  await new Promise(r => setTimeout(r, 2000));
  
  // 2. Check the cache
  if (platform === 'seo') {
    const { data: seoData, error: seoErr } = await supabase
      .from('report_seo_metrics')
      .select('id, collected_at')
      .eq('client_id', clientId)
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (seoErr) {
      console.error(`❌ Failed to read report_seo_metrics:`, seoErr.message);
      return false;
    }
    
    if (!seoData) {
      console.warn(`⚠️ No SEO data found for client ${clientId} (could be expected if not configured)`);
    } else {
      console.log(`✅ Found SEO data collected at ${seoData.collected_at}`);
    }
  } else {
    const { data: cacheData, error: cacheErr } = await supabase
      .from('platform_analytics_cache')
      .select('collected_at')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .eq('module', module)
      .maybeSingle();
      
    if (cacheErr) {
      console.error(`❌ Failed to read cache:`, cacheErr.message);
      return false;
    }
    
    if (!cacheData) {
      console.warn(`⚠️ No cache data found for ${platform}/${module} (might need proper setup)`);
    } else {
      console.log(`✅ Found cache data collected at ${cacheData.collected_at}`);
    }
  }

  // 3. Check sync_state_registry
  const { data: stateData, error: stateErr } = await supabase
    .from('sync_state_registry')
    .select('status, job_locked_until, last_success_at, next_retry_at, error_message')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .eq('module', module)
    .maybeSingle();

  if (stateErr) {
    console.error(`❌ Failed to read registry:`, stateErr.message);
    return false;
  }

  console.log(`✅ Registry State:`, stateData);
  return true;
}

async function run() {
  const clientId = await getTestClient();
  console.log(`Using Test Client: ${clientId}`);

  const modules = [
    { platform: 'ads', module: 'metricool' },
    { platform: 'shopify', module: 'analytics' },
    { platform: 'lms', module: 'analytics' },
    { platform: 'seo', module: 'ubersuggest' }
  ];

  for (const mod of modules) {
    await verifyModule(clientId, mod.platform, mod.module);
  }
}

run();
