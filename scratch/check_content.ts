import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: client } = await supabase.from('clients').select('id, name').ilike('name', '%OxiSure%').single();
  if (!client) {
    console.log("No client found");
    return;
  }
  console.log("Client ID:", client.id);

  // Check social_content
  const { data: content } = await supabase
    .from('social_content')
    .select('id, platform, published_at')
    .eq('client_id', client.id)
    .order('published_at', { ascending: false })
    .limit(5);
    
  console.log("Latest content:", content);

  // Check social_content_metrics for any recent
  const { data: metrics } = await supabase
    .from('social_content_metrics')
    .select('period_end, collected_at, social_content!inner(client_id)')
    .eq('social_content.client_id', client.id)
    .order('period_end', { ascending: false })
    .limit(5);

  console.log("Latest metrics by period_end:", metrics?.map(m => m.period_end));
}

run();
