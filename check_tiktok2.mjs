import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
});

async function run() {
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
  
  let res = await fetch(`${supabaseUrl}/rest/v1/clients?name=ilike.*Serenity%20Scrolls*&select=id`, { headers });
  const clients = await res.json();
  const clientId = clients[0].id;

  res = await fetch(`${supabaseUrl}/rest/v1/social_content?client_id=eq.${clientId}&platform=eq.tiktok&select=id,title,url,published_at,social_content_metrics(*)`, { headers });
  const posts = await res.json();
  
  const postsWithLikes = posts.map(p => {
    const metrics = p.social_content_metrics || [];
    const maxLikes = Math.max(...metrics.map(m => m.likes || 0), 0);
    return { ...p, maxLikes };
  });

  postsWithLikes.sort((a, b) => b.maxLikes - a.maxLikes);

  console.log('Top 5 TikTok posts by LIKES in DB:');
  postsWithLikes.slice(0, 5).forEach(p => {
    const mm = p.social_content_metrics[0] || {};
    console.log(`- Title: ${p.title?.substring(0, 40)}... | Likes: ${p.maxLikes} | Views: ${mm.views} | Reach: ${mm.reach} | Impressions: ${mm.impressions} | Clicks: ${mm.link_clicks}`);
  });
  
  process.exit(0);
}

run();
