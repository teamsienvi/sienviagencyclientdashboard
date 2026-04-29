import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars");
  Deno.exit(1);
}

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
