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
  const clients = await fetchSupabase('clients', 'name=ilike.*Serenity*Scrolls*&select=id,name');
  console.log("Client:", clients[0]);
  if (!clients[0]) return;
  const clientId = clients[0].id;
  
  // 1. Check social_account_metrics
  const accMetrics = await fetchSupabase('social_account_metrics', `client_id=eq.${clientId}&order=collected_at.desc.nullslast&limit=10`);
  console.log("Account metrics (latest):", JSON.stringify(accMetrics, null, 2));
  
  // 2. Check social_follower_timeline
  const timeline = await fetchSupabase('social_follower_timeline', `client_id=eq.${clientId}&order=measured_at.desc.nullslast&limit=10`);
  console.log("Follower timeline (latest):", JSON.stringify(timeline, null, 2));

}

run();
