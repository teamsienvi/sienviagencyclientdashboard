import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%OxiSure Tech%');
  const clientId = clients[0].id;

  console.log(`Testing edge function for ${clients[0].name} (${clientId})`);
  
  // Call the edge function with a recent date range
  const { data: config } = await supabase.from('client_metricool_config').select('*').eq('client_id', clientId).eq('platform', 'tiktok').single();
  const userId = config.user_id;
  const blogId = config.blog_id;
  
  console.log(`Using TikTok config: user_id=${userId}`);

  const { data, error } = await supabase.functions.invoke('metricool-tiktok-posts', {
    body: {
      clientId,
      userId,
      blogId,
      from: '2026-05-25',
      to: '2026-06-03'
    }
  });

  if (error) {
    console.error('Edge function error:', error);
    return;
  }

  console.log('Success:', data?.success);
  console.log('Records synced:', data?.savedCount);

  if (data?.rows && data.rows.length > 0) {
    console.log('\nAll posts returned by Edge Function:');
    data.rows.forEach((r, idx) => {
      console.log(`[${idx}] Date: ${r.date} | Views: ${r.views} | Likes: ${r.likes} | Title: "${r.title?.substring(0, 50)}..."`);
    });
  } else {
    console.log('No posts returned or error');
  }
}

run().catch(console.error);
