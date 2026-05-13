/**
 * diagnose_summaries_table.mjs
 * Direct diagnostic — tries to insert a minimal test row and
 * reads back the actual error from the REST API response body.
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

// Test client: Snarky Humans
const CLIENT_ID = 'ef580ebf-439f-4305-826a-f1f8aa89fd03';

async function run() {
  console.log('=== Diagnose analytics_summaries ===\n');

  // 1. Check table columns
  const colRes = await fetch(
    `${URL_BASE}/rest/v1/analytics_summaries?limit=0`,
    { method: 'GET', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Accept: 'application/json' } }
  );
  console.log('GET (cols probe) status:', colRes.status);
  const colHdr = colRes.headers.get('Content-Range');
  console.log('Content-Range:', colHdr); // tells us row count

  // 2. Try a minimal insert with verbose=true
  const testPayload = {
    client_id: CLIENT_ID,
    type: 'social',
    summary_data: { test: true },
    period_start: '2026-04-29',
    period_end: '2026-05-06',
    generated_at: new Date().toISOString(),
  };

  console.log('\nAttempting minimal INSERT...');
  const insRes = await fetch(
    `${URL_BASE}/rest/v1/analytics_summaries`,
    {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(testPayload),
    }
  );
  const insBody = await insRes.text();
  console.log('Insert status:', insRes.status);
  console.log('Insert body:', insBody.slice(0, 500));

  // 3. Try with run-migration to get schema info
  const schemaSQL = `
    SELECT 
      c.column_name, c.data_type, c.is_nullable,
      cc.check_clause
    FROM information_schema.columns c
    LEFT JOIN information_schema.check_constraints cc 
      ON cc.constraint_name IN (
        SELECT rc.constraint_name FROM information_schema.constraint_column_usage ccu
        JOIN information_schema.referential_constraints rc ON rc.unique_constraint_name = ccu.constraint_name
        WHERE ccu.table_name = 'analytics_summaries' AND ccu.column_name = c.column_name
      )
    WHERE c.table_name = 'analytics_summaries'
    ORDER BY c.ordinal_position;
  `;
  
  const migRes = await fetch(`${URL_BASE}/functions/v1/run-migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ sql: schemaSQL }),
  });
  const migBody = await migRes.text();
  console.log('\nSchema query result:', migBody.slice(0, 800));

  // 4. Check all constraints on the table
  const constraintSQL = `
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'analytics_summaries'::regclass
    ORDER BY contype;
  `;
  const cRes = await fetch(`${URL_BASE}/functions/v1/run-migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ sql: constraintSQL }),
  });
  console.log('\nConstraints:', (await cRes.text()).slice(0, 1000));
}

run().catch(e => console.error(e));
