const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: tokenCred } = await supabase
    .from("integration_credentials")
    .select("token")
    .eq("service_name", "ubersuggest_token")
    .single();

  const { data: sessionCred } = await supabase
    .from("integration_credentials")
    .select("token, updated_at")
    .eq("service_name", "ubersuggest_session")
    .single();

  if (!tokenCred?.token || !sessionCred?.token) {
    console.error("Credentials not found");
    return;
  }

  const authHeaders = {
    Authorization: tokenCred.token,
    Cookie: `id=${sessionCred.token}`,
    Accept: "application/json",
    ts: String(Math.floor(Date.now() / 1000)),
  };

  const projectsRes = await fetch("https://app.neilpatel.com/api/projects", {
    headers: authHeaders,
  });

  const projectsRaw = await projectsRes.json();
  const projectsArray = Array.isArray(projectsRaw)
    ? projectsRaw
    : projectsRaw.projects || projectsRaw.data || projectsRaw.result || [];

  console.log("Projects tracked:", projectsArray.map(p => p.domain || p.url || p.name));
}

run();
