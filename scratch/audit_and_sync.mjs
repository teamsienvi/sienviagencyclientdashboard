import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';
const supabase = createClient(SUPABASE_URL, ANON_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const now = new Date();
const start = new Date(now);
start.setDate(start.getDate() - 7);
const periodStart = start.toISOString().split('T')[0];
const periodEnd = now.toISOString().split('T')[0];

console.log(`Auditing clients for period: ${periodStart} to ${periodEnd}`);

const { data: clients } = await supabase.from('clients').select('id, name').eq('is_active', true).order('name');
const hdrs = { 'Authorization': 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json', 'apikey': ANON_KEY };

const needsSync = [];

for (const c of clients) {
    // Check if there's any metric data within the current 7-day window
    const { data: periodMetrics } = await supabase
        .from('social_content_metrics')
        .select('id, collected_at, period_end, social_content!inner(client_id)')
        .eq('social_content.client_id', c.id)
        .or(`collected_at.gte.${periodStart},period_end.gte.${periodStart}`)
        .lte('period_end', periodEnd)
        .limit(1);

    const hasData = periodMetrics && periodMetrics.length > 0;

    // Get last sync date regardless
    const { data: lastSync } = await supabase
        .from('social_content_metrics')
        .select('collected_at, period_end, platform, social_content!inner(client_id)')
        .eq('social_content.client_id', c.id)
        .order('collected_at', { ascending: false })
        .limit(1);

    const lastSyncDate = lastSync?.[0]?.collected_at ? lastSync[0].collected_at.split('T')[0] : 'NEVER';
    const lastPeriodEnd = lastSync?.[0]?.period_end || 'NEVER';
    
    if (!hasData) {
        console.log(`NEEDS SYNC: ${c.name.padEnd(25)} | Last collected_at: ${lastSyncDate} | Last period_end: ${lastPeriodEnd}`);
        needsSync.push(c);
    } else {
        console.log(`     OK:    ${c.name.padEnd(25)} | Last collected_at: ${lastSyncDate}`);
    }
}

if (needsSync.length === 0) {
    console.log('\nAll clients have data in the current period!');
    process.exit(0);
}

console.log(`\n${needsSync.length} clients need a fresh sync. Triggering Metricool sync...`);

for (const c of needsSync) {
    // Get what platforms are configured for this client
    const { data: platforms } = await supabase
        .from('client_metricool_config')
        .select('platform')
        .eq('client_id', c.id)
        .eq('is_active', true);

    if (!platforms || platforms.length === 0) {
        console.log(`  ${c.name}: No Metricool platforms configured — skipping`);
        continue;
    }

    for (const p of platforms) {
        try {
            const r = await fetch(SUPABASE_URL + '/functions/v1/metricool-sync', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ clientId: c.id, platform: p.platform })
            });
            const d = await r.json();
            const ok = r.ok && !d.error;
            console.log(`  ${c.name} / ${p.platform}: ${ok ? '✓' : '✗ ' + JSON.stringify(d).slice(0, 80)}`);
        } catch (e) {
            console.log(`  ${c.name} / ${p.platform}: ERROR ${e.message}`);
        }
        await sleep(1000);
    }
}

console.log('\nSync complete. Regenerating summaries for synced clients...');
await sleep(3000); // Wait a bit for data to settle

for (const c of needsSync) {
    for (const type of ['social']) {
        const r = await fetch(SUPABASE_URL + '/functions/v1/generate-analytics-summary', {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify({ clientId: c.id, type })
        });
        const d = await r.json();
        console.log(`${c.name.slice(0,20).padEnd(20)} ${type} ${r.ok ? '✓ Views: ' + (d.metrics?.total_views || 0) : '✗ ' + JSON.stringify(d).slice(0, 60)}`);
        await sleep(500);
    }
}
console.log('Done.');
