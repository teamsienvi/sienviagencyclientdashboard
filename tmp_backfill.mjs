async function run() {
  const clientId = '22090989-2d0e-47b2-b9c5-98652d7f0957';
  
  // Use anonymous key to hit edge function
  const res = await fetch("https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/sync-metricool-facebook", {
    method: "POST",
    headers: {
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId,
      periodStart: "2026-03-24",
      periodEnd: "2026-03-31"
    })
  });
  
  console.log(res.status, await res.text());
}
run();
