const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
  const { data, error } = await supabase.functions.invoke('sync-ubersuggest', {
    body: { clientId: "79099b9d-0281-4a95-8076-dcff0fd128a4" }
  });
  console.log("Response:", JSON.stringify(data, null, 2), error);
}
sync();
