const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

async function fetchSupabase(table, params) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  if (!res.ok) {
    console.log("Error:", await res.text());
    return null;
  }
  return await res.json();
}

async function run() {
  const clients = await fetchSupabase('clients', {
    'name': 'ilike.*OxiSure*',
    'select': 'id,name'
  });
  const clientId = clients[0].id;
  
  const periodStartDate = "2026-04-22";
  const periodEndDate = "2026-04-29";

  console.log("Testing primary query from useTopPerformingPosts...");
  const metrics = await fetchSupabase('social_content_metrics', {
      'select': 'views,impressions,reach,likes,comments,shares,period_end,collected_at,platform,social_content!inner(id,client_id,platform,published_at,url,title)',
      'social_content.client_id': `eq.${clientId}`,
      'period_end': `gte.${periodStartDate}`,
      'period_end': `lte.${periodEndDate}`, // Wait! URL params will override the previous period_end!
  });
  
  console.log("Result length:", metrics?.length);
  if (metrics && metrics.length > 0) {
      console.log("First item:", JSON.stringify(metrics[0]));
  } else {
      console.log("Query returned empty!");
  }
}

run();
