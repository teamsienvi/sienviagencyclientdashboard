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
  const clientId = "22090989-2d0e-47b2-b9c5-98652d7f0957";
  
  const periodStartStr = "2026-04-22";
  const periodEndStr = "2026-04-29";
  
  const metricsRaw = await fetchSupabase(
      'social_content_metrics',
      `select=id,views,engagements,platform,period_start,period_end,collected_at,social_content!inner(client_id)&social_content.client_id=eq.${clientId}&limit=10`
  );
  console.log("All metrics sample:", metricsRaw);
}

run();
