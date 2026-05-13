/**
 * regenerate_summaries.mjs
 * Re-trigger generate-analytics-summary for social + website + ads
 * for every client using the service-role bearer token so the
 * analytics_summaries table upsert succeeds.
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

// Use the URL that matches the running edge functions
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']; // mhuxrnxajtiwxauhlhlv
// Use anon key – generate-analytics-summary uses its own internal service role
const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const ALL_CLIENTS = [
  { id: 'ef580ebf-439f-4305-826a-f1f8aa89fd03', name: 'Snarky Humans'          },
  { id: 'd8a121fe-cdd9-4e19-90dc-dd32b159f973', name: 'Snarky Pets'            },
  { id: '297cbb3c-54b4-4bed-8206-25949a94fa62', name: 'Snarky A$$ Humans'      },
  { id: '95791e88-87cd-4621-af7e-df46f5ad93ac', name: 'Father Figure Formula'  },
  { id: 'b6c39651-9259-4930-af6e-b744a5a191ad', name: 'The Haven At Deer Park' },
  { id: '041555a7-1a25-42b8-89c7-edc40afff861', name: 'Serenity Scrolls'       },
  { id: '22090989-2d0e-47b2-b9c5-98652d7f0957', name: 'PlayIQ'                 },
  { id: '1a1edf9f-2ebe-4d40-a904-7295d5033401', name: 'OxiSure Tech'           },
  { id: 'd8f38e01-77ff-4839-ac48-54795adc9f3e', name: 'Sienvi Agency'          },
];

const SUMMARY_TYPES = ['social', 'website', 'ads'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callSummary(clientId, clientName, type) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-analytics-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ clientId, type, dateRange: '7d' }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }

    if (!res.ok) {
      console.log(`  ✗ [${clientName}/${type}] HTTP ${res.status}: ${data.error || text.slice(0, 200)}`);
      return false;
    }

    // Check upsert success
    if (data.debugUpsertError) {
      console.log(`  ⚠ [${clientName}/${type}] Generated but cache upsert failed: ${JSON.stringify(data.debugUpsertError).slice(0, 200)}`);
    } else {
      const topPlatform = data.metrics?.top_platform || '—';
      const followersGained = data.metrics?.followers_gained ?? '—';
      const strengths = data.strengths?.length ?? 0;
      console.log(`  ✓ [${clientName}/${type}] top=${topPlatform}  followers_gained=${followersGained}  strengths=${strengths}`);
    }
    return true;
  } catch (e) {
    console.log(`  ✗ [${clientName}/${type}] ERROR: ${e.message}`);
    return false;
  }
}

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  REGENERATE ALL ANALYTICS SUMMARIES          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Supabase : ${SUPABASE_URL}`);
  console.log(`  Clients  : ${ALL_CLIENTS.length}`);
  console.log(`  Types    : ${SUMMARY_TYPES.join(', ')}\n`);

  let ok = 0, fail = 0;

  for (const client of ALL_CLIENTS) {
    console.log(`\n── ${client.name} ──`);
    for (const type of SUMMARY_TYPES) {
      const success = await callSummary(client.id, client.name, type);
      success ? ok++ : fail++;
      await sleep(1500); // respect Gemini rate limits
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Succeeded: ${ok}   Failed: ${fail}`);
  console.log('═══════════════════════════════════════════════');

  // Verify summaries were cached
  console.log('\n── Verifying analytics_summaries table ──');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_summaries` +
    `?select=client_id,type,generated_at,period_start,period_end` +
    `&order=generated_at.desc&limit=50`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('  ⚠ analytics_summaries is still empty — may be an RLS policy issue on this project.');
    console.log('  Note: The edge function generates summaries in real-time even without caching.');
    console.log('  The dashboard reads live data on each page load if no cache exists.');
  } else {
    console.log(`  Found ${rows.length} cached summaries:`);
    rows.forEach(r => {
      console.log(`  • ${r.type.padEnd(8)} client=${r.client_id}  ${r.period_start}→${r.period_end}  generated=${r.generated_at?.split('T')[0]}`);
    });
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
