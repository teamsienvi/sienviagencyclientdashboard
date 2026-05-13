import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';
const supabase = createClient(SUPABASE_URL, ANON_KEY);
const hdrs = { 'Authorization': 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json', 'apikey': ANON_KEY };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const now = new Date();
const start = new Date(now); start.setDate(start.getDate() - 7);
const periodStart = start.toISOString().split('T')[0];
const periodEnd = now.toISOString().split('T')[0];

console.log(`=== Full Client Data Audit: ${periodStart} → ${periodEnd} ===\n`);

const { data: clients } = await supabase.from('clients').select('id, name').eq('is_active', true).order('name');
const needsSync = [];

for (const c of clients) {
    const { data: periodMetrics } = await supabase
        .from('social_content_metrics')
        .select('id, platform, social_content!inner(client_id)')
        .eq('social_content.client_id', c.id)
        .or(`collected_at.gte.${periodStart},period_end.gte.${periodStart}`)
        .lte('period_end', periodEnd)
        .limit(5);

    const { data: lastSync } = await supabase
        .from('social_content_metrics')
        .select('collected_at, period_end, social_content!inner(client_id)')
        .eq('social_content.client_id', c.id)
        .order('collected_at', { ascending: false })
        .limit(1);

    const lastSyncDate = lastSync?.[0]?.collected_at ? lastSync[0].collected_at.split('T')[0] : 'NEVER';
    const hasData = periodMetrics && periodMetrics.length > 0;
    const status = hasData ? ' ✓' : ' ✗ NEEDS SYNC';
    console.log(`${status} ${c.name.padEnd(28)} | Last sync: ${lastSyncDate} | In-window rows: ${periodMetrics?.length || 0}`);
    
    if (!hasData) needsSync.push(c);
}

if (needsSync.length === 0) {
    console.log('\n✅ All clients have data in the current period!');
} else {
    console.log(`\n⚠️  ${needsSync.length} clients still need sync: ${needsSync.map(c => c.name).join(', ')}`);
    console.log('\nNote: Some clients (Ban Batu, BSUE, Hwabelle, Luxxe, PlayIQ, Cissie Pryor) may have');
    console.log('no Metricool connection configured — check their platform credentials in admin settings.');
}

console.log('\n=== Regenerating summaries for all clients with data ===\n');

const clientsWithData = clients.filter(c => !needsSync.find(n => n.id === c.id));
for (const c of clientsWithData) {
    const r = await fetch(SUPABASE_URL + '/functions/v1/generate-analytics-summary', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ clientId: c.id, type: 'social' })
    });
    const d = await r.json();
    const views = d.metrics?.total_views || 0;
    const topPlatform = d.metrics?.top_platform || '?';
    console.log(`${c.name.slice(0,20).padEnd(20)} ✓ Views: ${String(views).padStart(6)} | Top: ${topPlatform}`);
    await sleep(500);
}
console.log('\nDone.');
