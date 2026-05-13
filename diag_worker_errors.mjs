/**
 * diag_worker_errors.mjs
 * Invokes each failing sync worker directly and captures the real error response.
 * Reads the service key from Supabase vault via the already-linked CLI session.
 * Usage: node diag_worker_errors.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
// Use anon key to retrieve vault secret via RPC (service key is in vault)
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

// Test client: 95791e88 (has 3 retries on facebook/meta — most data)
const TEST_CLIENT = '95791e88-87cd-4621-af7e-df46f5ad93ac';

const color = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ── Get service key from vault via CLI ───────────────────────────────────────
function getServiceKeyFromCLI() {
  try {
    const result = execSync(
      `npx supabase db query --linked "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;"`,
      { encoding: 'utf8', cwd: process.cwd(), timeout: 30000 }
    );
    const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}');
    const secret = parsed?.rows?.[0]?.decrypted_secret;
    if (secret) {
      console.log(color.green('  ✓ Retrieved service_role_key from vault'));
      return secret;
    }
  } catch (e) {
    console.log(color.yellow(`  ⚠ vault query failed: ${e.message?.slice(0, 100)}`));
  }
  return null;
}

// ── Invoke a function and get full response ──────────────────────────────────
async function invoke(fnName, body, serviceKey) {
  const key = serviceKey || ANON_KEY;
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, elapsed, data };
  } catch (e) {
    return { ok: false, status: 0, elapsed: Date.now() - start, data: e.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(color.bold('\n══════════════════════════════════════════════════════'));
  console.log(color.bold('  🔬 Worker Error Diagnostics — Sienvi Agency'));
  console.log(color.bold(`  Test client: ${TEST_CLIENT}`));
  console.log(color.bold('══════════════════════════════════════════════════════\n'));

  // Step 1: Get the correct service key
  console.log(color.cyan('── Getting service key from vault ────────────────────'));
  let serviceKey = getServiceKeyFromCLI();
  if (!serviceKey) {
    console.log(color.yellow('  Falling back to anon key (some functions may return 401)'));
  }

  const key = serviceKey || ANON_KEY;

  // Step 2: Define all workers to test
  const tests = [
    {
      label: 'sync-meta (instagram/facebook)',
      fn: 'sync-meta',
      body: { clientId: TEST_CLIENT },
    },
    {
      label: 'sync-metricool (social/linkedin)',
      fn: 'sync-metricool',
      body: { clientId: TEST_CLIENT, platform: 'social' },
    },
    {
      label: 'sync-lms',
      fn: 'sync-lms',
      body: { clientId: TEST_CLIENT },
    },
    {
      label: 'sync-ubersuggest (seo)',
      fn: 'sync-ubersuggest',
      body: { clientId: TEST_CLIENT },
    },
    {
      label: 'shopify-analytics',
      fn: 'shopify-analytics',
      body: { clientId: TEST_CLIENT, endpoint: 'sync' },
    },
    {
      label: 'sync-x',
      fn: 'sync-x',
      body: { clientId: TEST_CLIENT },
    },
    {
      label: 'generate-analytics-summary (social)',
      fn: 'generate-analytics-summary',
      body: { clientId: TEST_CLIENT, type: 'social' },
    },
  ];

  console.log(color.cyan('\n── Invoking each worker ──────────────────────────────'));
  const results = [];

  for (const test of tests) {
    process.stdout.write(`  Testing ${color.bold(test.label)}... `);
    const result = await invoke(test.fn, test.body, serviceKey);
    results.push({ ...test, ...result });

    if (result.ok) {
      console.log(color.green(`✓ ${result.status} (${result.elapsed}ms)`));
    } else {
      console.log(color.red(`✗ HTTP ${result.status} (${result.elapsed}ms)`));
    }
  }

  // Step 3: Print detailed results for failed workers
  console.log(color.cyan('\n── Detailed Error Report ─────────────────────────────'));
  for (const r of results) {
    if (!r.ok) {
      console.log(`\n  ${color.red('✗')} ${color.bold(r.label)}`);
      console.log(`     Status  : ${color.red(r.status)}`);
      const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
      // Print up to 600 chars of the error body
      const trimmed = body.length > 600 ? body.slice(0, 600) + '\n     ...(truncated)' : body;
      console.log(`     Response: ${color.red(trimmed)}`);
    } else {
      console.log(`\n  ${color.green('✓')} ${color.bold(r.label)}`);
      const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
      console.log(`     ${color.dim(body.slice(0, 300))}`);
    }
  }

  // Step 4: Summary
  const failed = results.filter(r => !r.ok);
  const ok = results.filter(r => r.ok);
  console.log(color.bold('\n── Summary ───────────────────────────────────────────'));
  console.log(`  ${color.green('Passed:')} ${ok.length}/${results.length}`);
  console.log(`  ${color.red('Failed:')} ${failed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`\n  Failed functions:`);
    failed.forEach(r => console.log(`    ${color.red('✗')} ${r.fn} → HTTP ${r.status}`));
  }

  // Step 5: Save raw results to file for inspection
  fs.writeFileSync('worker_diag_results.json', JSON.stringify(results.map(r => ({
    fn: r.fn,
    status: r.status,
    ok: r.ok,
    elapsed: r.elapsed,
    response: r.data,
  })), null, 2));
  console.log(color.dim('\n  Full results saved to worker_diag_results.json'));

  console.log(color.bold('\n══════════════════════════════════════════════════════\n'));
}

main().catch(e => {
  console.error('\x1b[31mFatal:\x1b[0m', e.message);
  process.exit(1);
});
