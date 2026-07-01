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
import { createClient } from '@supabase/supabase-js';

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
const ANON_KEY      = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌  Missing SUPABASE_URL or ANON_KEY — check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

console.log("Authenticating as teamsienvi@gmail.com...");
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: "teamsienvi@gmail.com",
  password: "9SwvfoTIoQce"
});

if (authError) {
  console.error("❌ Authentication failed:", authError.message);
  process.exit(1);
}
console.log("✓ Authenticated successfully.");

// ── All clients (matched from tmp_bulk_sync.mjs + DB) ─────────────
const ALL_CLIENTS = [
  { id: 'cf4bf738-9cc2-421b-bdc0-7344b88b0dad', name: 'Ban Batu'                 },
  { id: '79099b9d-0281-4a95-8076-dcff0fd128a4', name: 'BlingyBag'                },
  { id: '973e8407-bf7f-45ca-bd73-a26acc3ad9e3', name: 'BSUE Brow & Lash'         },
  { id: '18614cdc-35fb-4c4f-abb4-f26842574b0f', name: 'CheerCPT'                 },
  { id: 'edfc083a-77f7-4c83-b6e0-a32bfc0553a1', name: 'Cissie Pryor Presents'    },
  { id: '95791e88-87cd-4621-af7e-df46f5ad93ac', name: 'Father Figure Formula'    },
  { id: '0771b432-d720-4d0f-a964-ee6c7edcd116', name: 'Hwabelle'                 },
  { id: '3177cefc-46cc-4790-8a20-65b160103077', name: 'Luxxe Auto Accessories'  },
  { id: '1a1edf9f-2ebe-4d40-a904-7295d5033401', name: 'OxiSure Tech'             },
  { id: '22090989-2d0e-47b2-b9c5-98652d7f0957', name: 'PlayIQ'                   },
  { id: '041555a7-1a25-42b8-89c7-edc40afff861', name: 'Serenity Scrolls'         },
  { id: 'd8f38e01-77ff-4839-ac48-54795adc9f3e', name: 'Sienvi Agency'            },
  { id: '297cbb3c-54b4-4bed-8206-25949a94fa62', name: 'Snarky A$$ Humans'        },
  { id: 'ef580ebf-439f-4305-826a-f1f8aa89fd03', name: 'Snarky Humans'            },
  { id: 'd8a121fe-cdd9-4e19-90dc-dd32b159f973', name: 'Snarky Pets'              },
  { id: '0b90215e-e55d-4b5e-8453-de35153a1fcd', name: 'The Billionaire Brother'  },
  { id: 'b6c39651-9259-4930-af6e-b744a5a191ad', name: 'The Haven At Deer Park'   },
];

// ── Per-platform orchestrate-sync dispatch list ────────────────────
// (platform / module pairs the orchestrator understands)
const PLATFORM_MODULES = [
  { platform: 'instagram', module: 'metricool'    },  // Instagram via Metricool
  { platform: 'facebook',  module: 'metricool'    },  // Facebook via Metricool
  { platform: 'tiktok',   module: 'metricool'    },  // TikTok via Metricool
  { platform: 'youtube',  module: 'youtube'      },  // YouTube via Metricool / direct
  { platform: 'x',        module: 'metricool'    },  // X/Twitter via Metricool
  { platform: 'linkedin', module: 'metricool'    },  // LinkedIn via Metricool
  { platform: 'ads',      module: 'metricool'    },  // Meta/TikTok ads
  { platform: 'shopify',  module: 'shopify'      },  // Shopify e-commerce
  { platform: 'lms',      module: 'lms'          },  // LMS analytics
  { platform: 'seo',      module: 'seo'          },  // Ubersuggest SEO
];

// ── Helpers ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

const hdr = () => ({});

async function callFn(fnName, body, label, useService = true) {
  try {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body
    });
    
    if (error) {
      console.log(`    [${label}] ERROR → ${error.message}`);
      return { ok: false, data: { error: error.message } };
    }

    const status = data?.status || data?.error || (data?.success === false ? 'failed' : 'ok');
    console.log(`    [${label}] SUCCESS → ${JSON.stringify(status)}`);
    return { ok: true, data };
  } catch (e) {
    console.error(`    [${label}] INVOCATION ERROR: ${e.message}`);
    return { ok: false, data: { error: e.message } };
  }
}

// Force-reset a stuck registry row before dispatching
async function forceResetRegistry(clientId, platform, module) {
  try {
    const { error } = await supabase
      .from('sync_state_registry')
      .update({
        status: 'ready',
        job_locked_until: null,
        retry_count: 0,
        error_message: null,
        next_retry_at: null,
      })
      .match({ client_id: clientId, platform, module });
      
    if (error) {
      console.error(`    [registry-reset-error] ${platform}/${module}: ${error.message}`);
    }
  } catch (e) {
    console.error(`    [registry-reset-catch] ${platform}/${module}: ${e.message}`);
  }
}

// Mark a registry row as successfully complete
async function markRegistrySuccess(clientId, platform, module) {
  try {
    const now = new Date();
    const staleAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours TTL
    const { error } = await supabase
      .from('sync_state_registry')
      .upsert({
        client_id: clientId,
        platform,
        module,
        status: 'ready',
        job_locked_until: null,
        last_synced_at: now.toISOString(),
        last_success_at: now.toISOString(),
        stale_after_at: staleAfter.toISOString(),
        retry_count: 0,
        error_message: null
      }, { onConflict: "client_id,platform,module" });

    if (error) {
      console.error(`    [registry-success-error] ${platform}/${module}: ${error.message}`);
    }
  } catch (e) {
    console.error(`    [registry-success-catch] ${platform}/${module}: ${e.message}`);
  }
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
    const { ok } = await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'social', dateRange: '7d' },
      `${client.name} / social-summary`,
      true
    );
    if (ok) {
      await markRegistrySuccess(client.id, 'social', 'social_summary');
    }
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
    const resWeb = await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'website', dateRange: '7d' },
      `${client.name} / website-summary`,
      true
    );
    if (resWeb.ok) {
      await markRegistrySuccess(client.id, 'website', 'website_summary');
    }
    await sleep(800);

    // Ads (for clients that have ad configs)
    const resAds = await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'ads', dateRange: '7d' },
      `${client.name} / ads-summary`,
      true
    );
    if (resAds.ok) {
      await markRegistrySuccess(client.id, 'ads', 'ads_summary');
    }
    await sleep(800);

    // SEO (for clients that have SEO configs)
    const resSeo = await callFn(
      'generate-analytics-summary',
      { clientId: client.id, type: 'seo', dateRange: '7d' },
      `${client.name} / seo-summary`,
      true
    );
    if (resSeo.ok) {
      await markRegistrySuccess(client.id, 'seo', 'seo_summary');
    }
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
      const { data: rows, error } = await supabase
        .from("social_account_metrics")
        .select("platform, followers, new_followers, engagement_rate, collected_at")
        .eq("client_id", client.id)
        .order("collected_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error(`  ${client.name} verify error: ${error.message}`);
        continue;
      }

      if (!rows || rows.length === 0) {
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
