const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhuxrnxajtiwxauhlhlv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E'
);

async function main() {
  const clientId = '22090989-2d0e-47b2-b9c5-98652d7f0957'; // PlayIQ
  
  const platforms = ['tiktok', 'instagram', 'facebook'];
  
  for (const p of platforms) {
    const { data, error } = await supabase.functions.invoke('metricool-social-weekly', {
      body: {
        clientId,
        platform: p,
        from: '2026-04-27',
        to: '2026-05-03',
        prevFrom: '2026-04-20',
        prevTo: '2026-04-26'
      }
    });
    
    if (error) {
      console.error(`Error for ${p}:`, error);
      continue;
    }
    
    if (data && data.success) {
      const current = data.data.current;
      const followersTimeline = current.followersTimeline || [];
      const lastPoint = followersTimeline.length > 0 ? followersTimeline[followersTimeline.length - 1].value : null;
      console.log(`${p}: last point in timeline = ${lastPoint}`);
    } else {
      console.log(`Failed for ${p}:`, data);
    }
  }
}

main().catch(console.error);
