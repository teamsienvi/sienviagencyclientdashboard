const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const clientId = '79099b9d-0281-4a95-8076-dcff0fd128a4';
  
  console.log('Invoking sync-ubersuggest for client', clientId);
  
  const { data, error } = await supabase.functions.invoke('sync-ubersuggest', {
    body: { clientId }
  });
  
  console.log('Result:', data);
  if (error) {
    console.error('Error:', error);
  }
}

run();
