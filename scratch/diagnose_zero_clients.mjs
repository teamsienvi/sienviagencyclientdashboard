import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';
const supabase = createClient(SUPABASE_URL, ANON_KEY);

const now = new Date();
const start = new Date(now); start.setDate(start.getDate() - 7);
const fetchStart = new Date(start); fetchStart.setDate(fetchStart.getDate() - 2);
const periodStart = start.toISOString().split('T')[0];
const periodEnd = now.toISOString().split('T')[0];
const fetchStartStr = fetchStart.toISOString().split('T')[0];

console.log(`=== Social Platform Diagnostic (${periodStart} → ${periodEnd}) ===\n`);

const { data: clients } = await supabase.from('clients').select('id, name').eq('is_active', true).order('name');

for (const c of clients) {
    // 1. Metricool config
    const { data: metricoolCfg } = await supabase
        .from('client_metricool_config')
        .select('platform, is_active')
        .eq('client_id', c.id);

    const activePlatforms = (metricoolCfg || []).filter(p => p.is_active).map(p => p.platform);
    const inactivePlatforms = (metricoolCfg || []).filter(p => !p.is_active).map(p => p.platform);

    // 2. social_content count
    const { count: contentCount } = await supabase
        .from('social_content')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', c.id);

    // 3. Metrics in window (with 2-day buffer)
    const { data: windowMetrics } = await supabase
        .from('social_content_metrics')
        .select('platform, collected_at, period_end, social_content!inner(client_id, published_at)')
        .eq('social_content.client_id', c.id)
        .or(`collected_at.gte.${fetchStartStr},period_end.gte.${fetchStartStr}`)
        .lte('period_end', periodEnd)
        .limit(200);

    // 4. Latest sync ever
    const { data: lastSync } = await supabase
        .from('social_content_metrics')
        .select('collected_at, period_end, platform, social_content!inner(client_id)')
        .eq('social_content.client_id', c.id)
        .order('collected_at', { ascending: false })
        .limit(1);

    const lastSyncDate = lastSync?.[0]?.collected_at?.split('T')[0] || 'NEVER';
    const lastPeriodEnd = lastSync?.[0]?.period_end || 'NEVER';

    // 5. Account metrics (followers)
    const { data: acctMetrics } = await supabase
        .from('social_account_metrics')
        .select('platform, followers, collected_at')
        .eq('client_id', c.id)
        .order('collected_at', { ascending: false })
        .limit(10);

    // 6. Aggregate by platform from window metrics
    const platformMap = {};
    (windowMetrics || []).forEach(row => {
        const pub = row.social_content?.published_at;
        const platform = row.platform;
        if (!platformMap[platform]) platformMap[platform] = { rows: 0, inPeriod: 0 };
        platformMap[platform].rows++;
        if (pub && pub >= periodStart) platformMap[platform].inPeriod++;
    });

    const hasWindowData = windowMetrics && windowMetrics.length > 0;
    const hasSomeData = contentCount > 0;

    if (!hasWindowData) {
        console.log(`\n❌ ${c.name}`);
        console.log(`   Posts in DB:      ${contentCount || 0}`);
        console.log(`   Last sync:        ${lastSyncDate} (period_end: ${lastPeriodEnd})`);
        console.log(`   Metricool config: ${activePlatforms.length > 0 ? activePlatforms.join(', ') : 'NONE CONFIGURED'}`);
        if (inactivePlatforms.length > 0) console.log(`   Inactive cfg:     ${inactivePlatforms.join(', ')}`);
        
        if (acctMetrics && acctMetrics.length > 0) {
            const acctStr = acctMetrics.slice(0, 5).map(a => `${a.platform}(${a.followers}f @ ${a.collected_at?.split('T')[0]})`).join(', ');
            console.log(`   Account metrics:  ${acctStr}`);
        } else {
            console.log(`   Account metrics:  NONE`);
        }

        // Diagnose root cause
        if (activePlatforms.length === 0) {
            console.log(`   ⚠️  ROOT CAUSE: No Metricool platforms configured → No sync possible`);
        } else if (contentCount === 0) {
            console.log(`   ⚠️  ROOT CAUSE: No social_content rows → Metricool sync has never run or found no posts`);
        } else if (lastSyncDate === 'NEVER') {
            console.log(`   ⚠️  ROOT CAUSE: social_content exists but metrics have never been synced`);
        } else {
            const daysSinceSync = Math.floor((now - new Date(lastSyncDate)) / (1000 * 60 * 60 * 24));
            console.log(`   ⚠️  ROOT CAUSE: Last sync was ${daysSinceSync} days ago (${lastSyncDate}) — outside 7-day window + 2-day buffer`);
        }
    }
}

console.log('\n\n=== Summary of clients WITH data ===\n');
for (const c of clients) {
    const { data: windowMetrics } = await supabase
        .from('social_content_metrics')
        .select('platform, views, impressions, collected_at, social_content!inner(client_id, published_at)')
        .eq('social_content.client_id', c.id)
        .or(`collected_at.gte.${fetchStartStr},period_end.gte.${fetchStartStr}`)
        .lte('period_end', periodEnd)
        .limit(2000);

    if (!windowMetrics || windowMetrics.length === 0) continue;

    // Dedup
    const dedup = {};
    windowMetrics.forEach(row => {
        const key = row.social_content?.id || Math.random();
        if (!dedup[key] || row.collected_at > (dedup[key]?.collected_at || '')) dedup[key] = row;
    });

    const pMap = {};
    let totalViews = 0;
    Object.values(dedup).forEach(row => {
        const pub = row.social_content?.published_at;
        if (pub && pub < periodStart) return; // published_at filter
        const p = row.platform;
        const v = Math.max(row.views || 0, row.impressions || 0);
        if (!pMap[p]) pMap[p] = 0;
        pMap[p] += v;
        totalViews += v;
    });

    const platformStr = Object.entries(pMap).map(([p, v]) => `${p}:${v}`).join(' | ');
    console.log(`✅ ${c.name.padEnd(25)} Total: ${String(totalViews).padStart(6)} | ${platformStr || 'no posts in period'}`);
}
