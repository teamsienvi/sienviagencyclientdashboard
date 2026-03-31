import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const userId = '4380439';
  const blogId = '5917304';
  const from = '2026-03-24T00:00:00';
  const to = '2026-03-31T23:59:59';
  
  console.log("Fetching Instagram reels...");
  const { data: reelsData } = await supabase.functions.invoke("metricool-csv", {
    body: {
      path: "/api/v2/analytics/reels/instagram",
      params: { from, to, timezone: "UTC", userId, blogId }
    }
  });
  if (reelsData && reelsData.rows && reelsData.rows.length > 0) {
    console.log("IG Reels CSV Headers:", Object.keys(reelsData.rows[0]));
    console.log("IG Reels First row:", JSON.stringify(reelsData.rows[0], null, 2));
  } else {
    console.log("No reels or error:", reelsData);
  }
}
run();
