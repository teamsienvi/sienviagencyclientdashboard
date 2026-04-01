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

  res = await fetch(`${supabaseUrl}/rest/v1/social_content?client_id=eq.${clientId}&platform=eq.tiktok&select=id,title,url,published_at,social_content_metrics(views,impressions,likes)`, { headers });
  const posts = await res.json();
  
  // Attach maxViews directly to the post object for sorting
  const postsWithViews = posts.map(p => {
    const metrics = p.social_content_metrics || [];
    const maxViews = Math.max(...metrics.map(m => m.views || 0), 0);
    return { ...p, maxViews };
  });

  // Sort by maxViews descending
  postsWithViews.sort((a, b) => b.maxViews - a.maxViews);

  console.log('Top 10 TikTok posts by views in DB:');
  postsWithViews.slice(0, 10).forEach(p => {
    console.log(`- Title: ${p.title?.substring(0, 40)}... | Views: ${p.maxViews} | Date: ${p.published_at}`);
  });
  
  // also check impressions
  const postsWithImpressions = posts.map(p => {
    const metrics = p.social_content_metrics || [];
    const maxImpressions = Math.max(...metrics.map(m => m.impressions || 0), 0);
    return { ...p, maxImpressions };
  });
  postsWithImpressions.sort((a, b) => b.maxImpressions - a.maxImpressions);
  
  console.log('\nTop 5 TikTok posts by impressions in DB:');
  postsWithImpressions.slice(0, 5).forEach(p => {
    console.log(`- Title: ${p.title?.substring(0, 40)}... | Impressions: ${p.maxImpressions} | Date: ${p.published_at}`);
  });
}

run();
