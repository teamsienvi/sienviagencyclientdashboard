const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E';

const supabase = createClient(supabaseUrl, supabaseKey);
const clientId = 'b6c39651-9259-4930-af6e-b744a5a191ad';

async function checkConfig() {
  const platforms = ['instagram', 'facebook', 'tiktok', 'youtube'];
  for (const p of platforms) {
    const { count, error } = await supabase
      .from('social_content')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('platform', p);
    console.log(`Platform ${p}: ${count} posts`);
  }
}

checkConfig();
