const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: client } = await supabase.from('clients').select('id, name').ilike('name', '%Serenity Scrolls%').single();
  const clientId = client.id;
  console.log('Client:', client.name);

  // Fetch TikTok content
  const { data: posts, error } = await supabase
    .from('social_content')
    .select('id, title, url, published_at, social_content_metrics(views, impressions, likes, collected_at, period_end)')
    .eq('client_id', clientId)
    .eq('platform', 'tiktok');
    
  if (error) { console.error(error); return; }
  console.log('Total TikTok posts:', posts.length);
  
  const highViewPosts = posts.filter(p => {
     let maxViews = 0;
     if (p.social_content_metrics) {
        maxViews = Math.max(...p.social_content_metrics.map(m => m.views || 0));
     }
     if (maxViews > 10000) return true;
     return false;
  });
  
  console.log('\nPosts with > 10k views:');
  highViewPosts.forEach(p => {
    const metrics = p.social_content_metrics || [];
    const maxViews = Math.max(...metrics.map(m => m.views || 0));
    console.log(`- ${p.title?.substring(0, 30)}... | published: ${p.published_at} | max_views: ${maxViews}`);
  });
}

run();
