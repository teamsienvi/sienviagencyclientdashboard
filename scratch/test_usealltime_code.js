const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  const { data: clients } = await supabase.from('clients').select('id').ilike('name', '%OxiSure%');
  const clientId = clients[0].id;
  
  const periodStart = "2026-04-22";
  const periodEnd = "2026-04-29";
  
  let query = supabase
    .from("social_content")
    .select(`
      id,
      platform,
      published_at,
      url,
      title,
      social_content_metrics (
        collected_at,
        period_start,
        period_end,
        views,
        reach,
        impressions,
        likes,
        comments,
        shares,
        engagements
      )
    `)
    .eq("client_id", clientId)
    .order("published_at", { ascending: false })
    .limit(5000);

  if (periodStart) query = query.gte("published_at", periodStart);
  if (periodEnd) query = query.lte("published_at", periodEnd);
  
  const { data: content, error: contentError } = await query;
  
  if (contentError) {
      console.error(contentError);
      return;
  }
  
  console.log("Supabase fetch returned:", content?.length);
  
  if (!content) return;
  
  const topInsightContent = content
    .filter((c) => {
      // Must have metrics
      if (!c.social_content_metrics || c.social_content_metrics.length === 0) return false;
      if (!c.published_at) return false;
      return true;
    })
    .map((c) => {
      // Get the most recent metric (by period_end, then collected_at)
      const sortedMetrics = [...c.social_content_metrics].sort((a, b) => {
        const periodCompare = (b.period_end || "").localeCompare(a.period_end || "");
        if (periodCompare !== 0) return periodCompare;
        return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
      });
      
      const latestMetric = sortedMetrics[0];

      // Use the higher of views or impressions for proper cross-platform ranking
      const viewsValue = latestMetric?.views || 0;
      const impressionsValue = latestMetric?.impressions || 0;
      const primaryMetric = Math.max(viewsValue, impressionsValue);
      const reachValue = latestMetric?.reach || 0;

      return {
        id: c.id,
        views: primaryMetric,
      };
    })
    .filter((c) => c.views > 0);
    
  console.log("Filtered content:", topInsightContent.length);
}

run();
