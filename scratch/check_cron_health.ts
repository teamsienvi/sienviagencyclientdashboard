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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  // 1. Check sync_state_registry for all clients/platforms
  const { data: states, error } = await supabase
    .from('sync_state_registry' as any)
    .select('client_id, platform, module, status, last_synced_at, last_success_at, last_failed_at, stale_after_at, retry_count, error_message')
    .order('last_synced_at', { ascending: false });

  if (error) { console.error('Error fetching sync states:', error); return; }

  // 2. Get client names
  const { data: clients } = await supabase
    .from('clients' as any)
    .select('id, name');
  const clientMap: Record<string, string> = {};
  for (const c of (clients || [])) clientMap[(c as any).id] = (c as any).name;

  const now = new Date();

  console.log('\n=== SYNC STATE REGISTRY ===\n');
  console.log(`${'Client'.padEnd(28)} ${'Platform/Module'.padEnd(25)} ${'Status'.padEnd(10)} ${'Last Sync'.padEnd(22)} ${'Stale?'.padEnd(8)} Retries`);
  console.log('-'.repeat(110));

  const grouped: Record<string, any[]> = {};
  for (const s of (states || [])) {
    const name = clientMap[(s as any).client_id] || (s as any).client_id.slice(0, 8);
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(s);
  }

  for (const [clientName, rows] of Object.entries(grouped)) {
    for (const s of rows) {
      const platform = `${(s as any).platform}/${(s as any).module}`;
      const status = (s as any).status || 'unknown';
      const lastSync = (s as any).last_synced_at 
        ? new Date((s as any).last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'never';
      const staleAfter = (s as any).stale_after_at ? new Date((s as any).stale_after_at) : null;
      const isStale = staleAfter ? now > staleAfter : true;
      const staleFlag = isStale ? '⚠️ YES' : '✅ no';
      const retries = (s as any).retry_count || 0;
      const statusIcon = status === 'ready' ? '✅' : status === 'syncing' ? '🔄' : status === 'failed' ? '❌' : '❓';

      console.log(
        `${clientName.slice(0,27).padEnd(28)} ${platform.slice(0,24).padEnd(25)} ${(statusIcon + ' ' + status).padEnd(10)} ${lastSync.padEnd(22)} ${staleFlag.padEnd(8)} ${retries}`
      );

      if (status === 'failed' && (s as any).error_message) {
        console.log(`  ⚠️  Error: ${(s as any).error_message}`);
      }
    }
    console.log();
  }

  // 3. Check cron jobs via pg_cron
  console.log('\n=== CHECKING SOCIAL DATA FRESHNESS ===\n');
  
  const tables = [
    { name: 'social_account_metrics', label: 'Social Metrics' },
    { name: 'social_follower_timeline', label: 'Follower Timeline' },
    { name: 'analytics_summaries', label: 'AI Summaries' },
    { name: 'report_seo_metrics', label: 'SEO Metrics' },
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name as any)
      .select('created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) { console.log(`${table.label}: ❌ Error - ${error.message}`); continue; }
    if (!data) { console.log(`${table.label}: ❌ No data found`); continue; }

    const ts = (data as any).created_at || (data as any).collected_at || (data as any).updated_at;
    const age = ts ? Math.round((now.getTime() - new Date(ts).getTime()) / 3600000) : null;
    const fresh = age !== null && age < 25;
    console.log(`${table.label.padEnd(22)}: ${fresh ? '✅' : '⚠️ '} Last row: ${ts ? new Date(ts).toLocaleString() : 'unknown'} (${age}h ago)`);
  }
}

run();
