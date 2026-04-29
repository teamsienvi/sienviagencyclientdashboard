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
  return await res.json();
}

async function run() {
  const clients = await fetchSupabase('clients', {
    'name': 'ilike.*OxiSure*',
    'select': 'id,name'
  });
  console.log("Clients:", clients);
  if (!clients || clients.length === 0) return;
  const clientId = clients[0].id;

  const content = await fetchSupabase('social_content', {
    'client_id': `eq.${clientId}`,
    'order': 'published_at.desc',
    'limit': '10',
    'select': 'id,platform,published_at'
  });
  console.log("Latest content:", JSON.stringify(content, null, 2));

  if (content && content.length > 0) {
      const ids = content.map(c => c.id).join(',');
      const metrics = await fetchSupabase('social_content_metrics', {
          'social_content_id': `in.(${ids})`,
          'select': 'social_content_id,period_end,collected_at,views,impressions'
      });
      console.log("Metrics for those posts:", JSON.stringify(metrics, null, 2));
  }
}

run();
