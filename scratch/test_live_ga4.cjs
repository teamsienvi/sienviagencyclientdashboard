const url = 'https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/fetch-client-analytics';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientId: 'b6c39651-9259-4930-af6e-b744a5a191ad', // Haven At Deer Park
      startDate: '2026-04-01',
      endDate: '2026-05-02'
    })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  if (data.analytics && data.analytics.trafficSources) {
    console.log("Traffic Sources:", JSON.stringify(data.analytics.trafficSources, null, 2));
  } else {
    console.log("Response:", data);
  }
}
run();
