const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, logo_url, supabase_url, api_key, client_ga4_config(ga4_property_id)")
    .ilike("name", "%OxiSure%");
    
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
