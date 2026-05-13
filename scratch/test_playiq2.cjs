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

  // Find who has user_id = '4380439'
  const { data: configs } = await supabase.from('client_metricool_config').select('client_id, user_id, blog_id, platform').eq('user_id', '4380439');
  
  if (!configs || configs.length === 0) return;
  
  const clientIds = [...new Set(configs.map(c => c.client_id))];
  const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
  
  console.log("Clients using this Metricool user_id:");
  clients.forEach(c => console.log(c.name));
}

main().catch(console.error);
