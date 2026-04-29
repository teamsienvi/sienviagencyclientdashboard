import fs from 'fs';

async function run() {
  const token = "app#tier2__d4253034417d729b238c9dea7707ab0624ac5012";
  const headers = { "Authorization": "Bearer " + token };
  
  const endpoints = [
    "https://app.neilpatel.com/api/domain_overview?domain=blingybag.com&locId=2840&lang=en",
    "https://app.neilpatel.com/api/backlinks?domain=blingybag.com",
    "https://app.neilpatel.com/api/backlinks/overview?domain=blingybag.com",
    "https://app.neilpatel.com/api/projects/d3f8279e9d64af020f1176c1750b59c3e30696254da3c655aa05b9cfc08cd721/dashboard",
    "https://app.neilpatel.com/api/projects/d3f8279e9d64af020f1176c1750b59c3e30696254da3c655aa05b9cfc08cd721/metrics"
  ];

  for (const url of endpoints) {
    console.log(`Testing: ${url}`);
    try {
      const res = await fetch(url, { headers });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Data snippet:`, JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    console.log('---------------------------');
  }
}
run();
