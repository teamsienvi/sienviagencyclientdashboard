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
  const periodStartDate = "2026-04-22";
  const periodEndDate = "2026-04-29";
  
  let metricsRaw = await fetchSupabase(
      'social_content_metrics',
      `select=views,impressions,reach,likes,comments,shares,period_end,collected_at,platform,social_content!inner(id,client_id,platform,published_at,url,title)&social_content.client_id=eq.${clientId}&period_end=gte.${periodStartDate}&period_end=lte.${periodEndDate}&limit=500`
  );
  
  console.log("Primary query result count:", metricsRaw?.length);
  
  if (!metricsRaw || metricsRaw.length === 0) {
      const fallbackContent = await fetchSupabase(
          'social_content',
          `select=id,client_id,platform,published_at,url,title,social_content_metrics(views,impressions,reach,likes,comments,shares,period_end,collected_at)&client_id=eq.${clientId}&published_at=gte.${periodStartDate}&published_at=lte.${periodEndDate}&order=published_at.desc.nullslast&limit=100`
      );
      console.log("Fallback query result count:", fallbackContent?.length);
      
      if (fallbackContent && fallbackContent.length > 0) {
          metricsRaw = fallbackContent.flatMap((post) => {
              if (!post.social_content_metrics || post.social_content_metrics.length === 0) {
                  return [];
              }
              const latestMetric = post.social_content_metrics.sort((a, b) => 
                  new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
              )[0];
              
              return [{
                  ...latestMetric,
                  social_content: {
                      id: post.id,
                      client_id: post.client_id,
                      platform: post.platform,
                      published_at: post.published_at,
                      url: post.url,
                      title: post.title
                  }
              }];
          });
      }
  }
  
  console.log("Metrics raw after fallback:", metricsRaw?.length);
  
  if (!metricsRaw || metricsRaw.length === 0) return [];

  const groupedByPost = {};
  metricsRaw.forEach((row) => {
    const key = row.social_content?.id;
    if (!key) return;
    const existing = groupedByPost[key];
    if (!existing || (row.period_end || "") > (existing.period_end || "")) {
      groupedByPost[key] = row;
    }
  });

  const dedupedRows = Object.values(groupedByPost);
  console.log("Deduped rows:", dedupedRows.length);
  
  const platformFollowers = {};
  
  const topInsightContent = dedupedRows
    .map((row) => {
      const content = row.social_content;
      const viewsValue = row.views || 0;
      const impressionsValue = row.impressions || 0;
      const primaryMetric = Math.max(viewsValue, impressionsValue);
      const reachValue = row.reach || 0;

      return {
        id: content.id,
        platform: content.platform,
        views: primaryMetric,
      };
    })
    .filter((c) => c.views > 0);
    
  console.log("Top insight content after filter (>0 views):", topInsightContent.length);
  console.log(topInsightContent.slice(0, 3));
}
run();
