const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching active SEO clients...");
  const { data: clients, error } = await supabase
    .from('client_seo_config')
    .select('client_id, domain')
    .eq('is_active', true);
    
  if (error) {
    console.error("Failed to fetch clients:", error);
    return;
  }
  
  console.log(`Found ${clients.length} active SEO clients.`);
  
  for (const c of clients) {
    console.log(`Syncing ${c.domain} (${c.client_id})...`);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-ubersuggest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId: c.client_id })
      });
      const data = await res.json();
      console.log(`Result for ${c.domain}:`, data);
    } catch (e) {
      console.error(`Error syncing ${c.domain}:`, e.message);
    }
  }
}
run();
