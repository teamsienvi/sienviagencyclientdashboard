/**
 * full_sync_and_summarize.mjs
 * 1. Triggers bulk-sync-all to kick off all platform syncs across all clients
 * 2. Polls sync_state_registry until all modules are no longer 'syncing'
 * 3. Fires generate-analytics-summary (social + website) for every active client
 * 4. Reports final status
 */
import fs from 'fs';

const SUPABASE_URL = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

const hdrs = (key = ANON_KEY) => ({
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json',
  'apikey': key,
});

const color = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

async function invokeFunction(fn, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: hdrs(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function getRegistryStats() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_state_registry?select=status,client_id`, {
    headers: hdrs(),
  });
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  return {
    total: rows.length,
    ready: rows.filter(r => r.status === 'ready').length,
    syncing: rows.filter(r => r.status === 'syncing').length,
    failed: rows.filter(r => r.status === 'failed').length,
    clients: [...new Set(rows.map(r => r.client_id))],
  };
}

async function getActiveClients() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id,name&is_active=eq.true`, {
    headers: hdrs(),
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(color.bold('\n╔══════════════════════════════════════════════════════╗'));
  console.log(color.bold('║   🚀 Full Sync + Summary — All Clients               ║'));
  console.log(color.bold(`║   Started: ${now().padEnd(42)}║`));
  console.log(color.bold('╚══════════════════════════════════════════════════════╝\n'));

  // ── Phase 1: Fire cron-sync-dispatcher in waves until all modules are dispatched ──
  console.log(color.cyan('── Phase 1: Bulk Dispatch (cron-sync-dispatcher waves) ──'));
  
  let wave = 0;
  const MAX_WAVES = 20; // 20 waves × 15 per wave = 300 module slots — more than enough
  let totalDispatched = 0;

  for (let i = 0; i < MAX_WAVES; i++) {
    wave++;
    process.stdout.write(`  Wave ${wave}: `);
    const { ok, data } = await invokeFunction('cron-sync-dispatcher');
    if (!ok) {
      console.log(color.red(`dispatcher error: ${JSON.stringify(data).slice(0, 100)}`));
      break;
    }
    totalDispatched += (data.dispatched || 0);
    console.log(`dispatched ${color.green(data.dispatched)} | failed ${data.failed > 0 ? color.red(data.failed) : data.failed}`);
    
    if (data.dispatched === 0) {
      console.log(color.green(`  ✓ No more eligible modules — all dispatched after ${wave} waves`));
      break;
    }
    // Small gap between waves to let functions register locks
    await sleep(3000);
  }
  console.log(`  Total dispatched across all waves: ${color.bold(totalDispatched)}`);

  // ── Phase 2: Poll until syncing count reaches 0 ──────────────────────────
  console.log(color.cyan('\n── Phase 2: Waiting for syncs to complete ────────────'));
  const POLL_INTERVAL = 15000; // 15s
  const MAX_WAIT_MS   = 10 * 60 * 1000; // 10 min max
  const startWait     = Date.now();
  let lastSyncing     = 999;

  while (Date.now() - startWait < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL);
    const stats = await getRegistryStats();
    if (!stats) { console.log(color.yellow('  Could not read registry (RLS?)…')); continue; }

    const elapsed = Math.round((Date.now() - startWait) / 1000);
    console.log(`  [${elapsed}s]  ready: ${color.green(stats.ready)}  syncing: ${color.yellow(stats.syncing)}  failed: ${stats.failed > 0 ? color.red(stats.failed) : stats.failed}`);

    if (stats.syncing === 0) {
      console.log(color.green(`\n  ✓ All syncs settled (${elapsed}s elapsed)`));
      break;
    }
    lastSyncing = stats.syncing;
  }

  // ── Phase 3: Fire generate-analytics-summary for every active client ──────
  console.log(color.cyan('\n── Phase 3: Generating Summaries for All Clients ────'));
  const clients = await getActiveClients();
  
  if (clients.length === 0) {
    // Fallback: get unique client IDs from registry
    console.log(color.yellow('  clients table not accessible via anon — reading from registry'));
    const stats = await getRegistryStats();
    const clientIds = stats?.clients || [];
    for (const cid of clientIds) {
      clients.push({ id: cid, name: cid.slice(0, 8) });
    }
  }

  console.log(`  Found ${clients.length} clients\n`);
  const summaryResults = [];

  for (const client of clients) {
    const label = (client.name || client.id?.slice(0, 8)).padEnd(24);
    
    // Social summary
    process.stdout.write(`  ${label} social... `);
    const social = await invokeFunction('generate-analytics-summary', { clientId: client.id, type: 'social' });
    if (social.ok) {
      console.log(color.green('✓ social') + '  ');
    } else {
      console.log(color.red(`✗ social (${social.status}: ${JSON.stringify(social.data).slice(0,80)})`));
    }

    await sleep(1000); // avoid hammering

    // Website summary
    process.stdout.write(`  ${label} website... `);
    const website = await invokeFunction('generate-analytics-summary', { clientId: client.id, type: 'website' });
    if (website.ok) {
      console.log(color.green('✓ website'));
    } else {
      console.log(color.red(`✗ website (${website.status}: ${JSON.stringify(website.data).slice(0,80)})`));
    }

    await sleep(1000);

    // SEO summary
    process.stdout.write(`  ${label} seo...     `);
    const seoSummary = await invokeFunction('generate-analytics-summary', { clientId: client.id, type: 'seo' });
    if (seoSummary.ok) {
      console.log(color.green('✓ seo'));
    } else {
      console.log(color.red(`✗ seo (${seoSummary.status}: ${JSON.stringify(seoSummary.data).slice(0,80)})`));
    }

    await sleep(1000);
    summaryResults.push({ clientId: client.id, name: client.name, social: social.ok, website: website.ok, seo: seoSummary.ok });
  }

  // ── Phase 4: Final registry check ────────────────────────────────────────
  console.log(color.cyan('\n── Phase 4: Final Registry Status ───────────────────'));
  const finalStats = await getRegistryStats();
  if (finalStats) {
    console.log(`  Total modules : ${color.bold(finalStats.total)}`);
    console.log(`  Ready         : ${color.green(finalStats.ready)}`);
    console.log(`  Still syncing : ${finalStats.syncing > 0 ? color.yellow(finalStats.syncing) : color.green(finalStats.syncing)}`);
    console.log(`  Failed        : ${finalStats.failed > 0 ? color.red(finalStats.failed) : color.green(finalStats.failed)}`);
  }

  const summaryOk     = summaryResults.filter(r => r.social && r.website).length;
  const summaryFailed = summaryResults.filter(r => !r.social || !r.website).length;
  console.log(`  Summaries OK  : ${color.green(summaryOk)}/${summaryResults.length}`);
  if (summaryFailed > 0) {
    console.log(`  Summary failures:`);
    summaryResults.filter(r => !r.social || !r.website).forEach(r => {
      console.log(`    ${color.red('✗')} ${r.name || r.clientId?.slice(0,8)} — social:${r.social ? '✓' : '✗'} website:${r.website ? '✓' : '✗'}`);
    });
  }

  // Save results
  fs.writeFileSync('sync_run_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalDispatched,
    finalRegistry: finalStats,
    summaryResults,
  }, null, 2));
  console.log(color.dim('\n  Full results saved to sync_run_results.json'));

  console.log(color.bold('\n╔══════════════════════════════════════════════════════╗'));
  console.log(color.bold(`║   Done: ${now().padEnd(46)}║`));
  console.log(color.bold('╚══════════════════════════════════════════════════════╝\n'));
}

main().catch(e => {
  console.error('\x1b[31mFatal:\x1b[0m', e.message);
  process.exit(1);
});
