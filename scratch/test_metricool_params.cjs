const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";
const clientId = "b6c39651-9259-4930-af6e-b744a5a191ad";
const userId = "4380439";
const blogId = "5691522";

async function runTest(functionName, bodyParams) {
  const url = `https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/${functionName}`;
  console.log(`\n=== Testing Dedicated: ${functionName} ===`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyParams)
    });
    const text = await res.text();
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  } catch (err) { console.error(`Fetch failed:`, err.message); }
}

async function main() {
  const fromUTC = "2026-04-01T00:00:00Z";
  const toUTC = "2026-05-02T23:59:59Z";
  
  await runTest('metricool-tiktok-posts', {
    clientId,
    userId,
    blogId,
    from: fromUTC,
    to: toUTC,
    timezone: "UTC"
  });

  await runTest('metricool-youtube', {
    clientId,
    userId,
    blogId,
    from: "2026-04-01",
    to: "2026-05-02",
    prevFrom: "2026-03-01",
    prevTo: "2026-03-31",
    timezone: "America/Chicago"
  });
}

main();
