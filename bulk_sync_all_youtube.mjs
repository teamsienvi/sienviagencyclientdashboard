import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1MzcwNywiZXhwIjoyMDg3NTI5NzA3fQ.hB-L59qE7061eR_FXnZ_Uh8I5pUqD8zq9IRV9en4uRA";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function invokeFn(fnName, body) {
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ▶️ BULK YOUTUBE SYNC — ALL CLIENTS WITH YOUTUBE         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Started at: ${new Date().toISOString()}`);

  // Step 1: Run sync-youtube-bulk
  console.log('\n── Step 1: Running sync-youtube-bulk edge function ──');
  const bulkRes = await invokeFn('sync-youtube-bulk', {});
  if (bulkRes.ok) {
    console.log('✓ sync-youtube-bulk finished:', JSON.stringify(bulkRes.data).slice(0, 300));
  } else {
    console.log('⚠ sync-youtube-bulk notice:', bulkRes.error);
  }

  // Step 2: Fetch all clients with YouTube integrations
  const { data: clients } = await supabase.from('clients').select('id, name').eq('is_active', true).order('name');
  const { data: metricoolConfigs } = await supabase.from('client_metricool_config').select('*').eq('platform', 'youtube').eq('is_active', true);
  const { data: socialAccounts } = await supabase.from('social_accounts').select('*').eq('platform', 'youtube').eq('is_active', true);

  const ytClientMap = new Map();

  metricoolConfigs?.forEach(mc => {
    const c = clients?.find(cl => cl.id === mc.client_id);
    if (c) {
      ytClientMap.set(c.id, {
        id: c.id,
        name: c.name,
        userId: mc.user_id,
        blogId: mc.blog_id,
        channelHandle: mc.channel_handle || mc.channel_id,
        channelId: mc.channel_id
      });
    }
  });

  socialAccounts?.forEach(sa => {
    const c = clients?.find(cl => cl.id === sa.client_id);
    if (c) {
      const existing = ytClientMap.get(c.id) || { id: c.id, name: c.name };
      existing.channelHandle = existing.channelHandle || sa.account_id;
      existing.channelId = existing.channelId || (sa.account_id?.startsWith('UC') ? sa.account_id : undefined);
      existing.accountId = sa.id;
      ytClientMap.set(c.id, existing);
    }
  });

  console.log(`\nFound ${ytClientMap.size} clients with active YouTube analytics/accounts.`);

  // Step 3: Sync each client via direct YouTube API & Metricool YouTube
  console.log('\n── Step 2: Per-client YouTube Sync & Orchestration ──');

  for (const client of ytClientMap.values()) {
    console.log(`\n▶️ Client: ${client.name} (${client.id.slice(0, 8)})`);

    // A. Direct YouTube Sync via handle / channelId if available
    if (client.channelHandle || client.channelId || client.accountId) {
      process.stdout.write(`   [YouTube Data API] handle: ${client.channelHandle || client.channelId}... `);
      const ytRes = await invokeFn('sync-youtube', {
        clientId: client.id,
        channelHandle: client.channelHandle,
        channelId: client.channelId,
        accountId: client.accountId,
        resolveFromConfig: true
      });
      if (ytRes.ok) {
        console.log(`✓ OK (${ytRes.data?.subscribers ?? ytRes.data?.followers ?? 'synced'} subs)`);
      } else {
        console.log(`✗ ${ytRes.error}`);
      }
      await sleep(300);
    }

    // B. Metricool YouTube Sync if blogId available
    if (client.blogId && client.userId) {
      process.stdout.write(`   [Metricool YouTube] blog_id: ${client.blogId}... `);
      const now = new Date();
      const end = now.toISOString().split('T')[0];
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const mcRes = await invokeFn('metricool-youtube', {
        clientId: client.id,
        userId: client.userId,
        blogId: client.blogId,
        from: `${start}T00:00:00`,
        to: `${end}T23:59:59`
      });
      if (mcRes.ok) {
        console.log(`✓ OK`);
      } else {
        console.log(`✗ ${mcRes.error}`);
      }
      await sleep(300);
    }

    // C. Update sync_state_registry
    const nowIso = new Date().toISOString();
    const staleAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('sync_state_registry').upsert({
      client_id: client.id,
      platform: 'youtube',
      module: 'youtube',
      status: 'ready',
      job_locked_until: null,
      last_synced_at: nowIso,
      last_success_at: nowIso,
      stale_after_at: staleAfter,
      retry_count: 0,
      error_message: null
    }, { onConflict: "client_id,platform,module" });
  }

  // Step 4: Verification & Platform Breakdown
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   📊 YOUTUBE METRICS VERIFICATION REPORT                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  for (const client of ytClientMap.values()) {
    const { data: metrics } = await supabase
      .from('social_account_metrics')
      .select('followers, new_followers, engagement_rate, total_content, period_start, period_end, collected_at')
      .eq('client_id', client.id)
      .eq('platform', 'youtube')
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: videoCount } = await supabase
      .from('social_content')
      .select('id, views, published_at', { count: 'exact' })
      .eq('client_id', client.id)
      .eq('platform', 'youtube');

    const totalViews = (videoCount || []).reduce((sum, v) => sum + (v.views || 0), 0);
    const subStr = metrics?.followers != null ? metrics.followers.toLocaleString() : '—';
    const newStr = metrics?.new_followers != null ? `+${metrics.new_followers}` : '—';
    const engStr = metrics?.engagement_rate != null ? `${Number(metrics.engagement_rate).toFixed(2)}%` : '—';
    const vCount = videoCount?.length ?? 0;

    console.log(`\n  ${client.name.padEnd(26)} Subscribers: ${subStr.padStart(6)} | Growth: ${newStr.padStart(4)} | Eng: ${engStr.padStart(7)} | Videos: ${String(vCount).padStart(4)} | Synced Views: ${totalViews.toLocaleString()}`);
  }

  console.log(`\nCompleted bulk YouTube sync at: ${new Date().toISOString()}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
