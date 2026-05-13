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
const hdrs = { 'Authorization': 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json', 'apikey': ANON_KEY };

// Stale clients from audit — these have no data in the current 7-day window
const staleClients = [
    { id: '79099b9d-0281-4a95-8076-dcff0fd128a4', name: 'BlingyBag' },
    { id: 'abba0a45-1df7-4fdf-8e05-04ae4ac92d87', name: 'Cissie Pryor Presents' },
];

console.log(`Triggering sync for stale clients (period ${periodStart} to ${periodEnd})...`);

for (const c of staleClients) {
    const { data: platforms } = await supabase
        .from('client_metricool_config')
        .select('platform')
        .eq('client_id', c.id)
        .eq('is_active', true);

    if (!platforms || platforms.length === 0) {
        console.log(`  ${c.name}: No Metricool platforms configured — skipping`);
        continue;
    }

    console.log(`\n  Syncing ${c.name} (${platforms.map(p => p.platform).join(', ')})...`);

    // Use orchestrate-sync to trigger a full sync for the client
    try {
        const r = await fetch(SUPABASE_URL + '/functions/v1/orchestrate-sync', {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify({ clientId: c.id, force: true })
        });
        const d = await r.json();
        console.log(`  ${c.name} orchestrate-sync: ${r.ok ? '✓' : '✗'} ${JSON.stringify(d).slice(0, 120)}`);
    } catch(e) {
        // Try individual platform syncs instead
        for (const p of platforms) {
            try {
                const r = await fetch(SUPABASE_URL + '/functions/v1/sync-metricool', {
                    method: 'POST',
                    headers: hdrs,
                    body: JSON.stringify({ clientId: c.id, platform: p.platform })
                });
                const d = await r.json();
                console.log(`  ${c.name} / ${p.platform}: ${r.ok ? '✓' : '✗ ' + JSON.stringify(d).slice(0, 80)}`);
            } catch (e2) {
                console.log(`  ${c.name} / ${p.platform}: ERROR ${e2.message}`);
            }
            await sleep(2000);
        }
    }
    await sleep(3000);
}

console.log('\nWaiting 5s for data to settle...');
await sleep(5000);

console.log('\nRegenerating summaries for stale clients...');
for (const c of staleClients) {
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
