const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim().replace(/\r/g, '');
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clientId = '95791e88-87cd-4621-af7e-df46f5ad93ac';
const platform = 'instagram';
const startDate = '2026-04-28';
const endDate = '2026-05-04';

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/social_content?select=id,content_id,title,url,published_at,content_type,social_content_metrics(social_content_id,reach,impressions,views,likes,comments,shares,interactions,engagements,collected_at,period_start,period_end)&client_id=eq.${clientId}&platform=eq.${platform}&order=published_at.desc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const contentData = await res.json();
  
  const seenKeys = new Set();
  const contentWithMetrics = (contentData || [])
    .filter((item) => item.title || item.url)
    .filter((item) => {
      const titleHash = (item.title || "").substring(0, 40).trim().toLowerCase();
      const dateKey = item.published_at ? item.published_at.split("T")[0] : "";
      const compositeKey = `${item.content_id}::${titleHash}::${dateKey}`;
      if (seenKeys.has(compositeKey)) return false;
      seenKeys.add(compositeKey);

      const titleDateKey = `title::${titleHash}::${dateKey}`;
      if (titleHash && seenKeys.has(titleDateKey)) return false;
      if (titleHash) seenKeys.add(titleDateKey);

      return true;
    })
    .filter((item) => {
      if (!item.published_at) return false;
      const publishedDate = new Date(item.published_at);
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      periodEnd.setHours(23, 59, 59, 999);
      return publishedDate >= periodStart && publishedDate <= periodEnd;
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 50);
    
  console.log(`Found ${contentWithMetrics.length} posts after filtering`);
  console.log('Top 2 posts:', JSON.stringify(contentWithMetrics.slice(0, 2), null, 2));
}

run().catch(console.error);
