import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jdodjbzypuiyhgrzuyzp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RqYnp5cHVpeWhncnp1eXpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5NTU0NCwiZXhwIjoyMDkwNTcxNTQ0fQ.GE5_tYmuDdGZZYi1EDONwsZy5_jCWNTZxn9HcFdqYpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // 1. Fetch all failed/stuck entries
  const { data: failed, error: fetchError } = await supabase
    .from('sync_state_registry')
    .select('client_id, platform, module, status, retry_count, error_message')
    .or('status.eq.failed,retry_count.gte.3');

  if (fetchError) { console.error('Fetch error:', fetchError); return; }
  if (!failed || failed.length === 0) { console.log('✅ No stuck entries found!'); return; }

  // 2. Get client names for display
  const { data: clients } = await supabase.from('clients').select('id, name');
  const clientMap: Record<string, string> = {};
  for (const c of (clients || [])) clientMap[(c as any).id] = (c as any).name;

  console.log(`Found ${failed.length} stuck entries to reset:\n`);
  for (const s of failed) {
    const name = clientMap[(s as any).client_id] || (s as any).client_id.slice(0, 8);
    console.log(`  ❌ ${name} | ${(s as any).platform}/${(s as any).module} | retries=${(s as any).retry_count} | ${(s as any).error_message?.slice(0, 60) || ''}`);
  }

  // 3. Bulk reset all failed entries
  const { error: resetError } = await supabase
    .from('sync_state_registry')
    .update({
      status: 'idle',
      retry_count: 0,
      error_message: null,
      job_locked_until: null,
      next_retry_at: null,
      last_failed_at: null,
    })
    .or('status.eq.failed,retry_count.gte.3');

  if (resetError) {
    console.error('\n❌ Reset failed:', resetError);
    return;
  }

  console.log(`\n✅ Successfully reset ${failed.length} stuck entries to idle.`);
  console.log('The cron will pick these up on its next scheduled run.');

  // 4. Also check the seo entries that we know work but show failed via orchestrate-sync
  // Those are routing through orchestrate-sync with wrong path, let's verify
  const { data: seoFailed } = await supabase
    .from('sync_state_registry')
    .select('client_id, platform, module')
    .eq('platform', 'seo')
    .eq('status', 'idle');

  console.log(`\nSEO entries now idle: ${seoFailed?.length || 0}`);
}

run();
