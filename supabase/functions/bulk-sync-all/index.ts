import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncResult {
  clientId: string;
  clientName: string;
  platform: string;
  success: boolean;
  data?: any;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const timezone = "America/Los_Angeles";

    // Calculate reporting periods (previous completed week = Jan 13-19 if today is Jan 20)
    const now = new Date();
    const pstOffset = -8 * 60;
    const nowPST = new Date(now.getTime() + (pstOffset - now.getTimezoneOffset()) * 60000);
    
    const dayOfWeek = nowPST.getDay();
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const thisMonday = new Date(nowPST);
    thisMonday.setDate(nowPST.getDate() - daysToLastMonday);
    thisMonday.setHours(0, 0, 0, 0);
    
    const prevWeekStart = new Date(thisMonday);
    prevWeekStart.setDate(thisMonday.getDate() - 7);
    
    const prevWeekEnd = new Date(thisMonday);
    prevWeekEnd.setDate(thisMonday.getDate() - 1);
    
    const prevPrevWeekStart = new Date(prevWeekStart);
    prevPrevWeekStart.setDate(prevWeekStart.getDate() - 7);
    
    const prevPrevWeekEnd = new Date(prevWeekStart);
    prevPrevWeekEnd.setDate(prevWeekStart.getDate() - 1);

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const from = formatDate(prevWeekStart);
    const to = formatDate(prevWeekEnd);
    const prevFrom = formatDate(prevPrevWeekStart);
    const prevTo = formatDate(prevPrevWeekEnd);

    console.log(`Sync periods: Current ${from} to ${to}, Previous ${prevFrom} to ${prevTo}`);

    // Get all active Metricool configs
    const { data: configs, error: configError } = await supabase
      .from("client_metricool_config")
      .select(`
        client_id,
        platform,
        user_id,
        blog_id,
        clients!inner(id, name, is_active)
      `)
      .eq("is_active", true);

    if (configError) {
      throw new Error(`Failed to fetch configs: ${configError.message}`);
    }

    const activeConfigs = configs?.filter((c: any) => c.clients?.is_active) || [];
    console.log(`Found ${activeConfigs.length} active platform configurations`);

    const results: SyncResult[] = [];

    // Helper to build params (matching metricool-social-weekly format)
    const buildParams = (userId: string, blogId: string | null, platform: string, fromDate: string, toDate: string, extra: Record<string, string> = {}) => {
      const params: Record<string, string> = {
        from: `${fromDate}T00:00:00`,
        to: `${toDate}T23:59:59`,
        network: platform,
        timezone,
        userId,
        ...extra,
      };
      if (blogId) params.blogId = blogId;
      return params;
    };

    // Helper to fetch from Metricool (using x-mc-auth header like the working function)
    const fetchMetricool = async (endpoint: string, params: Record<string, string>): Promise<any> => {
      const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      const res = await fetch(url.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText.substring(0, 200)}`);
      }
      
      return res.json();
    };

    // Helper to fetch CSV
    const fetchMetricoolCSV = async (endpoint: string, params: Record<string, string>): Promise<string> => {
      const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      const res = await fetch(url.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
      });
      
      if (!res.ok) {
        throw new Error(`CSV ${res.status}`);
      }
      
      return res.text();
    };

    // Helper to extract value from timeline
    const extractTimelineValue = (data: any): number | null => {
      if (!data) return null;
      
      let points: any[] = [];
      if (Array.isArray(data)) {
        if (data[0]?.values) {
          points = data[0].values;
        } else {
          points = data;
        }
      } else if (data.data) {
        return extractTimelineValue(data.data);
      }
      
      if (points.length === 0) return null;
      
      // Sort by dateTime and get latest
      points.sort((a, b) => new Date(a.dateTime || a.date).getTime() - new Date(b.dateTime || b.date).getTime());
      return points[points.length - 1]?.value ?? null;
    };

    // Helper to extract aggregation value
    const extractAggValue = (data: any): number | null => {
      if (data === null || data === undefined) return null;
      if (typeof data === 'number') return data;
      if (typeof data === 'object') {
        if (data.data !== undefined) {
          return typeof data.data === 'number' ? data.data : null;
        }
        if (data.value !== undefined) return data.value;
        if (data.total !== undefined) return data.total;
      }
      return null;
    };

    // Get followers metric based on platform
    const getFollowersMetric = (platform: string) => {
      if (platform === "facebook") return "pageFollows";
      if (platform === "youtube") return "totalSubscribers";
      if (platform === "tiktok") return "followers_count";
      return "followers"; // Instagram, LinkedIn
    };

    // Process each config
    for (const config of activeConfigs) {
      const clientData = config.clients as any;
      const clientId = config.client_id;
      const clientName = clientData?.name || "Unknown";
      const platform = config.platform;
      const userId = config.user_id;
      const blogId = config.blog_id;

      // Skip meta_ads - it doesn't have the same metrics
      if (platform === "meta_ads") {
        console.log(`Skipping ${clientName} - ${platform} (ads platform)`);
        results.push({
          clientId,
          clientName,
          platform,
          success: true,
          data: { skipped: true, reason: "ads platform" },
        });
        continue;
      }

      console.log(`Syncing ${clientName} - ${platform}...`);

      try {
        let followers: number | null = null;
        let newFollowers: number | null = null;
        let engagementRate: number | null = null;
        let totalContent: number | null = null;

        const followersMetric = getFollowersMetric(platform);
        const params = buildParams(userId, blogId, platform, from, to);

        // 1. Fetch followers timeline
        try {
          const data = await fetchMetricool("/api/v2/analytics/timelines", {
            ...params,
            metric: followersMetric,
            subject: "account",
          });
          followers = extractTimelineValue(data);
          
          // Also calculate new followers from timeline
          if (data) {
            let points: any[] = [];
            if (Array.isArray(data)) {
              points = data[0]?.values || data;
            } else if (data.data) {
              points = Array.isArray(data.data) ? data.data : (data.data.values || []);
            }
            if (points.length > 1) {
              points.sort((a, b) => new Date(a.dateTime || a.date).getTime() - new Date(b.dateTime || b.date).getTime());
              const first = points[0]?.value ?? 0;
              const last = points[points.length - 1]?.value ?? 0;
              newFollowers = last - first;
            }
          }
          console.log(`  ${platform} followers: ${followers}, new: ${newFollowers}`);
        } catch (e: any) {
          console.error(`  Error fetching followers for ${clientName} ${platform}:`, e.message);
        }

        // 2. Fetch engagement rate (posts engagement) - for TikTok calculate from CSV
        if (platform !== "tiktok") {
          try {
            const data = await fetchMetricool("/api/v2/analytics/aggregation", {
              ...params,
              metric: "engagement",
              subject: "posts",
            });
            engagementRate = extractAggValue(data);
            console.log(`  ${platform} engagement: ${engagementRate?.toFixed(2)}%`);
          } catch (e: any) {
            console.error(`  Error fetching engagement for ${clientName} ${platform}:`, e.message);
          }
        }

        // 3. Fetch total content count via CSV (and calculate TikTok engagement)
        try {
          const csv = await fetchMetricoolCSV(`/api/v2/analytics/posts/${platform}`, params);
          const lines = csv.split('\n').filter(l => l.trim());
          totalContent = Math.max(0, lines.length - 1); // Subtract header

          // IMPORTANT: For Instagram/Facebook, CSV endpoints can undercount reels.
          // Prefer Metricool timelines postsCount (matches dashboard), but keep CSV as fallback.
          if (platform === "instagram" || platform === "facebook") {
            try {
              const pcData = await fetchMetricool("/api/v2/analytics/timelines", {
                ...params,
                metric: "postsCount",
                subject: "account",
              });

              let points: any[] = [];
              if (Array.isArray(pcData) && pcData[0]?.values) {
                points = pcData[0].values;
              } else if (Array.isArray(pcData)) {
                points = pcData;
              } else if (pcData?.data && Array.isArray(pcData.data)) {
                const series = pcData.data.find((s: any) => (s.metric || "").toLowerCase() === "postscount");
                if (series?.values) points = series.values;
              }

              const timelineCount = points.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
              if (timelineCount > 0) {
                totalContent = Math.max(totalContent ?? 0, timelineCount);
                console.log(`  ${platform} postsCount from timelines: ${timelineCount} (final totalContent=${totalContent})`);
              }
            } catch (e: any) {
              console.error(`  Error fetching postsCount timeline for ${clientName} ${platform}:`, e.message);
            }
          }
          
          // IMPORTANT: For TikTok, fetch from timelines API with "videos" metric + "video" subject
          // This matches metricool-social-weekly and accurately counts all TikTok content
          if (platform === "tiktok") {
            try {
              const tiktokData = await fetchMetricool("/api/v2/analytics/timelines", {
                ...params,
                metric: "videos",
                subject: "video",
              });

              let points: any[] = [];
              if (Array.isArray(tiktokData) && tiktokData[0]?.values) {
                points = tiktokData[0].values;
              } else if (Array.isArray(tiktokData)) {
                points = tiktokData;
              } else if (tiktokData?.data && Array.isArray(tiktokData.data)) {
                const series = tiktokData.data.find((s: any) => 
                  (s.metric || "").toLowerCase() === "videos" || (s.metric || "").toLowerCase() === "postscount"
                );
                if (series?.values) points = series.values;
              }

              const timelineCount = points.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
              console.log(`  tiktok videos from timelines: ${timelineCount}, CSV count: ${totalContent}`);
              
              // Use whichever is higher - timelines or CSV
              if (timelineCount > 0) {
                totalContent = Math.max(totalContent ?? 0, timelineCount);
              }
              console.log(`  tiktok final totalContent: ${totalContent}`);
            } catch (e: any) {
              console.error(`  Error fetching tiktok videos timeline for ${clientName}:`, e.message);
            }
          }
          
          // For TikTok, calculate engagement from CSV data
          if (platform === "tiktok" && lines.length > 1) {
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            const viewsIdx = headers.findIndex(h => h === 'views');
            const likesIdx = headers.findIndex(h => h === 'likes');
            const commentsIdx = headers.findIndex(h => h === 'comments');
            const sharesIdx = headers.findIndex(h => h === 'shares');
            const engIdx = headers.findIndex(h => h === 'engagement' || h === 'engageme');
            
            let totalEngagement = 0;
            let postCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
              let postEngagement = 0;
              
              // Try to get engagement directly first
              if (engIdx >= 0) {
                postEngagement = parseFloat(values[engIdx]) || 0;
              }
              
              // If no engagement value, calculate from views/likes/comments/shares
              if (postEngagement === 0 && viewsIdx >= 0) {
                const views = parseInt(values[viewsIdx]) || 0;
                const likes = likesIdx >= 0 ? (parseInt(values[likesIdx]) || 0) : 0;
                const comments = commentsIdx >= 0 ? (parseInt(values[commentsIdx]) || 0) : 0;
                const shares = sharesIdx >= 0 ? (parseInt(values[sharesIdx]) || 0) : 0;
                
                if (views > 0) {
                  postEngagement = ((likes + comments + shares) / views) * 100;
                }
              }
              
              totalEngagement += postEngagement;
              postCount++;
            }
            
            if (postCount > 0) {
              engagementRate = totalEngagement / postCount;
              console.log(`  tiktok avg engagement (${postCount} posts): ${engagementRate.toFixed(2)}%`);
            }
          }
          
          console.log(`  ${platform} content count: ${totalContent}`);
        } catch (e: any) {
          console.error(`  Error fetching posts for ${clientName} ${platform}:`, e.message);
        }

        // 4. Fetch and persist follower timeline (for charts)
        if (platform === "tiktok" || platform === "instagram" || platform === "facebook") {
          try {
            const timelineData = await fetchMetricool("/api/v2/analytics/timelines", {
              ...params,
              metric: followersMetric,
              subject: "account",
            });
            
            let points: any[] = [];
            if (Array.isArray(timelineData) && timelineData[0]?.values) {
              // Format: [{metric: "...", values: [{dateTime, value}]}]
              points = timelineData[0].values;
            } else if (Array.isArray(timelineData)) {
              points = timelineData;
            } else if (timelineData?.data?.values) {
              points = timelineData.data.values;
            } else if (Array.isArray(timelineData?.data)) {
              points = timelineData.data;
            }
            
            // Persist each daily follower count
            let persistedCount = 0;
            console.log(`  ${platform} timeline raw points:`, JSON.stringify(points.slice(0, 2)));
            
            const timelineRecords = points.map((point: any) => {
              const dateStr = point.dateTime || point.date || point.timestamp;
              if (!dateStr) return null;
              const date = String(dateStr).split('T')[0];
              const followerCount = point.value ?? point.followers ?? point.count ?? 0;
              return {
                client_id: clientId,
                platform,
                date,
                followers: followerCount,
                collected_at: new Date().toISOString(),
              };
            }).filter(Boolean);
            
            if (timelineRecords.length > 0) {
              const dates = timelineRecords.map((r: any) => r.date);
              await supabase.from("social_follower_timeline").delete()
                .eq("client_id", clientId).eq("platform", platform).in("date", dates);
              
              const { error: tlError, data: insertedData } = await supabase
                .from("social_follower_timeline").insert(timelineRecords).select();
              
              if (tlError) {
                console.error(`  Timeline insert error:`, tlError.message);
              } else {
                persistedCount = insertedData?.length || 0;
              }
            }
            console.log(`  ${platform} timeline: ${persistedCount}/${points.length} data points persisted`);
          } catch (e: any) {
            console.error(`  Error fetching timeline for ${clientName} ${platform}:`, e.message);
          }
        }

        // 5. Fetch and persist demographics (gender, country) for TikTok
        if (platform === "tiktok") {
          try {
            // Demographics need 30-day window
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const demoFrom = formatDate(thirtyDaysAgo);
            const demoTo = formatDate(new Date());
            
            const demoParams = buildParams(userId, blogId, platform, demoFrom, demoTo);
            
            let genderMale: number | null = null;
            let genderFemale: number | null = null;
            let genderUnknown: number | null = null;
            let countries: any[] = [];
            
            // Fetch gender demographics
            try {
              const genderData = await fetchMetricool("/api/v2/analytics/aggregation", {
                ...demoParams,
                metric: "followers_gender",
                subject: "account",
              });
              
              if (genderData && Array.isArray(genderData.data)) {
                for (const item of genderData.data) {
                  const label = (item.metric || item.label || item.gender || "").toLowerCase();
                  const value = item.value || item.percentage || 0;
                  
                  if (label.includes("male") && !label.includes("female")) {
                    genderMale = value;
                  } else if (label.includes("female")) {
                    genderFemale = value;
                  } else if (label.includes("unknown") || label.includes("other")) {
                    genderUnknown = value;
                  }
                }
              } else if (genderData?.male !== undefined || genderData?.female !== undefined) {
                genderMale = genderData.male || 0;
                genderFemale = genderData.female || 0;
                genderUnknown = genderData.unknown || 0;
              }
              console.log(`  ${platform} gender: M=${genderMale}% F=${genderFemale}%`);
            } catch (e: any) {
              console.error(`  Error fetching gender for ${clientName}:`, e.message);
            }
            
            // Fetch country demographics
            try {
              const countryData = await fetchMetricool("/api/v2/analytics/aggregation", {
                ...demoParams,
                metric: "followers_country",
                subject: "account",
              });
              
              if (countryData && Array.isArray(countryData.data)) {
                countries = countryData.data
                  .map((item: any) => ({
                    country: item.country || item.label || item.name || item.metric || "Unknown",
                    percentage: item.percentage || item.value || 0,
                  }))
                  .filter((c: any) => c.percentage > 0)
                  .sort((a: any, b: any) => b.percentage - a.percentage)
                  .slice(0, 10);
              } else if (Array.isArray(countryData)) {
                countries = countryData
                  .map((item: any) => ({
                    country: item.country || item.label || item.name || item.metric || "Unknown",
                    percentage: item.percentage || item.value || 0,
                  }))
                  .filter((c: any) => c.percentage > 0)
                  .sort((a: any, b: any) => b.percentage - a.percentage)
                  .slice(0, 10);
              }
              console.log(`  ${platform} countries: ${countries.length} found`);
            } catch (e: any) {
              console.error(`  Error fetching countries for ${clientName}:`, e.message);
            }
            
            // Persist demographics (delete then insert approach)
            if (genderMale !== null || genderFemale !== null || countries.length > 0) {
              // Delete existing record for this period
              await supabase
                .from("social_account_demographics")
                .delete()
                .eq("client_id", clientId)
                .eq("platform", platform)
                .eq("period_start", from)
                .eq("period_end", to);
              
              const { error: demoError } = await supabase.from("social_account_demographics").insert({
                client_id: clientId,
                platform,
                period_start: from,
                period_end: to,
                gender_male: genderMale,
                gender_female: genderFemale,
                gender_unknown: genderUnknown,
                countries: countries.length > 0 ? countries : null,
                collected_at: new Date().toISOString(),
              });
              
              if (demoError) {
                console.error(`  Error persisting demographics:`, demoError);
              } else {
                console.log(`  ✓ Demographics saved`);
              }
            }
          } catch (e: any) {
            console.error(`  Error in demographics sync for ${clientName}:`, e.message);
          }
        }

        // Store metrics in database
        const validPlatforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'];
        if (validPlatforms.includes(platform)) {
          if (followers !== null || engagementRate !== null || totalContent !== null) {
            const { error: upsertError } = await supabase
              .from("social_account_metrics")
              .upsert({
                client_id: clientId,
                platform: platform as any,
                period_start: from,
                period_end: to,
                followers,
                new_followers: newFollowers,
                engagement_rate: engagementRate,
                total_content: totalContent,
                collected_at: new Date().toISOString(),
              }, {
                onConflict: "client_id,platform,period_start,period_end",
              });

            if (upsertError) {
              console.error(`  Error upserting metrics:`, upsertError);
            } else {
              console.log(`  ✓ Saved to database`);
            }
          }

          // Log sync
          await supabase.from("social_sync_logs").insert({
            client_id: clientId,
            platform: platform as any,
            status: "completed",
            records_synced: 1,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
        }

        results.push({
          clientId,
          clientName,
          platform,
          success: true,
          data: { followers, newFollowers, engagementRate, totalContent },
        });

        console.log(`✓ ${clientName} - ${platform}: followers=${followers}, engagement=${engagementRate?.toFixed(2)}%, content=${totalContent}`);

      } catch (err: any) {
        console.error(`✗ ${clientName} - ${platform}:`, err.message);
        
        const validPlatforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'];
        if (validPlatforms.includes(platform)) {
          await supabase.from("social_sync_logs").insert({
            client_id: clientId,
            platform: platform as any,
            status: "failed",
            error_message: err.message,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
        }

        results.push({
          clientId,
          clientName,
          platform,
          success: false,
          error: err.message,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`\nBulk sync complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        period: { from, to, prevFrom, prevTo },
        totalConfigs: activeConfigs.length,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in bulk-sync-all:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
