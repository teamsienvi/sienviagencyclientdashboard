/**
 * check_table_exists.mjs
 * Quick check: does analytics_summaries exist in production?
 * Uses run-migration to execute a direct pg_tables query.
 */
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const k = line.substring(0, eqIdx).trim();
    const v = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const URL_BASE = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function sql(query) {
  const res = await fetch(`${URL_BASE}/functions/v1/run-migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ sql: query }),
  });
  return res.text();
}

async function run() {
  console.log('=== Production DB Diagnostic ===\n');

  // Check if table exists
  console.log('1. Table existence:');
  console.log(await sql(`SELECT tablename, tableowner FROM pg_tables WHERE tablename = 'analytics_summaries';`));

  // Check columns if exists
  console.log('\n2. Columns:');
  console.log(await sql(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'analytics_summaries' ORDER BY ordinal_position;`));

  // Check constraints
  console.log('\n3. Constraints:');
  console.log(await sql(`SELECT conname, contype::text, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.analytics_summaries'::regclass;`));

  // Check RLS policies
  console.log('\n4. RLS Policies:');
  console.log(await sql(`SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'analytics_summaries';`));

  // Check row count (service role bypass)
  console.log('\n5. Row count (service role):');
  console.log(await sql(`SELECT COUNT(*) FROM analytics_summaries;`));

  // Try a direct insert via service role SQL
  console.log('\n6. Direct insert test (service role):');
  console.log(await sql(`
    INSERT INTO analytics_summaries (client_id, type, summary_data, period_start, period_end)
    VALUES ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'social', '{"test": true}'::jsonb, '2026-04-29', '2026-05-06')
    ON CONFLICT (client_id, type) DO UPDATE SET
      summary_data = EXCLUDED.summary_data,
      generated_at = NOW()
    RETURNING id, client_id, type, generated_at;
  `));
}

run().catch(e => console.error(e));
