const url = "https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/admin-client-ops";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

async function createClient() {
  console.log("Creating client 'The Billionaire Brother'...");
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: "create_client", clientName: "The Billionaire Brother" })
  });
  
  const data = await res.json();
  if (data.error) {
    if (data.error.includes("duplicate key value violates unique constraint")) {
      console.log("Client already exists. Listing clients to find ID...");
      const listRes = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "list_clients" })
      });
      const listData = await listRes.json();
      const existing = listData.clients.find(c => c.name === "The Billionaire Brother");
      if (existing) {
        console.log(`Found existing client with ID: ${existing.id}`);
        await configureMetricool(existing.id);
      }
    } else {
      console.error("Error creating client:", data.error);
    }
  } else {
    const clientId = data.client.id;
    console.log(`Created client with ID: ${clientId}`);
    await configureMetricool(clientId);
  }
}

async function configureMetricool(clientId) {
  const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
  const userId = "4380439";
  const blogId = "6157013";
  
  console.log("Configuring Metricool platforms...");
  
  for (const platform of platforms) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: "upsert_metricool_config", 
        clientId: clientId, 
        userId: userId, 
        blogId: blogId, 
        platform: platform 
      })
    });
    const data = await res.json();
    console.log(`Result for ${platform}:`, data.results?.[0] || data);
  }
  
  console.log("Done!");
}

createClient();
