/**
 * force_bulk_sync_all.mjs
 * ─────────────────────────────────────────────────────────────────
 * Phase 1: Force-sync every platform for every client via bulk-sync-all
 * Phase 2: Force-sync per-platform overrides via orchestrate-sync
 *          (covers YouTube, TikTok, LinkedIn, X, LMS, Shopify, SEO, Ads)
 * Phase 3: Generate Social Media Overview for every client
 * Phase 4: Generate Web & Ecommerce Overview for every client
 *
 * Followers are saved into social_account_metrics AND social_follower_timeline
 * so the Platform Breakdown in the Social Media Overview reflects correct values.
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'fs';

// ── Credentials ───────────────────────────────────────────────────
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

const SUPABASE_URL  = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY   = env['SUPABASE_SERVICE_ROLE_KEY'];
const ANON_KEY      = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SERVICE_KEY — check .env.local');
  process.exit(1);
}

// ── All clients (matched from tmp_bulk_sync.mjs + DB) ─────────────
const ALL_CLIENTS = [
  { id: 'ef580ebf-439f-4305-826a-f1f8aa89fd03', name: 'Snarky Humans'         },
  { id: 'd8a121fe-cdd9-4e19-90dc-dd32b159f973', name: 'Snarky Pets'           },
  { id: '297cbb3c-54b4-4bed-8206-25949a94fa62', name: 'Snarky A$$ Humans'     },
  { id: '95791e88-87cd-4621-af7e-df46f5ad93ac', name: 'Father Figure Formula' },
  { id: 'b6c39651-9259-4930-af6e-b744a5a191ad', name: 'The Haven At Deer Park'},
  { id: '041555a7-1a25-42b8-89c7-edc40afff861', name: 'Serenity Scrolls'      },
  { id: '22090989-2d0e-47b2-b9c5-98652d7f0957', name: 'PlayIQ'                },
  { id: '1a1edf9f-2ebe-4d40-a904-7295d5033401', name: 'OxiSure Tech'          },
  { id: 'd8f38e01-77ff-4839-ac48-54795adc9f3e', name: 'Sienvi Agency'         },
];

// ── Per-platform orchestrate-sync dispatch list ────────────────────
// (platform / module pairs the orchestrator understands)
const PLATFORM_MODULES = [
  { platform: 'social',    module: 'metricool'    },  // Instagram, Facebook via Metricool
  { platform: 'tiktok',   module: 'metricool'    },  // TikTok via Metricool
  { platform: 'youtube',  module: 'youtube'      },  // YouTube via Metricool / direct
  { platform: 'x',        module: 'x'            },  // X/Twitter
  { platform: 'linkedin', module: 'metricool'    },  // LinkedIn via Metricool
  { platform: 'ads',      module: 'metricool'    },  // Meta/TikTok ads
  { platform: 'shopify',  module: 'shopify'      },  // Shopify e-commerce
  { platform: 'lms',      module: 'lms'          },  // LMS analytics
  { platform: 'seo',      module: 'seo'          },  // Ubersuggest SEO
];

// ── Helpers ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

const hdr = (useService = true) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${useService ? SERVICE_KEY : ANON_KEY}`,
});

async function callFn(fnName, body, label, useService = true) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: hdr(useService),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }

    const status = data.status || data.error || (data.success === false ? 'failed' : 'ok');
    console.log(`    [${label}] HTTP ${res.status} → ${JSON.stringify(status)}`);
    return { ok: res.ok, data };
  } catch (e) {
    console.error(`    [${label}] FETCH ERROR: ${e.message}`);
    return { ok: false, data: { error: e.message } };
  }
}

// Force-reset a stuck registry row before dispatching
async function forceResetRegistry(clientId, platform, module) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/sync_state_registry` +
      `?client_id=eq.${clientId}&platform=eq.${platform}&module=eq.${module}`,
      {
        method: 'PATCH',
        headers: {
          ...hdr(true),
          apikey: SERVICE_KEY,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'idle',
          job_locked_until: null,
          retry_count: 0,
          error_message: null,
          next_retry_at: null,
        }),
      }
    );
  } catch (_) { /* ignore */ }
}

// ── PHASE 1: bulk-sync-all (Metricool social platforms + follower timeline) ──
async function phase1BulkSyncAll() {
  console.log('\n════════════════════════════════════════');
  console.log('  PHASE 1 — bulk-sync-all (all active Metricool configs)');
  console.log('════════════════════════════════════════');

  const { ok, data } = await callFn('bulk-sync-all', {}, 'bulk-sync-all', true);

  if (ok && data.successCount !== undefined) {
    console.log(`\n  ✓ bulk-sync-all complete:`);
    console.log(`    Period : ${data.period?.from} → ${data.period?.to}`);
    console.log(`    Configs: ${data.totalConfigs}`);
    console.log(`    Success: ${data.successCount}   Failed: ${data.failCount}`);
    if (data.results) {
      data.results.forEach(r => {
        const icon = r.success ? '✓' : '✗';
        const detail = r.success
          ? `followers=${r.data?.followers ?? '?'} new=${r.data?.newFollowers ?? '?'} eng=${r.data?.engagementRate?.toFixed(1) ?? '?'}%`
          : `ERROR: ${r.error}`;
        console.log(`    ${icon} ${r.clientName} / ${r.platform}: ${detail}`);
      });
    }
  } else {
    console.warn('  ⚠ bulk-sync-all returned unexpected response:', JSON.stringify(data).slice(0, 500));
  }

  await sleep(3000); // Let DB writes settle
}

