const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/fetch-client-analytics";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

// ID from database for "Snarky A$$ Humans"
const clientId = "297cbb3c-54b4-4bed-8206-25949a94fa62";

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
const formatDate = (d) => d.toISOString().split("T")[0];

async function runTest() {
  console.log(`\n=== Testing Snarky A$$ Humans ===`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: clientId,
        startDate: formatDate(thirtyDaysAgo),
        endDate: formatDate(today)
      })
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Fetch failed for Snarky A$$ Humans:`, err.message);
  }
}

runTest();
