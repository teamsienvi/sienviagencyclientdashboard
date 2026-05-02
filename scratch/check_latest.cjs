const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';
const supabase = createClient(url, key);

async function check() {
  const clientId = "b6c39651-9259-4930-af6e-b744a5a191ad";
  
  const { data: metrics, error: metricsErr } = await supabase
    .from('social_account_metrics')
    .select('platform, period_start, period_end, followers, new_followers, engagement_rate, total_content, collected_at')
    .eq('client_id', clientId)
    .in('platform', ['tiktok', 'youtube'])
    .gte('period_start', '2026-04-01')
    .order('period_start', { ascending: false });
    
  console.log("Metrics since April:", metrics);
  console.log("Metrics Error:", metricsErr);
  
  const { data: content, error: contentErr } = await supabase
    .from('social_content')
    .select('platform, title, published_at')
    .eq('client_id', clientId)
    .in('platform', ['tiktok', 'youtube'])
    .gte('published_at', '2026-04-01')
    .order('published_at', { ascending: false });
    
  console.log("Content since April count:", content?.length);
  console.log("Content Error:", contentErr);
  console.log("Sample content:", content?.slice(0, 3));
}
check();
