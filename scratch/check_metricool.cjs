const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data, error } = await supabase
    .from('client_metricool_config')
    .select('*')
    .eq('client_id', 'b6c39651-9259-4930-af6e-b744a5a191ad');
    
  if (error) {
    console.error('Error fetching:', error.message);
  } else {
    console.log('Haven Metricool Config:', JSON.stringify(data, null, 2));
  }
}

checkConfig();
