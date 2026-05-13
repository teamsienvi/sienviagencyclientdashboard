import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY    = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

// NOTE: The SERVICE_KEY in .env.local has a mismatched project ref (jdodjbzy... ≠ mhuxrnxa...).
// We'll use ANON_KEY for REST reads (works if RLS allows it) and the 
// dispatcher function itself uses the correct key from vault/env.
const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ── Helper ──────────────────────────────────────────────────────────────────
const color = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
};

const now = new Date();
const fmt = d => d ? new Date(d).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'never';
const age = d => {
  if (!d) return 'never';
  const ms = now - new Date(d);
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
};

async function fetchRest(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { headers });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, data });
  return data;
}

async function invokeFunction(name, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(color.bold('\n══════════════════════════════════════════════════════'));
  console.log(color.bold('  🕐  Sienvi Agency — Cron & Daily Sync Health Check'));
  console.log(color.bold(`  Local time: ${fmt(now)}`));
  console.log(color.bold('══════════════════════════════════════════════════════\n'));
  console.log(`  Project URL : ${SUPABASE_URL}`);
  console.log(`  Anon key ref: ${ANON_KEY?.slice(0, 30)}...`);

  // ── 1. sync_state_registry: status overview ──────────────────────────────
  console.log(color.cyan('\n── 1. sync_state_registry: Status Overview ──────────'));
  let registry = [];
  try {
    registry = await fetchRest('sync_state_registry?select=*&order=last_synced_at.desc.nullslast&limit=200');

    const total     = registry.length;
    const ready     = registry.filter(r => r.status === 'ready').length;
    const syncing   = registry.filter(r => r.status === 'syncing').length;
    const failed    = registry.filter(r => r.status === 'failed').length;
    const pending   = registry.filter(r => r.status === 'pending').length;
    const stale     = registry.filter(r => r.stale_after_at && new Date(r.stale_after_at) < now && !['syncing','failed'].includes(r.status)).length;
    const locked    = registry.filter(r => r.job_locked_until && new Date(r.job_locked_until) > now).length;
    const synced1h  = registry.filter(r => r.last_synced_at && (now - new Date(r.last_synced_at)) < 3600000).length;
    const synced24h = registry.filter(r => r.last_synced_at && (now - new Date(r.last_synced_at)) < 86400000).length;
    const never     = registry.filter(r => !r.last_synced_at).length;

    console.log(`  Total registry modules : ${color.bold(total)}`);
    console.log(`  Status breakdown       : ${color.green('ready: ' + ready)}  ${color.yellow('syncing: ' + syncing)}  ${color.red('failed: ' + failed)}  pending: ${pending}`);
    console.log(`  Stale / overdue        : ${stale > 0 ? color.red('⚠ ' + stale) : color.green('✓ ' + stale)}`);
    console.log(`  Locked jobs            : ${locked}`);
    console.log(`  Synced in last hour    : ${synced1h > 0 ? color.green(synced1h) : color.yellow(synced1h + ' (cron may not have run yet)')}`);
    console.log(`  Synced in last 24h     : ${synced24h > 0 ? color.green(synced24h) : color.red(synced24h + ' — PROBLEM!')}`);
    console.log(`  Never synced           : ${never > 0 ? color.yellow(never) : color.green(never)}`);

    // ── 2. Most recently synced ─────────────────────────────────────────────
    console.log(color.cyan('\n── 2. Most Recently Synced Modules (top 8) ──────────'));
    const recentList = registry.filter(r => r.last_synced_at).slice(0, 8);
    if (recentList.length === 0) {
      console.log(color.red('  ⚠  No modules have been synced at all!'));
    } else {
      recentList.forEach(r => {
        const ms  = now - new Date(r.last_synced_at);
        const flag = ms > 86400000 ? color.red('⚠') : color.green('✓');
        console.log(`  ${flag}  ${(r.platform + '/' + r.module).padEnd(30)} [${r.client_id?.slice(0, 8)}]  ${age(r.last_synced_at)}`);
      });
    }

    // ── 3. Failed modules ───────────────────────────────────────────────────
    const failedList = registry.filter(r => r.status === 'failed');
    if (failedList.length > 0) {
      console.log(color.cyan('\n── 3. Failed Modules ────────────────────────────────'));
      failedList.forEach(r => {
        const retryIn = r.next_retry_at ? (new Date(r.next_retry_at) > now ? `retry in ${age(r.next_retry_at).replace(' ago','')}` : 'retry overdue') : 'no retry scheduled';
        console.log(`  ${color.red('✗')}  ${(r.platform + '/' + r.module).padEnd(30)} [${r.client_id?.slice(0, 8)}]  ${retryIn}`);
        if (r.last_error) console.log(`       ${color.red('Error:')} ${r.last_error.slice(0, 100)}`);
      });
    } else {
      console.log(color.cyan('\n── 3. Failed Modules ────────────────────────────────'));
      console.log(color.green('  ✓  No failed modules!'));
    }

    // ── 4. Stale / overdue modules ──────────────────────────────────────────
    const staleList = registry.filter(r =>
      r.stale_after_at &&
      new Date(r.stale_after_at) < now &&
      !['syncing', 'failed'].includes(r.status)
    );
    console.log(color.cyan('\n── 4. Stale (Overdue) Modules ───────────────────────'));
    if (staleList.length === 0) {
      console.log(color.green('  ✓  No overdue modules — cron is keeping up!'));
    } else {
      staleList.slice(0, 12).forEach(r => {
        console.log(`  ${color.yellow('⚑')}  ${(r.platform + '/' + r.module).padEnd(30)} [${r.client_id?.slice(0, 8)}]  stale since ${age(r.stale_after_at)}`);
      });
      if (staleList.length > 12) console.log(`  ... and ${staleList.length - 12} more`);
    }

    // ── 5. Per-client summary ───────────────────────────────────────────────
    console.log(color.cyan('\n── 5. Per-Client Sync Summary ───────────────────────'));
    const byClient = {};
    for (const r of registry) {
      if (!byClient[r.client_id]) byClient[r.client_id] = { total: 0, synced24h: 0, failed: 0, stale: 0 };
      byClient[r.client_id].total++;
      if (r.last_synced_at && (now - new Date(r.last_synced_at)) < 86400000) byClient[r.client_id].synced24h++;
      if (r.status === 'failed') byClient[r.client_id].failed++;
      if (r.stale_after_at && new Date(r.stale_after_at) < now && r.status !== 'syncing') byClient[r.client_id].stale++;
    }
    for (const [cid, s] of Object.entries(byClient)) {
      const health = s.failed > 0 ? color.red('✗ FAIL') : s.stale > 0 ? color.yellow('⚑ STALE') : color.green('✓ OK');
      console.log(`  ${health}  client ${cid?.slice(0,8)}  modules: ${s.total}  synced24h: ${s.synced24h}  failed: ${s.failed}  stale: ${s.stale}`);
    }

  } catch (e) {
    if (e.status === 401) {
      console.log(color.red(`  ⚠  RLS is blocking anonymous reads on sync_state_registry (401 Unauthorized).`));
      console.log(color.yellow(`  → This is expected for security. Use the Supabase Dashboard SQL editor instead:`));
      console.log(`      SELECT platform, module, status, last_synced_at, stale_after_at, last_error`);
      console.log(`      FROM sync_state_registry ORDER BY last_synced_at DESC NULLS LAST;`);
    } else {
      console.log(color.red(`  Error: ${e.message}`));
    }
  }

  // ── 6. Cron dispatcher — live invocation ────────────────────────────────
  console.log(color.cyan('\n── 6. Live Dispatcher Invocation (cron-sync-dispatcher) ──'));
  const { ok, status, data } = await invokeFunction('cron-sync-dispatcher');
  if (ok && data.success) {
    const isActive = data.dispatched > 0;
    console.log(color.green(`  ✓  Dispatcher responded successfully`));
    console.log(`     Dispatched : ${data.dispatched > 0 ? color.green(data.dispatched) : color.yellow(data.dispatched)}`);
    console.log(`     Failed     : ${data.failed > 0 ? color.red(data.failed) : color.green(data.failed)}`);
    if (data.dispatched === 0) {
      console.log(color.yellow(`     ℹ  0 dispatched means no modules were stale/eligible right now. That's OK if sync ran recently.`));
    }
    if (data.details?.failed?.length > 0) {
      data.details.failed.slice(0, 5).forEach(f => {
        console.log(color.red(`     ✗  ${f.platform}/${f.module}: ${f.error}`));
      });
    }
    if (data.details?.dispatched?.length > 0) {
      console.log(`     Sample dispatched modules:`);
      data.details.dispatched.slice(0, 5).forEach(d => {
        console.log(`       → ${d.platform}/${d.module} [${d.client_id?.slice(0,8)}]`);
      });
    }
  } else {
    console.log(color.red(`  ✗  Dispatcher returned ${status}: ${JSON.stringify(data).slice(0,200)}`));
  }

  // ── 7. Check send-reminders edge function ────────────────────────────────
  console.log(color.cyan('\n── 7. Check send-reminders (Onboarding Reminders Cron) ──'));
  try {
    const remRes = await fetch(`${SUPABASE_URL}/functions/v1/send-reminders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{"dry_run": true}',
    });
    const remData = await remRes.json().catch(() => ({}));
    if (remRes.ok) {
      console.log(color.green(`  ✓  send-reminders responded: ${JSON.stringify(remData).slice(0, 200)}`));
    } else if (remRes.status === 404) {
      console.log(color.yellow(`  ℹ  send-reminders function not deployed yet (404)`));
    } else {
      console.log(color.red(`  ✗  send-reminders returned ${remRes.status}: ${JSON.stringify(remData).slice(0, 200)}`));
    }
  } catch (e) {
    console.log(color.yellow(`  ℹ  Could not reach send-reminders: ${e.message}`));
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log(color.bold('\n══════════════════════════════════════════════════════'));
  console.log(color.bold('  ℹ  To inspect pg_cron job history directly, run in'));
  console.log(color.bold('     Supabase SQL Editor:'));
  console.log(`       SELECT jobname, schedule, active, next_run`);
  console.log(`       FROM cron.job ORDER BY jobname;`);
  console.log(`\n       SELECT jobname, start_time, end_time, status, return_message`);
  console.log(`       FROM cron.job_run_details`);
  console.log(`       ORDER BY start_time DESC LIMIT 20;`);
  console.log(color.bold('══════════════════════════════════════════════════════\n'));
}

main().catch(err => {
  console.error('\x1b[31mFatal:\x1b[0m', err);
  process.exit(1);
});
