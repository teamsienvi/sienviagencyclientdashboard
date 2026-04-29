const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

async function run() {
  console.log("Triggering sync-ubersuggest for The Billionaire Brother...");
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-ubersuggest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clientId: "0b90215e-e55d-4b5e-8453-de35153a1fcd" })
    });
    
    // Ubersuggest sync can take a bit, so we await
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
