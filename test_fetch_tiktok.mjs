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
  const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%Serenity Scrolls%');
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
      from: '2023-01-01',
      to: '2026-04-01'
    }
  });

  if (error) {
    console.error('Edge function error:', error);
    return;
  }

  console.log('Success:', data?.success);
  console.log('Records synced:', data?.recordsSynced);

  if (data?.posts && data.posts.length > 0) {
    console.log('\nSample raw post returned by Edge Function:');
    console.log(JSON.stringify(data.posts[0], null, 2));
    
    // Find highest views
    const maxViews = Math.max(...data.posts.map(p => p.views || 0));
    console.log(`\nHighest views in payload: ${maxViews}`);
    
    // Look for properties that might be views
    const firstPost = data.posts[0];
    console.log('\nAll keys in the first post:', Object.keys(firstPost));
  } else {
    console.log('No posts returned or error');
  }
}

run().catch(console.error);
