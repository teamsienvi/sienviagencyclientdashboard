import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: client } = await supabase.from('clients').select('id').eq('name', 'Father Figure Formula').single();
  console.log('Client ID:', client.id);
  const { data, error } = await supabase.functions.invoke('generate-analytics-summary', {
    body: { clientId: client.id, type: 'website', dateRange: '7d' }
  });
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
