const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhuxrnxajtiwxauhlhlv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E'
);

async function main() {
  console.log("Signing in as admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teamsienvi@gmail.com',
    password: '9SwvfoTIoQce',
  });

  if (authErr) {
    console.log("Auth failed:", authErr.message);
    return;
  }
  console.log("Signed in!");

  console.log('Fixing null new_followers in social_account_metrics...');
  
  // 1. Get all metrics where new_followers is null or missing
  const { data: allMetrics, error } = await supabase
    .from('social_account_metrics')
    .select('*')
    .order('period_start', { ascending: false });
    
  if (error) {
    console.error("Error fetching metrics:", error.message);
    return;
  }
  
  // Group by client and platform
  const groups = {};
  for (const m of allMetrics) {
    const k = `${m.client_id}_${m.platform}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(m);
  }
  
  let fixedCount = 0;
  
  for (const k of Object.keys(groups)) {
    const list = groups[k];
    // list is ordered by period_start desc
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      if (current.new_followers === null && current.followers !== null) {
        // Look for the next older record
        if (i + 1 < list.length) {
          const prev = list[i + 1];
          if (prev.followers !== null) {
            const newFollowers = current.followers - prev.followers;
            console.log(`Fixing ${current.platform} for client ${current.client_id.substring(0,6)}... ${prev.followers} -> ${current.followers} (diff: ${newFollowers})`);
            
            // Update the DB
            await supabase
              .from('social_account_metrics')
              .update({ new_followers: newFollowers })
              .eq('id', current.id);
              
            fixedCount++;
          }
        } else {
           // No previous record, new followers is 0
           console.log(`Fixing ${current.platform} for client ${current.client_id.substring(0,6)} (no prev record) -> 0`);
           await supabase
              .from('social_account_metrics')
              .update({ new_followers: 0 })
              .eq('id', current.id);
            fixedCount++;
        }
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} records!`);
}

main().catch(e => console.error("Fatal:", e.message));
