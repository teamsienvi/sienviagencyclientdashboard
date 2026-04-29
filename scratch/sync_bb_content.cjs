const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const clientId = "0b90215e-e55d-4b5e-8453-de35153a1fcd";
  const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
  
  console.log(`Syncing social content for Billionaire Brother: ${clientId}`);
  
  for (const platform of platforms) {
    console.log(`Syncing posts for ${platform}...`);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-metricool`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          clientId, 
          platform,
          periodStart: "2025-01-01"
        })
      });
      const data = await res.json();
      console.log(`Result for ${platform}:`, data);
    } catch (e) {
      console.error(`Error syncing ${platform}:`, e.message);
    }
  }

  console.log(`Now triggering summary generation...`);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-analytics-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clientId, type: "social" })
    });
    const data = await res.json();
    console.log(`Summary generation result:`, data);
  } catch (e) {
    console.error(`Error generating summary:`, e.message);
  }
}

run();
