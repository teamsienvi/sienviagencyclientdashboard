import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(l => { 
  const i = l.indexOf('=');
  const k = l.substring(0, i).trim();
  const v = l.substring(i+1).trim().replace(/\"/g, '').replace(/\'/g, '').replace(/\r/g, ''); 
  env[k] = v;
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function verifyClients() {
  const { data: clients, error: cErr } = await supabase.from('clients').select('id, name');
  console.log(`Checking ${clients.length} clients...`);
  
  const periodStartStr = "2026-03-22"; // 30 days ago
  
  for (const client of clients) {
    const { data: timelineDataRaw, error: err } = await supabase
        .from("social_follower_timeline")
        .select("platform, date, followers")
        .eq("client_id", client.id)
        .order("date", { ascending: true });

    if (err) { console.error('ERROR for', client.name, err); continue; }
    if (!timelineDataRaw || timelineDataRaw.length === 0) {
      console.log(`[${client.name}] NO timeline data`);
      continue;
    }

    const platformFollowers = {};
    const byPlatform = {};
    
    timelineDataRaw.forEach((f) => {
        if (!byPlatform[f.platform]) byPlatform[f.platform] = [];
        byPlatform[f.platform].push(f);
    });
    
    Object.values(byPlatform).forEach((points) => {
        if (points.length === 0) return;
        const platform = String(points[0].platform || "").toLowerCase();

        const beforePoints = points.filter(p => p.date < periodStartStr);
        const periodPoints = points.filter(p => p.date >= periodStartStr);
        
        if (periodPoints.length > 0) {
            const baseline = beforePoints.length > 0 
                ? beforePoints[beforePoints.length - 1].followers 
                : periodPoints[0].followers;
                
            const last = periodPoints[periodPoints.length - 1].followers;
            const diff = last - baseline;
            
            platformFollowers[platform] = diff;
        } else {
            platformFollowers[platform] = 0;
        }
    });

    const totalFollowersGained = Object.values(platformFollowers).reduce((sum, val) => sum + val, 0);
    console.log(`[${client.name}] Total Gain: ${totalFollowersGained} | Timeline points: ${timelineDataRaw.length}`);
    Object.entries(platformFollowers).forEach(([plat, val]) => {
      console.log(`   - ${plat}: ${val}`);
    });
  }
}

verifyClients();
