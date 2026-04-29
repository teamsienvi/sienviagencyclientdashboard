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
  if (!clients[0]) return;
  const clientId = clients[0].id;
  
  const periodStartStr = "2026-04-22";
  
  const accountMetrics = await fetchSupabase(
    'social_account_metrics', 
    `client_id=eq.${clientId}&collected_at=gte.${periodStartStr}&order=collected_at.asc.nullslast&select=platform,followers,collected_at`
  );
  
  console.log("Account metrics since", periodStartStr, ":", JSON.stringify(accountMetrics, null, 2));
  
  if (accountMetrics && accountMetrics.length > 0) {
      const byPlatform = {};
      accountMetrics.forEach((m) => {
          if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
          byPlatform[m.platform].push(m);
      });
      
      let totalGained = 0;
      Object.values(byPlatform).forEach((points) => {
          const platform = String(points[0].platform || "").toLowerCase();
          const validPoints = points.filter(p => p.followers != null && p.followers > 0);
          
          if (validPoints.length >= 2) {
              const first = validPoints[0].followers;
              const last = validPoints[validPoints.length - 1].followers;
              totalGained += (last - first);
              console.log(platform, "gained:", last - first, "(from", first, "to", last, ")");
          } else {
              console.log(platform, "not enough valid points:", validPoints.length);
          }
      });
      console.log("Total gained calculated:", totalGained);
  }
}

run();
