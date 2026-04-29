const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/fetch-client-analytics";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

// OxiSure Tech client ID from earlier test
const clientId = "1a1edf9f-2ebe-4d40-a904-7295d5033401";

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const formatDate = (d) => d.toISOString().split("T")[0];

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientId,
    startDate: formatDate(thirtyDaysAgo),
    endDate: formatDate(today)
  })
})
.then(res => res.json())
.then(data => {
  console.log("=== FULL RESPONSE ===");
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
