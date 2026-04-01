import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {data: client} = await supabase.from('clients').select('id, name').ilike('name', '%Father%').single();
  const {data: config} = await supabase.from('client_metricool_config').select('*').eq('client_id', client.id).eq('platform', 'instagram').single();
  const res = await fetch('https://app.metricool.com/api/v2/analytics/posts/instagram?from=2026-03-01T00:00:00&to=2026-03-31T23:59:59&timezone=America/Chicago&userId=' + config.user_id + '&blogId=' + config.blog_id, {
    headers: { 'x-mc-auth': process.env.METRICOOL_AUTH, 'accept': 'text/csv' }
  });
  const csv = await res.text();
  console.log(csv.substring(0, 1000));
}
main();
