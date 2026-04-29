const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const clientId = "0b90215e-e55d-4b5e-8453-de35153a1fcd"; // The Billionaire Brother

async function run() {
  const platforms = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'];

  // Current reporting week logic (matches dashboard)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  
  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
  startOfCurrentWeek.setHours(0, 0, 0, 0);

  const startOfPreviousWeek = new Date(startOfCurrentWeek);
  startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);

  const endOfPreviousWeek = new Date(startOfCurrentWeek);
  endOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 1);
  endOfPreviousWeek.setHours(23, 59, 59, 999);
  
  const periodStart = startOfPreviousWeek.toISOString().split("T")[0];
  const periodEnd = endOfPreviousWeek.toISOString().split("T")[0];

  console.log(`Syncing period: ${periodStart} to ${periodEnd}`);

  for (const platform of platforms) {
    console.log(`Triggering sync for ${platform}...`);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-metricool-${platform}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          clientId: clientId,
          periodStart: periodStart,
          periodEnd: periodEnd
        })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`Error for ${platform}:`, data);
      } else {
        console.log(`Success for ${platform}!`);
      }
    } catch (e) {
      console.error(`Failed to trigger ${platform}:`, e.message);
    }
  }

  console.log("Done syncing Metricool platforms.");
}

run();
