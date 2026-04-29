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
  const clientId = "22090989-2d0e-47b2-b9c5-98652d7f0957"; // PlayIQ
  
  const accountMetrics = await fetchSupabase(
      'social_account_metrics',
      `client_id=eq.${clientId}&order=collected_at.desc.nullslast&limit=10`
  );
  console.log("Account metrics recent:", accountMetrics);
}
run();
