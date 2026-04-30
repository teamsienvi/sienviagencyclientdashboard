const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/fetch-client-analytics";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const clientId = "041555a7-1a25-42b8-89c7-edc40afff861";

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
const formatDate = (d) => d.toISOString().split("T")[0];

async function runTest() {
  console.log(`\n=== Testing Serenity Scrolls ===`);
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
    
    if (data.error) {
      console.log(`Error: ${data.error}`);
      return;
    }
    
    const summary = data.analytics?.summary || {};
    const topPages = data.analytics?.topPages || [];
    
    console.log(`Total Sessions: ${summary.totalSessions}`);
    console.log(`Total Pageviews: ${summary.totalPageViews}`);
    
    console.log("Top Pages:");
    if (topPages.length === 0) {
      console.log("  (No pages logged)");
    } else {
      topPages.slice(0, 5).forEach(p => {
        console.log(`  - ${p.path} (${p.views} views)`);
      });
    }
  } catch (err) {
    console.error(`Fetch failed for Serenity Scrolls:`, err.message);
  }
}

runTest();
