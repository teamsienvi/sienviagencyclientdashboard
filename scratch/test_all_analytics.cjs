const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/fetch-client-analytics";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const clients = [
  { name: "Snarky Humans", id: "ef580ebf-439f-4305-826a-f1f8aa89fd03" },
  { name: "Snarky Pets", id: "d8a121fe-cdd9-4e19-90dc-dd32b159f973" },
  { name: "OxiSure Tech", id: "1a1edf9f-2ebe-4d40-a904-7295d5033401" },
  { name: "BlingyBag", id: "79099b9d-0281-4a95-8076-dcff0fd128a4" }
];

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
const formatDate = (d) => d.toISOString().split("T")[0];

async function runTests() {
  for (const client of clients) {
    console.log(`\n=== Testing ${client.name} ===`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: client.id,
          startDate: formatDate(thirtyDaysAgo),
          endDate: formatDate(today)
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        console.log(`Error: ${data.error}`);
        continue;
      }
      
      const summary = data.analytics?.summary || {};
      const topPages = data.analytics?.topPages || [];
      
      console.log(`Total Sessions: ${summary.totalSessions}`);
      console.log(`Total Pageviews: ${summary.totalPageViews}`);
      
      console.log("Top Pages:");
      if (topPages.length === 0) {
        console.log("  (No pages logged)");
      } else {
        topPages.slice(0, 3).forEach(p => {
          console.log(`  - ${p.path} (${p.views} views)`);
        });
      }
    } catch (err) {
      console.error(`Fetch failed for ${client.name}:`, err.message);
    }
  }
}

runTests();
