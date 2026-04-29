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
  const clients = await fetchSupabase('clients', 'name=ilike.*PlayIQ*&select=id,name');
  if (!clients[0]) {
      console.log("PlayIQ not found");
      return;
  }
  const clientId = clients[0].id;
  console.log("PlayIQ ID:", clientId);
  
  const periodStartStr = "2026-04-22";
  const periodEndStr = "2026-04-29";
  
  // 1. Check AI summary data to see what it saw
  const summaries = await fetchSupabase(
      'analytics_summaries',
      `client_id=eq.${clientId}&type=eq.social&order=generated_at.desc.nullslast&limit=1&select=summary_data,generated_at`
  );
  console.log("Latest AI Summary generated at:", summaries[0]?.generated_at);
  console.log("AI Summary metrics:", summaries[0]?.summary_data?.metrics);
  
  // 2. Check social_content_metrics with period_end in last 7 days
  const metricsRaw = await fetchSupabase(
      'social_content_metrics',
      `period_end=gte.${periodStartStr}&period_end=lte.${periodEndStr}&select=id,views,engagements,platform,social_content!inner(client_id)&social_content.client_id=eq.${clientId}`
  );
  console.log("social_content_metrics matching query in useSummaryMetrics:", metricsRaw.length);
  if (metricsRaw.length > 0) {
      console.log("Sample metric:", metricsRaw[0]);
  }
  
  // 3. Fallback query inside useSummaryMetrics
  const fallbackContent = await fetchSupabase(
      'social_content',
      `client_id=eq.${clientId}&published_at=gte.${periodStartStr}&select=id,platform,published_at,social_content_metrics(views,engagements)`
  );
  console.log("social_content matching fallback query in useSummaryMetrics (published recently):", fallbackContent.length);
  
  // 4. Look at social_account_metrics to see if engagement_rate comes from there
  const accountMetrics = await fetchSupabase(
      'social_account_metrics',
      `client_id=eq.${clientId}&collected_at=gte.${periodStartStr}&order=collected_at.desc.nullslast&limit=5&select=platform,followers,new_followers,engagement_rate,total_content,collected_at`
  );
  console.log("Recent account metrics:", accountMetrics);
}

run();
