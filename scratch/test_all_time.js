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
  const qs = `select=id,platform,published_at,url,title,social_content_metrics(collected_at,period_start,period_end,views,reach,impressions,likes,comments,shares,engagements)&client_id=eq.${clientId}&published_at=gte.2026-04-22&published_at=lte.2026-04-29&order=published_at.desc.nullslast&limit=5000`;
  const content = await fetchSupabase('social_content', qs);
  
  console.log("Total published content found:", content?.length);
  
  const topInsightContent = content
    .filter((c) => {
      if (!c.social_content_metrics || c.social_content_metrics.length === 0) return false;
      if (!c.published_at) return false;
      return true;
    })
    .map((c) => {
      const sortedMetrics = [...c.social_content_metrics].sort((a, b) => {
        const periodCompare = (b.period_end || "").localeCompare(a.period_end || "");
        if (periodCompare !== 0) return periodCompare;
        return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
      });
      const latestMetric = sortedMetrics[0];
      const viewsValue = latestMetric?.views || 0;
      const impressionsValue = latestMetric?.impressions || 0;
      const primaryMetric = Math.max(viewsValue, impressionsValue);

      return {
        id: c.id,
        views: primaryMetric,
      };
    })
    .filter((c) => c.views > 0);

  console.log("Posts passing views > 0 filter:", topInsightContent.length);
  if (topInsightContent.length > 0) {
      console.log("First post passing:", JSON.stringify(topInsightContent[0]));
  }
}

run();
