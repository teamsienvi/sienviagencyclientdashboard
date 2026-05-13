import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mhuxrnxajtiwxauhlhlv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDg3MjAsImV4cCI6MjA2MTI4NDcyMH0.3LKo4RMt5GsNj2-jvjOgB7_LNijUf8OA6C8VEZlJF0I'
);

async function run() {
  // 1. Get all clients
  const { data: clients } = await supabase.from('clients' as any).select('id, name');
  const clientMap: Record<string, string> = {};
  for (const c of (clients || [])) clientMap[(c as any).id] = (c as any).name;

  // 2. Query all active platform configs
  const [
    { data: metricoolConfigs },
    { data: seoConfigs },
    { data: metaConfigs },
    { data: youtubeConfigs },
    { data: shopifyConfigs },
    { data: lmsConfigs },
  ] = await Promise.all([
    supabase.from('client_metricool_config' as any).select('client_id, platform').eq('is_active', true),
    supabase.from('client_seo_config' as any).select('client_id').eq('is_active', true),
    supabase.from('client_meta_config' as any).select('client_id, platform').eq('is_active', true),
    supabase.from('client_youtube_config' as any).select('client_id').eq('is_active', true),
    supabase.from('client_shopify_config' as any).select('client_id').eq('is_active', true),
    supabase.from('client_lms_config' as any).select('client_id').eq('is_active', true),
  ]);

  // Build per-client platform map
  const clientPlatforms: Record<string, Set<string>> = {};
  const ensure = (id: string) => { if (!clientPlatforms[id]) clientPlatforms[id] = new Set(); };

  for (const r of (metricoolConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add(`metricool:${(r as any).platform}`);
  }
  for (const r of (seoConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add('seo');
  }
  for (const r of (metaConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add(`meta:${(r as any).platform}`);
  }
  for (const r of (youtubeConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add('youtube');
  }
  for (const r of (shopifyConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add('shopify');
  }
  for (const r of (lmsConfigs || [])) {
    ensure((r as any).client_id);
    clientPlatforms[(r as any).client_id].add('lms');
  }

  // 3. Fetch ALL sync states (not just failed)
  const { data: allStates } = await supabase
    .from('sync_state_registry' as any)
    .select('client_id, platform, module, status, retry_count, last_synced_at');

  console.log('\n=== ALL SYNC REGISTRY ENTRIES vs ACTUAL CONFIG ===\n');
  console.log(`${'Client'.padEnd(28)} ${'platform/module'.padEnd(28)} ${'Status'.padEnd(10)} ${'Has Config?'.padEnd(14)} Note`);
  console.log('-'.repeat(100));

  const orphaned: Array<{ client_id: string; platform: string; module: string }> = [];

  for (const s of (allStates || [])) {
    const clientName = clientMap[(s as any).client_id] || `UNKNOWN(${(s as any).client_id.slice(0, 8)})`;
    const platform = (s as any).platform as string;
    const module = (s as any).module as string;
    const status = (s as any).status;
    const clientP = clientPlatforms[(s as any).client_id] || new Set();

    // Skip AI summary entries — these are always valid
    if (module === 'social_summary' || module === 'website_summary') continue;

    // Check if client actually has this platform configured
    let hasConfig = false;
    let note = '';
    if (platform === 'seo') { hasConfig = clientP.has('seo'); note = 'client_seo_config'; }
    else if (platform === 'instagram') { hasConfig = clientP.has('meta:instagram'); note = 'client_meta_config(instagram)'; }
    else if (platform === 'facebook') { hasConfig = clientP.has('meta:facebook'); note = 'client_meta_config(facebook)'; }
    else if (platform === 'youtube') { hasConfig = clientP.has('youtube'); note = 'client_youtube_config'; }
    else if (platform === 'shopify') { hasConfig = clientP.has('shopify'); note = 'client_shopify_config'; }
    else if (platform === 'lms') { hasConfig = clientP.has('lms'); note = 'client_lms_config'; }
    else if (platform === 'social') { hasConfig = clientP.has('metricool:social') || clientP.has('metricool:instagram') || clientP.has('metricool:facebook') || clientP.has('metricool:tiktok'); note = 'client_metricool_config'; }
    else if (platform === 'ads') { hasConfig = clientP.has('metricool:ads'); note = 'client_metricool_config(ads)'; }
    else if (platform === 'tiktok') { hasConfig = clientP.has('metricool:tiktok'); note = 'client_metricool_config(tiktok)'; }
    else if (platform === 'x') { hasConfig = clientP.has('metricool:x'); note = 'client_metricool_config(x)'; }
    else if (platform === 'linkedin') { hasConfig = clientP.has('metricool:linkedin'); note = 'client_metricool_config(linkedin)'; }
    else { hasConfig = true; note = 'unknown platform'; } // Don't flag unknowns

    const flag = hasConfig ? '✅ config found' : '❌ NO CONFIG';
    const statusStr = status === 'ready' ? '✅ ready' : status === 'failed' ? '❌ failed' : '🔄 syncing';
    
    if (!hasConfig) {
      orphaned.push({ client_id: (s as any).client_id, platform, module });
      console.log(`${clientName.slice(0, 27).padEnd(28)} ${`${platform}/${module}`.slice(0, 27).padEnd(28)} ${statusStr.padEnd(10)} ${flag.padEnd(14)} ${note}`);
    }
  }

  if (orphaned.length === 0) {
    console.log('✅ No orphaned entries found! All registry entries match active configs.\n');
  } else {
    console.log(`\n🗑️  ${orphaned.length} orphaned registry entries (no matching config) — should be deleted.\n`);
    // Generate the SQL to delete them
    console.log('SQL to clean up orphaned entries:');
    for (const o of orphaned) {
      console.log(`DELETE FROM sync_state_registry WHERE client_id='${o.client_id}' AND platform='${o.platform}' AND module='${o.module}';`);
    }
  }
}

run();
