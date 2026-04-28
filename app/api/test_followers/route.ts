import { NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';

export async function GET() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  
  if (!clients) return NextResponse.json({ error: 'No clients found' });
  
  const results = [];
  const periodStartStr = "2026-03-22"; // 30 days ago
  
  for (const client of clients) {
    const { data: timelineDataRaw, error } = await supabase
        .from("social_follower_timeline")
        .select("platform, date, followers")
        .eq("client_id", client.id)
        .order("date", { ascending: true });

    if (error) continue;
    if (!timelineDataRaw || timelineDataRaw.length === 0) continue;

    const platformFollowers: Record<string, number> = {};
    const byPlatform: Record<string, any[]> = {};
    
    timelineDataRaw.forEach((f) => {
        if (!byPlatform[f.platform]) byPlatform[f.platform] = [];
        byPlatform[f.platform].push(f);
    });
    
    Object.values(byPlatform).forEach((points: any[]) => {
        if (points.length === 0) return;
        const platform = String(points[0].platform || "").toLowerCase();

        const beforePoints = points.filter((p: any) => p.date < periodStartStr);
        const periodPoints = points.filter((p: any) => p.date >= periodStartStr);
        
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

    const totalFollowersGained = Object.values(platformFollowers).reduce((sum: number, val: number) => sum + val, 0);
    results.push({
      client: client.name,
      totalGained: totalFollowersGained,
      byPlatform: platformFollowers,
      points: timelineDataRaw.length
    });
  }

  return NextResponse.json(results);
}
