import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const {data: client} = await supabase.from('clients').select('id, name').ilike('name', '%Father Figure%').single();
  console.log(client);
  const {data: conf} = await supabase.from('client_metricool_config').select('*').eq('client_id', client.id);
  console.log(conf);
  const {data: content, count} = await supabase.from('social_content').select('*', {count: 'exact', head: true}).eq('client_id', client.id).eq('platform', 'instagram').gte('published_at', '2026-03-25');
  console.log('IG posts in db:', count);
  const {data: fbcontent, count: fbCount} = await supabase.from('social_content').select('*', {count: 'exact', head: true}).eq('client_id', client.id).eq('platform', 'facebook').gte('published_at', '2026-03-25');
  console.log('FB posts in db:', fbCount);
}
main();
