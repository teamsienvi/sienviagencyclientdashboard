const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_policies'); // doesn't exist.
  // Query pg_policies using rest endpoint via service role key
  const res = await fetch(`${supabaseUrl}/rest/v1/pg_policies?select=schemaname,tablename,policyname,roles,cmd`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const policies = await res.json();
  if (policies && policies.length > 0) {
      console.log("Policies for social_content_metrics:");
      console.log(policies.filter(p => p.tablename === 'social_content_metrics'));
      console.log("Policies for social_account_metrics:");
      console.log(policies.filter(p => p.tablename === 'social_account_metrics'));
  } else {
      console.log("Could not fetch policies via REST.", policies);
  }
}
run();
