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
  
  const periodStartStr = "2026-04-22";
  
  const fallbackContent = await fetchSupabase(
      'social_content',
      `select=platform,published_at,social_content_metrics(views,impressions,likes,comments,shares,collected_at)&client_id=eq.${clientId}&published_at=gte.${periodStartStr}&limit=2000`
  );
  
  console.log("Fallback content count:", fallbackContent.length);
  
  const posts = (fallbackContent || []).map(post => ({
      platform: post.platform,
      published_at: post.published_at,
      metrics: post.social_content_metrics || []
  }));

  let totalViews = 0;
  let totalEngagements = 0;
  const pMap = {};

  posts.forEach(post => {
      if (!post.metrics || post.metrics.length === 0) return;

      const sortedMetrics = [...post.metrics].sort((a, b) => {
          return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
      });

      const m = sortedMetrics[0];
      const postViews = Math.max(m.views || 0, m.impressions || 0);
      const postEngagements = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);

      const plat = post.platform || "unknown";
      if (!pMap[plat]) pMap[plat] = { views: 0, engagements: 0 };

      pMap[plat].views += postViews;
      pMap[plat].engagements += postEngagements;
  });

  Object.keys(pMap).forEach(plat => {
      totalViews += pMap[plat].views;
      totalEngagements += pMap[plat].engagements;
  });

  console.log("Fallback Total Views:", totalViews);
  console.log("Fallback Total Engagements:", totalEngagements);
  console.log("Fallback Platform map:", pMap);
}
run();
