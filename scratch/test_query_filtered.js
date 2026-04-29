const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

async function fetchSupabase(table, paramsString) {
  const url = `${supabaseUrl}/rest/v1/${table}?${paramsString}`;
  const res = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  return await res.json();
}

async function run() {
  const clients = await fetchSupabase('clients', 'name=ilike.*OxiSure*&select=id,name');
  const clientId = clients[0].id;
  const qs = `select=views,impressions,reach,likes,comments,shares,period_end,collected_at,platform,social_content!inner(id,client_id,platform,published_at,url,title)&social_content.client_id=eq.${clientId}&period_end=gte.2026-04-22&period_end=lte.2026-04-29`;
  const metrics = await fetchSupabase('social_content_metrics', qs);
  
  const groupedByPost = {};
  metrics.forEach((row) => {
    const key = row.social_content?.id;
    if (!key) return;
    const existing = groupedByPost[key];
    if (!existing || (row.period_end || "") > (existing.period_end || "")) {
      groupedByPost[key] = row;
    }
  });
  const dedupedRows = Object.values(groupedByPost);
  const withViews = dedupedRows.filter(c => Math.max(c.views || 0, c.impressions || 0) > 0);
  
  console.log("Deduped total:", dedupedRows.length);
  console.log("With views > 0:", withViews.length);
  console.log("Items with views:", JSON.stringify(withViews, null, 2));
}

run();
