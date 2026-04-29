const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const clientId = "0b90215e-e55d-4b5e-8453-de35153a1fcd";
  
  // Delete from analytics_summaries to force a refresh on next load
  const { error } = await supabase
    .from('analytics_summaries')
    .delete()
    .eq('client_id', clientId);
    
  if (error) {
    console.error("Error deleting summary:", error);
  } else {
    console.log("Successfully deleted cached analytics summary for The Billionaire Brother.");
  }
}

run();
