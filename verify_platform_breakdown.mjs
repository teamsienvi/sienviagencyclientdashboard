/**
 * verify_platform_breakdown.mjs
 * Verify that follower counts in social_account_metrics are correctly
 * populated for all clients (Platform Breakdown in Social Media Overview).
 * Uses the correct Supabase URL + anon key pair.
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

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY     = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

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

const hdr = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

async function verifyPlatformBreakdown() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  PLATFORM BREAKDOWN VERIFICATION             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Supabase: ${SUPABASE_URL}\n`);

  let totalPlatforms = 0;
  let totalWithFollowers = 0;

  for (const client of ALL_CLIENTS) {
    // Fetch latest metrics per platform (social_account_metrics)
    const metricsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/social_account_metrics` +
      `?client_id=eq.${client.id}` +
      `&select=platform,followers,new_followers,engagement_rate,total_content,collected_at` +
      `&order=collected_at.desc&limit=30`,
      { headers: hdr }
    );
    const metrics = await metricsRes.json();

    // Fetch latest follower timeline (social_follower_timeline)
    const timelineRes = await fetch(
      `${SUPABASE_URL}/rest/v1/social_follower_timeline` +
      `?client_id=eq.${client.id}` +
      `&select=platform,date,followers` +
      `&order=date.desc&limit=30`,
      { headers: hdr }
    );
    const timeline = await timelineRes.json();

    // Fetch cached analytics summary
    const summaryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/analytics_summaries` +
      `?client_id=eq.${client.id}&type=eq.social` +
      `&select=type,period_start,period_end,generated_at,summary_data` +
      `&order=generated_at.desc&limit=1`,
      { headers: hdr }
    );
    const summaries = await summaryRes.json();

    console.log(`\n  ┌─ ${client.name} ${'─'.repeat(Math.max(0, 46 - client.name.length))}┐`);

    // --- Platform Metrics (social_account_metrics) ---
    if (!Array.isArray(metrics) || metrics.length === 0) {
      console.log(`  │  social_account_metrics : (no rows)`);
    } else {
      const seen = new Set();
      const unique = metrics.filter(r => { if (seen.has(r.platform)) return false; seen.add(r.platform); return true; });
      console.log(`  │  social_account_metrics (${unique.length} platforms):`);
      unique.forEach(r => {
        totalPlatforms++;
        const followers = r.followers != null ? r.followers.toLocaleString() : 'null';
        const newF      = r.new_followers != null ? `+${r.new_followers}` : '—';
        const eng       = r.engagement_rate != null ? `${Number(r.engagement_rate).toFixed(2)}%` : '—';
        const content   = r.total_content != null ? `${r.total_content} posts` : '—';
        const hasF      = r.followers != null;
        if (hasF) totalWithFollowers++;
        const icon = hasF ? '✓' : '⚠';
        console.log(`  │    ${icon} ${r.platform.padEnd(13)} followers=${followers.padStart(8)}  new=${newF.padStart(5)}  eng=${eng.padStart(7)}  ${content}`);
      });
    }

    // --- Follower Timeline ---
    if (!Array.isArray(timeline) || timeline.length === 0) {
      console.log(`  │  social_follower_timeline: (no rows)`);
    } else {
      const byPlatform = {};
      timeline.forEach(r => {
        if (!byPlatform[r.platform]) byPlatform[r.platform] = [];
        byPlatform[r.platform].push(r);
      });
      console.log(`  │  social_follower_timeline (${Object.keys(byPlatform).length} platforms, latest date per):`);
      Object.entries(byPlatform).forEach(([plat, rows]) => {
        const latest = rows[0];
        console.log(`  │    • ${plat.padEnd(13)} date=${latest.date}  followers=${latest.followers}`);
      });
    }

    // --- Analytics Summary ---
    if (!Array.isArray(summaries) || summaries.length === 0) {
      console.log(`  │  analytics_summaries     : (no social summary cached)`);
    } else {
      const s = summaries[0];
      const topPlatform = s.summary_data?.metrics?.top_platform || '—';
      const followersGained = s.summary_data?.metrics?.followers_gained ?? '—';
      const engRate = s.summary_data?.metrics?.engagement_rate ?? '—';
      console.log(`  │  analytics_summaries     : generated=${s.generated_at?.split('T')[0]} period=${s.period_start}→${s.period_end}`);
      console.log(`  │    top_platform=${topPlatform}  followers_gained=${followersGained}  engagement_rate=${engRate}`);
    }

    console.log(`  └${'─'.repeat(50)}┘`);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  SUMMARY:`);
  console.log(`    Total platform rows : ${totalPlatforms}`);
  console.log(`    With follower counts: ${totalWithFollowers}`);
  console.log(`    Coverage            : ${totalPlatforms > 0 ? Math.round(totalWithFollowers/totalPlatforms*100) : 0}%`);
  console.log('═══════════════════════════════════════════════');
}

verifyPlatformBreakdown().catch(e => { console.error('Fatal:', e); process.exit(1); });
