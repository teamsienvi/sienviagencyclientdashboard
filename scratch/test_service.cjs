const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const clientId = '95791e88-87cd-4621-af7e-df46f5ad93ac';
  console.log('Invoking sync-ubersuggest for client', clientId);
  const { data, error } = await supabase.functions.invoke('sync-ubersuggest', {
    body: { clientId }
  });
  console.log('Result:', data);
  if (error) console.error('Error:', error);
}
run();
