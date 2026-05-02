import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: client, error } = await supabase.from('clients').select('id').eq('name', 'BlingyBag').single();
  if (error || !client) {
    console.error("Client not found:", error);
    return;
  }
  console.log("Found BlingyBag ID:", client.id);

  const { data: analytics, error: fnError } = await supabase.functions.invoke('fetch-client-analytics', {
    body: {
      clientId: client.id,
      startDate: '2026-04-01',
      endDate: '2026-05-02'
    }
  });

  if (fnError) {
    console.error("Function error:", fnError);
  } else {
    console.log("Status: OK");
    const a = analytics?.analytics?.analytics || analytics?.analytics;
    if (a && a.trafficSources) {
      console.log("Traffic Sources:", JSON.stringify(a.trafficSources, null, 2));
    } else {
      console.log("Response:", analytics);
    }
  }
}
run();