// ── PHASE 2: Per-platform orchestrate-sync for every client ────────
async function phase2PerPlatformSync() {
  console.log('\n════════════════════════════════════════');
  console.log('  PHASE 2 — orchestrate-sync per platform per client');
  console.log('════════════════════════════════════════');

  for (const client of ALL_CLIENTS) {
    console.log(`\n  ── ${client.name} ──`);

    for (const { platform, module } of PLATFORM_MODULES) {
      // Force-reset registry so forceRetry is honoured even if previously maxed
      await forceResetRegistry(client.id, platform, module);

      await callFn(
        'orchestrate-sync',
        { clientId: client.id, platform, module, forceRetry: true },
        `${client.name} / ${platform}/${module}`,
        true
      );

      await sleep(350); // avoid hammering
    }
  }

  // Let background workers run
  console.log('\n  ⏳ Waiting 15 s for background workers to complete...');
  await sleep(15000);
}

// ── PHASE 3: Generate Social Media Overview for every client ───────
async function phase3SocialOverview() {
  console.log('\n════════════════════════════════════════');
  console.log('  PHASE 3 — generate Social Media Overview (all clients)');
  console.log('════════════════════════════════════════');

  for (const client of ALL_CLIENTS) {
    console.log(`\n  ${client.name}:`);
    await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'social', dateRange: '7d' },
      `${client.name} / social-summary`,
      true
    );
    await sleep(1200);
  }
}

// ── PHASE 4: Generate Web & Ecommerce Overview for every client ────
async function phase4WebEcommerceOverview() {
  console.log('\n════════════════════════════════════════');
  console.log('  PHASE 4 — generate Web & Ecommerce Overview (all clients)');
  console.log('════════════════════════════════════════');

  for (const client of ALL_CLIENTS) {
    console.log(`\n  ${client.name}:`);

    // Website (GA4 / Substack)
    await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'website', dateRange: '7d' },
      `${client.name} / website-summary`,
      true
    );
    await sleep(800);

    // Ads (for clients that have ad configs)
    await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'ads', dateRange: '7d' },
      `${client.name} / ads-summary`,
      true
    );
    await sleep(800);
  }
}

// ── PHASE 5: Verify platform breakdown in social_account_metrics ───
async function phase5VerifyPlatformBreakdown() {
  console.log('\n════════════════════════════════════════');
  console.log('  PHASE 5 — verify platform breakdown follower counts');
  console.log('════════════════════════════════════════');

  for (const client of ALL_CLIENTS) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/social_account_metrics` +
        `?client_id=eq.${client.id}&select=platform,followers,new_followers,engagement_rate,collected_at` +
        `&order=collected_at.desc&limit=20`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = await res.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`  ${client.name}: no platform metrics yet`);
        continue;
      }

      // Deduplicate: keep latest per platform
      const seen = new Set();
      const unique = rows.filter(r => { if (seen.has(r.platform)) return false; seen.add(r.platform); return true; });

      console.log(`\n  ${client.name} platform breakdown:`);
      unique.forEach(r => {
        const followers = r.followers != null ? r.followers.toLocaleString() : '—';
        const newF      = r.new_followers != null ? `+${r.new_followers}` : '—';
        const eng       = r.engagement_rate != null ? `${Number(r.engagement_rate).toFixed(2)}%` : '—';
        console.log(`    ${r.platform.padEnd(12)} followers=${followers.padStart(8)}  new=${newF.padStart(5)}  eng=${eng}`);
      });
    } catch (e) {
      console.error(`  ${client.name} verify error: ${e.message}`);
    }
  }
}

// ── Run ────────────────────────────────────────────────────────────
async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  FORCE BULK SYNC — ALL PLATFORMS ALL CLIENTS ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Clients : ${ALL_CLIENTS.length}`);
  console.log(`  Started : ${new Date().toISOString()}`);

  await phase1BulkSyncAll();
  await phase2PerPlatformSync();
  await phase3SocialOverview();
  await phase4WebEcommerceOverview();
  await phase5VerifyPlatformBreakdown();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  ALL DONE                                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log('  Social Media Overview and Web/Ecommerce Overview have been');
  console.log('  regenerated. Follower counts in Platform Breakdown now reflect');
  console.log('  the latest synced values from social_account_metrics.');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
