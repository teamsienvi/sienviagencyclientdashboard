const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhuxrnxajtiwxauhlhlv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E'
);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teamsienvi@gmail.com',
    password: '9SwvfoTIoQce',
  });

  if (authErr) {
    console.log("Auth failed:", authErr.message);
    return;
  }

  // Find PlayIQ client
  const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%PlayIQ%');
  console.log("Clients:", clients);
  
  if (!clients || clients.length === 0) return;
  const clientId = clients[0].id;
  
  // Get Metricool config
  const { data: configs } = await supabase.from('client_metricool_config').select('*').eq('client_id', clientId);
  console.log("Metricool Configs:", configs);
  
  // Get metrics
  const { data: metrics } = await supabase.from('social_account_metrics').select('*').eq('client_id', clientId).order('collected_at', { ascending: false }).limit(20);
  console.log("Latest Metrics:");
  metrics?.forEach(m => {
    console.log(`- ${m.platform}: ${m.followers} followers, ${m.new_followers} new, ${m.engagements} engagements, period: ${m.period_start} to ${m.period_end}`);
  });
}

main().catch(console.error);
