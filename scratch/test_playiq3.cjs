const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhuxrnxajtiwxauhlhlv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E'
);

async function main() {
  const { data: configs } = await supabase.from('client_metricool_config').select('client_id, user_id, blog_id, platform');
  const { data: clients } = await supabase.from('clients').select('id, name');
  
  const clientMap = {};
  clients.forEach(c => clientMap[c.id] = c.name);
  
  const grouped = {};
  configs.forEach(c => {
    const k = `${c.user_id}_${c.blog_id}`;
    if (!grouped[k]) grouped[k] = new Set();
    grouped[k].add(clientMap[c.client_id]);
  });
  
  for (const k of Object.keys(grouped)) {
    console.log(`Credentials ${k}:`);
    console.log([...grouped[k]].join(', '));
    console.log('---');
  }
}

main().catch(console.error);
