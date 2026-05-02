const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/sync-tiktok";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";
const clientId = "b6c39651-9259-4930-af6e-b744a5a191ad";

async function runTest() {
  console.log(`\n=== Testing Haven TikTok Sync ===`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    });
    const text = await res.text();
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  } catch (err) { console.error(`Fetch failed:`, err.message); }
}
runTest();
