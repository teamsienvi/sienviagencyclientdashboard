import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings, Users, Eye, Heart, MessageCircle, Share2, TrendingUp, ExternalLink, Save, AlertCircle, Play, Clock, ArrowUp, ArrowDown, Minus, Globe, User } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { getCurrentReportingWeek, formatDateRange } from "@/utils/weeklyDateRange";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DateRangeSelector } from "@/components/DateRangeSelector";

interface MetricoolAnalyticsSectionProps {
  clientId: string;
  clientName: string;
  platform: "tiktok" | "linkedin";
  platformIcon: React.ReactNode;
  platformColor: string;
}

interface MetricoolConfig {
  id: string;
  user_id: string;
  blog_id: string | null;
  is_active: boolean;
  followers: number | null;
}

interface AccountMetric {
  id: string;
  followers: number | null;
  engagement_rate: number | null;
  total_content: number | null;
  period_start: string;
  period_end: string;
  collected_at: string;
}

interface PrevMetrics {
  followers: number | null;
  engagement_rate: number | null;
  total_content: number | null;
  total_views: number | null;
  total_likes: number | null;
}

type DateRangePreset = "7d" | "30d" | "custom";

interface TikTokPost {
  title: string | null;
  date: string | null;
  type: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  duration: string | null;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

interface ContentWithMetrics {
  id: string;
  content_id: string;
  title: string | null;
  url: string | null;
  published_at: string;
  content_type: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
  } | null;
}

interface DemographicsData {
  gender?: { male: number; female: number; unknown?: number };
  countries?: Array<{ country: string; percentage: number }>;
}

const parseMetricoolNumber = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const s = String(value).trim();
  if (!s) return 0;

  // Metricool CSV values may include commas, spaces, or % signs.
  const normalized = s.replace(/[,%\s]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const MetricoolAnalyticsSection = ({
  clientId,
  clientName,
  platform,
  platformIcon,
  platformColor,
}: MetricoolAnalyticsSectionProps) => {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [userId, setUserId] = useState("");
  const [blogId, setBlogId] = useState("");
  const [followers, setFollowers] = useState("");
  
  // Store live data from Metricool API
  const [liveEngagement, setLiveEngagement] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [livePosts, setLivePosts] = useState<TikTokPost[]>([]);
  const [liveFollowers, setLiveFollowers] = useState<number | null>(null);
  const [followerTimeline, setFollowerTimeline] = useState<{ date: string; followers: number }[]>([]);
  const [prevMetrics, setPrevMetrics] = useState<PrevMetrics | null>(null);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>();

  const getDateRange = () => {
    const today = new Date();
    if (dateRangePreset === "custom" && customDateRange) {
      return { start: customDateRange.start, end: customDateRange.end };
    }
    const days = dateRangePreset === "30d" ? 30 : 7;
    return { start: subDays(today, days), end: today };
  };

  const handleDateRangeChange = (preset: DateRangePreset, customRange?: { start: Date; end: Date }) => {
    setDateRangePreset(preset);
    if (preset === "custom" && customRange) {
      setCustomDateRange(customRange);
    }
  };

  // Fetch Metricool config for this client/platform
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["metricool-config", clientId, platform],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_metricool_config")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as MetricoolConfig | null;
    },
  });

  // Automatically fetch live followers from Metricool API on config load
  useQuery({
    queryKey: ["metricool-live-followers", clientId, platform, dateRangePreset, customDateRange?.start?.toISOString(), customDateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!config) return null;
      
      const { start, end } = getDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");
      
      // Calculate previous period
      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStartDate = format(startOfDay(prevStart), "yyyy-MM-dd");
      const prevEndDate = format(endOfDay(prevEnd), "yyyy-MM-dd");
      
      const { data, error } = await supabase.functions.invoke("metricool-tiktok-followers", {
        body: {
          userId: config.user_id,
          blogId: config.blog_id,
          from: `${startDate}T00:00:00+08:00`,
          to: `${endDate}T23:59:59+08:00`,
          timezone: "Asia/Shanghai",
        },
      });
      
      if (!error && data?.success && data?.data?.data?.[0]?.values) {
        const values = data.data.data[0].values;
        if (values.length > 0) {
          // Get last point as current followers
          const sorted = [...values].sort((a: any, b: any) => 
            new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
          );
          const currentFollowers = sorted[0]?.value ?? null;
          if (currentFollowers !== null) {
            setLiveFollowers(currentFollowers);
          }
          
          // Set follower timeline for chart
          const normalizeDateTime = (s: string) => s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
          const formattedTimeline = values.map((point: { dateTime: string; value: number }) => ({
            date: format(new Date(normalizeDateTime(point.dateTime)), "MMM d"),
            followers: point.value ?? 0,
          }));
          setFollowerTimeline(formattedTimeline);
        }
      }
      
      // Also fetch previous period to get WoW comparison
      const { data: prevData } = await supabase.functions.invoke("metricool-tiktok-followers", {
        body: {
          userId: config.user_id,
          blogId: config.blog_id,
          from: `${prevStartDate}T00:00:00+08:00`,
          to: `${prevEndDate}T23:59:59+08:00`,
          timezone: "Asia/Shanghai",
        },
      });
      
      if (prevData?.success && prevData?.data?.data?.[0]?.values) {
        const prevValues = prevData.data.data[0].values;
        if (prevValues.length > 0) {
          const sorted = [...prevValues].sort((a: any, b: any) => 
            new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
          );
          const prevFollowers = sorted[0]?.value ?? null;
          if (prevFollowers !== null) {
            setPrevMetrics(prev => ({
              ...prev,
              followers: prevFollowers,
              engagement_rate: prev?.engagement_rate ?? null,
              total_content: prev?.total_content ?? null,
              total_views: prev?.total_views ?? null,
              total_likes: prev?.total_likes ?? null,
            }));
          }
        }
      }
      
      return data;
    },
    enabled: !!config && platform === "tiktok",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Automatically fetch live followers for LinkedIn using metricool-social-weekly
  useQuery({
    queryKey: ["metricool-linkedin-live-followers", clientId, platform, dateRangePreset, customDateRange?.start?.toISOString(), customDateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!config) return null;
      
      const { start, end } = getDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");
      
      // Calculate previous period
      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStartDate = format(startOfDay(prevStart), "yyyy-MM-dd");
      const prevEndDate = format(endOfDay(prevEnd), "yyyy-MM-dd");
      
      const { data, error } = await supabase.functions.invoke("metricool-social-weekly", {
        body: {
          clientId,
          platform: "linkedin",
          from: startDate,
          to: endDate,
          prevFrom: prevStartDate,
          prevTo: prevEndDate,
          timezone: "America/Chicago",
        },
      });
      
      if (!error && data?.success && data?.data?.current?.followersDebug?.lastPoint) {
        const currentFollowers = data.data.current.followersDebug.lastPoint.value;
        if (currentFollowers !== null && currentFollowers !== undefined) {
          setLiveFollowers(currentFollowers);
        }
        
        // Set timeline if available
        if (data.data.current.followersTimeline?.length > 0) {
          const formattedTimeline = data.data.current.followersTimeline.map((point: { dateTime: string; value: number }) => ({
            date: format(new Date(point.dateTime), "MMM d"),
            followers: point.value ?? 0,
          }));
          setFollowerTimeline(formattedTimeline);
        }
        
        // Get previous period followers
        if (data.data.previous?.followersDebug?.lastPoint) {
          const prevFollowers = data.data.previous.followersDebug.lastPoint.value;
          if (prevFollowers !== null && prevFollowers !== undefined) {
            setPrevMetrics(prev => ({
              ...prev,
              followers: prevFollowers,
              engagement_rate: prev?.engagement_rate ?? null,
              total_content: prev?.total_content ?? null,
              total_views: prev?.total_views ?? null,
              total_likes: prev?.total_likes ?? null,
            }));
          }
        }
      }
      
      return data;
    },
    enabled: !!config && platform === "linkedin",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch latest account metrics with date range
  const { data: accountMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["metricool-account-metrics", clientId, platform, dateRangePreset, customDateRange?.start?.toISOString(), customDateRange?.end?.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");

      // Calculate previous period for comparison
      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStartDate = format(startOfDay(prevStart), "yyyy-MM-dd");
      const prevEndDate = format(endOfDay(prevEnd), "yyyy-MM-dd");

      // Fetch current period metrics
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .lte("period_start", endDate)
        .gte("period_end", startDate)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Fetch previous period metrics
      const { data: prevData } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .lte("period_start", prevEndDate)
        .gte("period_end", prevStartDate)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrevMetrics(prevData ? {
        followers: prevData.followers,
        engagement_rate: prevData.engagement_rate,
        total_content: prevData.total_content,
        total_views: null, // Will be computed from content
        total_likes: null, // Will be computed from content
      } : null);

      return data as AccountMetric | null;
    },
    enabled: !!config,
  });

  // Fetch content with metrics
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["metricool-content", clientId, platform],
    queryFn: async () => {
      // First get content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .order("published_at", { ascending: false })
        .limit(10);

      if (contentError) throw contentError;
      if (!content || content.length === 0) return [];

      // Get metrics for each content
      const contentWithMetrics: ContentWithMetrics[] = await Promise.all(
        content.map(async (c) => {
          const { data: metrics } = await supabase
            .from("social_content_metrics")
            .select("*")
            .eq("social_content_id", c.id)
            .order("collected_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: c.id,
            content_id: c.content_id,
            title: c.title,
            url: c.url,
            published_at: c.published_at,
            content_type: c.content_type,
            metrics: metrics ? {
              // For LinkedIn we persist impressions into `impressions` (and now also `views`).
              // For backwards compatibility, fall back between the two.
              views: metrics.views || metrics.impressions || 0,
              likes: metrics.likes || 0,
              comments: metrics.comments || 0,
              shares: metrics.shares || 0,
              reach: metrics.reach || 0,
              impressions: metrics.impressions || metrics.views || 0,
            } : null,
          };
        })
      );

      return contentWithMetrics;
    },
    enabled: !!config,
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const followersValue = followers ? parseInt(followers, 10) : null;
      const userIdValue = userId || config?.user_id;
      
      if (!userIdValue) {
        throw new Error("User ID is required");
      }
      
      const { error } = await supabase
        .from("client_metricool_config")
        .upsert({
          client_id: clientId,
          platform: platform,
          user_id: userIdValue,
          blog_id: blogId || config?.blog_id || null,
          followers: followersValue !== null && !isNaN(followersValue) ? followersValue : (config?.followers || null),
          is_active: true,
        }, { onConflict: "client_id,platform" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration saved!");
      queryClient.invalidateQueries({ queryKey: ["metricool-config", clientId, platform] });
      setShowConfig(false);
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Sync mutation - uses metricool-tiktok-posts edge function to fetch CSV data
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("No configuration found");
      if (!config.user_id) throw new Error("User ID not configured");

      // Build ISO date strings with timezone offset
      const now = new Date();
      const startDate = subDays(now, 7);
      
      const formatWithOffset = (date: Date, isEnd: boolean, offsetMinutes: number) => {
        // Format date in a fixed-offset "local" time by shifting the timestamp
        const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
        const year = shifted.getUTCFullYear();
        const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
        const day = String(shifted.getUTCDate()).padStart(2, "0");
        const time = isEnd ? "23:59:59" : "00:00:00";

        const sign = offsetMinutes >= 0 ? "+" : "-";
        const abs = Math.abs(offsetMinutes);
        const hh = String(Math.floor(abs / 60)).padStart(2, "0");
        const mm = String(abs % 60).padStart(2, "0");

        return `${year}-${month}-${day}T${time}${sign}${hh}:${mm}`;
      };

      const fromUTC = formatWithOffset(startDate, false, 0);
      const toUTC = formatWithOffset(now, true, 0);

      // Use +08:00 for TikTok follower timelines (Metricool expects offset in from/to)
      const fromShanghai = formatWithOffset(startDate, false, 8 * 60);
      const toShanghai = formatWithOffset(now, true, 8 * 60);

      console.log("Syncing Metricool data:", { 
        clientId, 
        platform, 
        userId: config.user_id, 
        blogId: config.blog_id,
        fromUTC,
        toUTC,
        fromShanghai,
        toShanghai,
      });

      // Fetch posts - use platform-specific endpoints
      let postsPromise: Promise<{ data: any; error: any }>;
      
      if (platform === "linkedin") {
        // For LinkedIn, use metricool-csv to fetch posts from the correct endpoint
        postsPromise = supabase.functions.invoke("metricool-csv", {
          body: {
            path: "/api/v2/analytics/posts/linkedin",
            params: {
              from: fromUTC,
              to: toUTC,
              timezone: "UTC",
              userId: config.user_id,
              blogId: config.blog_id || undefined,
            },
          },
        }).then(result => {
          // Transform CSV response to match our post format
          // LinkedIn CSV columns: Title, Date, URL, Reactions, LikeReactions, PraiseReactions, 
          // AppreciationReactions, EmpathyReactions, InterestReactions, EntertainmentReactions,
          // Comments, Shares, Impressions, Unique Impressions, Engagement, Vid. Views, 
          // Viewers, Time Watched, Time Watched (avg), Type
          if (result.data?.success && result.data?.rows) {
            const transformedRows = result.data.rows.map((row: any) => {
              // Get the LinkedIn URL from the CSV - map from correct column name
              const postUrl = row.url || row.URL || null;
              
              // Validate LinkedIn URL - log error if it contains tiktok.com
              if (postUrl && postUrl.includes("tiktok.com")) {
                console.error("MAPPING ERROR: LinkedIn post has TikTok URL:", postUrl, "Row:", row);
              }
              
              // Parse the date - LinkedIn CSV uses "Date" column
              let displayDate = row.date || row.Date || null;
              if (displayDate) {
                try {
                  // Try various date formats
                  let parsedDate: Date | null = null;
                  
                  if (displayDate.includes("T")) {
                    // ISO format
                    parsedDate = new Date(displayDate);
                  } else if (displayDate.includes("/")) {
                    // MM/DD/YYYY or DD/MM/YYYY format
                    const parts = displayDate.split("/");
                    if (parts.length === 3) {
                      // Assume MM/DD/YYYY
                      parsedDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
                    }
                  } else if (displayDate.includes("-")) {
                    // YYYY-MM-DD format
                    parsedDate = new Date(displayDate);
                  }
                  
                  if (parsedDate && !isNaN(parsedDate.getTime())) {
                    displayDate = format(parsedDate, "MMM d, yyyy");
                  }
                } catch (e) {
                  console.warn("Failed to parse LinkedIn date:", displayDate);
                }
              }
              
              // Map LinkedIn CSV columns (these come from our metricool-csv function)
              const impressions = parseMetricoolNumber(row.impressions ?? row.Impressions);
              const uniqueImpressions = parseMetricoolNumber(
                row.unique_impressions ?? row["Unique Impressions"] ?? row["unique impressions"]
              );

              const reactionsTotal = parseMetricoolNumber(
                row.reactions_total ?? row.reactions ?? row.Reactions
              );
              const reactionsLike = parseMetricoolNumber(
                row.reactions_like ?? row.likereactions ?? row.LikeReactions ?? row["Like Reactions"]
              );

              const comments = parseMetricoolNumber(row.comments ?? row.Comments);
              const shares = parseMetricoolNumber(row.shares ?? row.Shares);
              const vidViews = parseMetricoolNumber(
                row.video_views ?? row.vid_views ?? row["Vid. Views"] ?? row["vid. views"]
              );
              const contentType = row.type || row.Type || "post";

              // Use total reactions as "likes" (fallback to like reactions if total missing)
              const totalReactions = reactionsTotal > 0 ? reactionsTotal : reactionsLike;

              // Compute engagement from CSV or calculate
              let engagement = Number(row.engagement || row.Engagement || 0);
              if (engagement === 0 && impressions > 0) {
                engagement = ((totalReactions + comments + shares) / impressions) * 100;
              }

              return {
                title: row.title || row.Title || null,
                date: displayDate,
                type: contentType,
                views: impressions,
                likes: totalReactions,
                comments: comments,
                shares: shares,
                reach: uniqueImpressions || impressions,
                duration: row.time_watched_total || row.time_watched || row["Time Watched"] || null,
                engagement: engagement,
                url: postUrl,
                link: postUrl,
                image: null,
                // Store raw LinkedIn-specific fields for display
                rawData: {
                  impressions,
                  uniqueImpressions,
                  reactions: reactionsTotal,
                  vidViews,
                  viewers: Number(row.viewers || row.Viewers || 0),
                  timeWatched: row.time_watched_total || row["Time Watched"] || null,
                  avgTimeWatched: row.time_watched_avg || row["Time Watched (avg)"] || null,
                },
              };
            });
            return { data: { success: true, rows: transformedRows, platform: "linkedin" }, error: null };
          }
          
          // Surface upstream errors for debugging
          if (result.data && !result.data.success) {
            console.error("LinkedIn CSV fetch error - upstreamStatus:", result.data.upstreamStatus, "upstreamBody:", result.data.upstreamBody);
          }
          
          return result;
        });
      } else {
        // For TikTok, use the existing endpoint
        postsPromise = supabase.functions.invoke("metricool-tiktok-posts", {
          body: {
            from: fromUTC,
            to: toUTC,
            timezone: "UTC",
            userId: config.user_id,
            blogId: config.blog_id || undefined,
            clientId,
          },
        });
      }

      // Fetch followers for current period
      const followersPromise =
        platform === "tiktok"
          ? supabase.functions.invoke("metricool-tiktok-followers", {
              body: {
                from: fromShanghai,
                to: toShanghai,
                timezone: "Asia/Shanghai",
                userId: config.user_id,
                blogId: config.blog_id,
                clientId, // enable persistence
              },
            })
          : supabase.functions.invoke("metricool-aggregation", {
              body: {
                from: fromUTC,
                to: toUTC,
                metric: "followers",
                network: "linkedin",
                subject: "account",
                userId: config.user_id,
                blogId: config.blog_id || undefined,
              },
            });

      // Fetch followers for previous period (for WoW comparison)
      const prevPeriodEnd = subDays(startDate, 1);
      const prevPeriodStart = subDays(prevPeriodEnd, 7);
      const prevFromUTC = formatWithOffset(prevPeriodStart, false, 0);
      const prevToUTC = formatWithOffset(prevPeriodEnd, true, 0);
      
      const prevFollowersPromise =
        platform === "tiktok"
          ? supabase.functions.invoke("metricool-tiktok-followers", {
              body: {
                from: formatWithOffset(prevPeriodStart, false, 8 * 60),
                to: formatWithOffset(prevPeriodEnd, true, 8 * 60),
                timezone: "Asia/Shanghai",
                userId: config.user_id,
                blogId: config.blog_id,
                clientId, // enable persistence
              },
            })
          : supabase.functions.invoke("metricool-aggregation", {
              body: {
                from: prevFromUTC,
                to: prevToUTC,
                metric: "followers",
                network: "linkedin",
                subject: "account",
                userId: config.user_id,
                blogId: config.blog_id || undefined,
              },
            });

      // Fetch demographics data using the distribution endpoint
      const genderDemographicsPromise = supabase.functions.invoke("metricool-distribution", {
        body: {
          metric: "gender",
          network: platform,
          subject: "account",
          from: fromUTC,
          to: toUTC,
          userId: config.user_id,
          blogId: config.blog_id || undefined,
          clientId, // enable persistence (TikTok)
        },
      });

      // Fetch country demographics
      const countryDemographicsPromise = supabase.functions.invoke("metricool-distribution", {
        body: {
          metric: "country",
          network: platform,
          subject: "account",
          from: fromUTC,
          to: toUTC,
          userId: config.user_id,
          blogId: config.blog_id || undefined,
          clientId, // enable persistence (TikTok)
        },
      });

      const [postsResult, followersResult, prevFollowersResult, genderResult, countryResult] = await Promise.all([
        postsPromise, 
        followersPromise,
        prevFollowersPromise,
        genderDemographicsPromise,
        countryDemographicsPromise
      ]);

      console.log("Posts result:", postsResult);
      console.log("Followers result:", followersResult);
      console.log("Prev Followers result:", prevFollowersResult);

      // Extract follower count - handle both TikTok timeline format and LinkedIn aggregation format
      let persistedFollowers: number | null = null;
      let persistedPrevFollowers: number | null = null;
      const followersData = followersResult.data;
      const prevFollowersData = prevFollowersResult.data;

      // Parse current period followers
      if (!followersResult.error && followersData) {
        if (platform === "tiktok" && followersData?.success && followersData.data) {
          // TikTok timeline format: { data: { data: [{ values: [{ value: ... }] }] } }
          const values =
            followersData.data?.data?.[0]?.values && Array.isArray(followersData.data.data[0].values)
              ? followersData.data.data[0].values
              : [];
          if (values.length > 0) {
            persistedFollowers = values[values.length - 1]?.value ?? null;
          }
        } else if (platform === "linkedin" && followersData?.success) {
          // LinkedIn aggregation format: { success: true, data: number | { value: number } | { total: number } }
          const aggData = followersData.data;
          if (typeof aggData === 'number') {
            persistedFollowers = aggData;
          } else if (aggData?.value !== undefined) {
            persistedFollowers = aggData.value;
          } else if (aggData?.total !== undefined) {
            persistedFollowers = aggData.total;
          } else if (aggData?.followers !== undefined) {
            persistedFollowers = aggData.followers;
          }
          console.log("LinkedIn current followers parsed:", persistedFollowers);
        }
      }

      // Parse previous period followers
      if (!prevFollowersResult.error && prevFollowersData) {
        if (platform === "tiktok" && prevFollowersData?.success && prevFollowersData.data) {
          const values =
            prevFollowersData.data?.data?.[0]?.values && Array.isArray(prevFollowersData.data.data[0].values)
              ? prevFollowersData.data.data[0].values
              : [];
          if (values.length > 0) {
            persistedPrevFollowers = values[values.length - 1]?.value ?? null;
          }
        } else if (platform === "linkedin" && prevFollowersData?.success) {
          const aggData = prevFollowersData.data;
          if (typeof aggData === 'number') {
            persistedPrevFollowers = aggData;
          } else if (aggData?.value !== undefined) {
            persistedPrevFollowers = aggData.value;
          } else if (aggData?.total !== undefined) {
            persistedPrevFollowers = aggData.total;
          } else if (aggData?.followers !== undefined) {
            persistedPrevFollowers = aggData.followers;
          }
          console.log("LinkedIn prev followers parsed:", persistedPrevFollowers);
        }
      }

      // Persist followers to social_account_metrics for current period
      if (persistedFollowers !== null) {
        const now = new Date();
        const periodStartStr = format(startDate, "yyyy-MM-dd");
        const periodEndStr = format(now, "yyyy-MM-dd");

        const { error: upsertError } = await supabase
          .from("social_account_metrics")
          .upsert(
            {
              client_id: clientId,
              platform: platform as "tiktok" | "linkedin",
              followers: persistedFollowers,
              period_start: periodStartStr,
              period_end: periodEndStr,
              collected_at: now.toISOString(),
            },
            { onConflict: "client_id,platform,period_start,period_end" }
          );

        if (upsertError) {
          console.error("Failed to persist current followers:", upsertError);
        } else {
          console.log("Persisted current followers to database:", persistedFollowers);
        }
      }

      // Also persist previous period followers to enable WoW comparison
      if (persistedPrevFollowers !== null) {
        const prevPeriodStartStr = format(prevPeriodStart, "yyyy-MM-dd");
        const prevPeriodEndStr = format(prevPeriodEnd, "yyyy-MM-dd");

        const { error: prevUpsertError } = await supabase
          .from("social_account_metrics")
          .upsert(
            {
              client_id: clientId,
              platform: platform as "tiktok" | "linkedin",
              followers: persistedPrevFollowers,
              period_start: prevPeriodStartStr,
              period_end: prevPeriodEndStr,
              collected_at: new Date().toISOString(),
            },
            { onConflict: "client_id,platform,period_start,period_end" }
          );

        if (prevUpsertError) {
          console.error("Failed to persist previous followers:", prevUpsertError);
        } else {
          console.log("Persisted previous followers to database:", persistedPrevFollowers);
        }
      }

      return { 
        posts: postsResult.data, 
        postsError: postsResult.error,
        followers: followersResult.data,
        followersError: followersResult.error,
        persistedFollowers,
        persistedPrevFollowers,
        genderData: genderResult.data,
        genderError: genderResult.error,
        countryData: countryResult.data,
        countryError: countryResult.error,
      };
    },
    onSuccess: async (result) => {
      const { posts, postsError, followers, followersError } = result;
      
      // Handle posts data
      if (postsError) {
        console.error("Posts sync error:", postsError);
      } else if (posts?.success && posts.rows) {
        setLivePosts(posts.rows);
        
        // Calculate average engagement from posts
        if (posts.rows.length > 0) {
          const avgEngagement = posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.engagement || 0), 0) / posts.rows.length;
          setLiveEngagement(avgEngagement);
        }
        
        // PERSIST POSTS TO DATABASE for LinkedIn
        if (platform === "linkedin" && posts.rows.length > 0) {
          console.log("Persisting LinkedIn posts to database:", posts.rows.length);
          const now = new Date();
          const periodStart = subDays(now, 7).toISOString().split("T")[0];
          const periodEnd = now.toISOString().split("T")[0];
          
          // Calculate totals for account metrics
          const totalImpressions = posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.views || 0), 0);
          const totalReactions = posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.likes || 0), 0);
          const totalComments = posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.comments || 0), 0);
          const totalShares = posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.shares || 0), 0);
          const avgEngagementRate = posts.rows.length > 0 
            ? posts.rows.reduce((sum: number, p: TikTokPost) => sum + (p.engagement || 0), 0) / posts.rows.length
            : 0;
          
          // Upsert account metrics - use persistedFollowers from the mutation result
          const { error: metricsError } = await supabase
            .from("social_account_metrics")
            .upsert({
              client_id: clientId,
              platform: "linkedin",
              period_start: periodStart,
              period_end: periodEnd,
              collected_at: now.toISOString(),
              total_content: posts.rows.length,
              engagement_rate: avgEngagementRate,
              followers: result.persistedFollowers || config?.followers || null,
            }, { onConflict: "client_id,platform,period_start,period_end" });
          
          if (metricsError) {
            console.error("Failed to persist LinkedIn account metrics:", metricsError);
          } else {
            console.log("Persisted LinkedIn account metrics");
          }
          
          // Persist individual posts
          for (const post of posts.rows) {
            const contentId = post.url || `linkedin_${clientId}_${post.date}_${(post.title || "").slice(0, 20)}`;
            
            // Upsert content
            const { data: contentData, error: contentError } = await supabase
              .from("social_content")
              .upsert({
                client_id: clientId,
                platform: "linkedin",
                content_id: contentId,
                content_type: (post.type || "post").toLowerCase() as "post" | "video",
                title: post.title || null,
                url: post.url || null,
                published_at: post.date ? new Date(post.date).toISOString() : now.toISOString(),
              }, { onConflict: "client_id,platform,content_id" })
              .select("id")
              .single();
            
            if (contentError) {
              console.error("Failed to persist LinkedIn content:", contentError);
              continue;
            }
            
            // Upsert content metrics - use the actual unique constraint columns
            const { error: contentMetricsError } = await supabase
              .from("social_content_metrics")
              .upsert({
                social_content_id: contentData.id,
                platform: "linkedin",
                period_start: periodStart,
                period_end: periodEnd,
                collected_at: now.toISOString(),
                // Persist impressions into both columns so UI stays consistent.
                views: post.views || 0,
                impressions: post.views || 0,
                likes: post.likes || 0,
                comments: post.comments || 0,
                shares: post.shares || 0,
                reach: post.reach || 0,
              }, { onConflict: "social_content_id,period_start,period_end" });
            
            if (contentMetricsError) {
              console.error("Failed to persist LinkedIn content metrics:", contentMetricsError);
            }
          }
          console.log("Finished persisting LinkedIn posts to database");
        }
      }

      // Handle followers data
      if (followersError) {
        console.error("Followers sync error:", followersError);
        toast.error(`Followers sync failed: ${followersError.message}`);
      } else if (followers?.error) {
        console.error("Followers upstream error:", followers);
        toast.error(`Followers API error: ${followers.error}`);
      } else if (followers?.success) {
        console.log("Followers raw response:", followers.data);

        if (platform === "tiktok" && followers.data) {
          // TikTok timeline format
          const values =
            followers.data?.data?.[0]?.values && Array.isArray(followers.data.data[0].values)
              ? followers.data.data[0].values
              : [];

          if (values.length > 0) {
            const normalizeDateTime = (s: string) => {
              // Metricool sometimes returns +0100 (no colon). Normalize to +01:00 for Date parsing.
              return s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
            };

            const formattedTimeline = values.map((point: { dateTime: string; value: number }) => ({
              date: format(new Date(normalizeDateTime(point.dateTime)), "MMM d"),
              followers: point.value ?? 0,
            }));

            setFollowerTimeline(formattedTimeline);
          } else {
            setFollowerTimeline([]);
          }
        }
        
        // Set live followers from persisted value
        setLiveFollowers(result.persistedFollowers);
      }

      // Update prevMetrics with fetched previous period followers
      if (result.persistedPrevFollowers !== null) {
        setPrevMetrics(prev => ({
          followers: result.persistedPrevFollowers,
          engagement_rate: prev?.engagement_rate || null,
          total_content: prev?.total_content || null,
          total_views: prev?.total_views || null,
          total_likes: prev?.total_likes || null,
        }));
      }

      // Handle gender demographics
      const demographicsResult: DemographicsData = {};
      
      if (result.genderError) {
        console.error("Gender demographics sync error:", result.genderError);
      } else if (result.genderData?.success && result.genderData.data) {
        console.log("Gender raw data:", result.genderData.data);
        
        const genderData: { male: number; female: number; unknown: number } = {
          male: 0,
          female: 0,
          unknown: 0,
        };
        
        // Metricool returns: { data: [{ key: "M", value: 79 }, { key: "F", value: 21 }, ...] }
        const parseGenderItems = (items: any[]) => {
          for (const item of items) {
            const key = (item.key || item.label || item.name || item.metric || "").toUpperCase();
            const value = item.percentage || item.value || 0;
            
            if (key === "M" || key === "MALE") {
              genderData.male = value;
            } else if (key === "F" || key === "FEMALE") {
              genderData.female = value;
            } else if (key === "U" || key === "UNKNOWN" || key === "OTHER") {
              genderData.unknown = value;
            }
          }
        };
        
        const distData = result.genderData.data;
        if (Array.isArray(distData)) {
          parseGenderItems(distData);
        } else if (distData?.data && Array.isArray(distData.data)) {
          parseGenderItems(distData.data);
        }
        
        if (genderData.male > 0 || genderData.female > 0) {
          demographicsResult.gender = genderData;
        }
      }

      // Handle country demographics
      if (result.countryError) {
        console.error("Country demographics sync error:", result.countryError);
      } else if (result.countryData?.success && result.countryData.data) {
        console.log("Country raw data:", result.countryData.data);
        
        // Metricool returns: { data: [{ key: "US", value: 45 }, { key: "MX", value: 20 }, ...] }
        const countryCodeToName: Record<string, string> = {
          US: "United States", MX: "Mexico", BR: "Brazil", GB: "United Kingdom", CA: "Canada",
          DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", AU: "Australia", IN: "India",
          JP: "Japan", KR: "South Korea", CN: "China", RU: "Russia", AR: "Argentina", CO: "Colombia",
          CL: "Chile", PE: "Peru", VE: "Venezuela", PH: "Philippines", ID: "Indonesia", MY: "Malaysia",
          TH: "Thailand", VN: "Vietnam", SG: "Singapore", NL: "Netherlands", BE: "Belgium", AT: "Austria",
          CH: "Switzerland", PL: "Poland", PT: "Portugal", SE: "Sweden", NO: "Norway", DK: "Denmark",
          FI: "Finland", IE: "Ireland", NZ: "New Zealand", ZA: "South Africa", EG: "Egypt", NG: "Nigeria",
          SA: "Saudi Arabia", AE: "UAE", TR: "Turkey", IL: "Israel", PK: "Pakistan", BD: "Bangladesh",
          UA: "Ukraine", RO: "Romania", CZ: "Czech Republic", HU: "Hungary", GR: "Greece", TW: "Taiwan",
        };
        
        const parseCountryItems = (items: any[]): Array<{ country: string; percentage: number }> => {
          return items
            .map((item) => {
              const code = item.key || item.label || item.name || "Unknown";
              return {
                country: countryCodeToName[code] || code,
                percentage: item.percentage || item.value || 0,
              };
            })
            .filter((c) => c.percentage > 0)
            .sort((a, b) => b.percentage - a.percentage);
        };
        
        const countryDistData = result.countryData.data;
        let countries: Array<{ country: string; percentage: number }> = [];
        
        if (Array.isArray(countryDistData)) {
          countries = parseCountryItems(countryDistData);
        } else if (countryDistData?.data && Array.isArray(countryDistData.data)) {
          countries = parseCountryItems(countryDistData.data);
        }
        
        if (countries.length > 0) {
          demographicsResult.countries = countries;
        }
      }
      
      if (demographicsResult.gender || demographicsResult.countries) {
        setDemographics(demographicsResult);
      }

      setLastSyncTime(new Date());
      
      const postsCount = posts?.rows?.length || 0;
      const platformName = platform === "linkedin" ? "LinkedIn" : "TikTok";
      toast.success(`Synced ${postsCount} ${platformName} posts from Metricool`);
      
      queryClient.invalidateQueries({ queryKey: ["metricool-account-metrics", clientId, platform] });
      queryClient.invalidateQueries({ queryKey: ["metricool-content", clientId, platform] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (configLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // No config - show setup
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {platformIcon}
            <span className={platformColor}>
              {platform === "tiktok" ? "TikTok" : "LinkedIn"} Analytics
            </span>
          </CardTitle>
          <CardDescription>
            Connect your Metricool account to sync {platform === "tiktok" ? "TikTok" : "LinkedIn"} analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Setup Required</p>
              <p>Enter your Metricool User ID to start syncing analytics data for {clientName}.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="userId">Metricool User ID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your Metricool user ID"
              />
            </div>
            <div>
              <Label htmlFor="blogId">Blog ID (Optional)</Label>
              <Input
                id="blogId"
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
                placeholder="Leave empty to auto-detect"
              />
            </div>
            <div>
              <Label htmlFor="initFollowers">Current Followers (Optional)</Label>
              <Input
                id="initFollowers"
                type="number"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder="Enter current follower count"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: used only if follower sync is unavailable.
              </p>
            </div>
            <Button
              onClick={() => saveConfigMutation.mutate()}
              disabled={!userId || saveConfigMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTrendIndicator = (current: number | null | undefined, previous: number | null | undefined, isPercentage = false, isNumeric = false) => {
    if (current == null || previous == null) return null;
    
    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "0";
    
    if (diff > 0) {
      return (
        <div className="flex items-center text-xs text-green-500 gap-0.5">
          <ArrowUp className="h-3 w-3" />
          <span>{isPercentage ? `+${diff.toFixed(2)}%` : isNumeric ? `+${diff}` : `+${percentChange}%`}</span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center text-xs text-red-500 gap-0.5">
          <ArrowDown className="h-3 w-3" />
          <span>{isPercentage ? `${diff.toFixed(2)}%` : isNumeric ? `${diff}` : `${percentChange}%`}</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-xs text-muted-foreground gap-0.5">
        <Minus className="h-3 w-3" />
        <span>{isNumeric ? "0" : "0%"}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with date range and sync button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Metricool Connected
          </Badge>
          <DateRangeSelector
            value={dateRangePreset}
            onChange={handleDateRangeChange}
            customRange={customDateRange}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sync Now
        </Button>
      </div>

      {/* Config editor */}
      {showConfig && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label htmlFor="editUserId">Metricool User ID</Label>
              <Input
                id="editUserId"
                value={userId || config.user_id}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editBlogId">Blog ID</Label>
              <Input
                id="editBlogId"
                value={blogId || config.blog_id || ""}
                onChange={(e) => setBlogId(e.target.value)}
                placeholder="Auto-detect"
              />
            </div>
            <div>
              <Label htmlFor="editFollowers">Followers (Manual Entry)</Label>
              <Input
                id="editFollowers"
                type="number"
                value={followers || (config.followers?.toString() ?? "")}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder="Enter current follower count"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: used only if follower sync is unavailable.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => saveConfigMutation.mutate()}
              disabled={saveConfigMutation.isPending}
            >
              Update Configuration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Metrics Overview - 6 cards like other platforms */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
              {liveFollowers !== null && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
              )}
            </div>
            {metricsLoading && configLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <p className="text-2xl font-bold">
                  {formatNumber(liveFollowers ?? config?.followers ?? accountMetrics?.followers ?? null)}
                </p>
                {prevMetrics?.followers != null && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      vs {formatNumber(prevMetrics.followers)} (prev week)
                    </span>
                    {renderTrendIndicator(
                      liveFollowers ?? config?.followers ?? accountMetrics?.followers,
                      prevMetrics.followers,
                      false,
                      true
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">{platform === "linkedin" ? "Total Impressions" : "Total Views"}</span>
              {livePosts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
              )}
            </div>
            {(() => {
              const currentViews = livePosts.length > 0
                ? livePosts.reduce((sum, p) => sum + (p.views || 0), 0)
                : contentData && contentData.length > 0
                  ? contentData.reduce((sum, c) => sum + (c.metrics?.impressions || c.metrics?.views || 0), 0)
                  : null;
              const prevViews = prevMetrics?.total_views;
              return (
                <>
                  <p className="text-2xl font-bold">
                    {currentViews !== null ? formatNumber(currentViews) : "—"}
                  </p>
                  {prevViews != null && currentViews != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        vs {formatNumber(prevViews)} (prev week)
                      </span>
                      {renderTrendIndicator(currentViews, prevViews, false, true)}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Heart className="h-4 w-4" />
              <span className="text-sm">{platform === "linkedin" ? "Total Reactions" : "Total Likes"}</span>
            </div>
            {(() => {
              const currentLikes = livePosts.length > 0
                ? livePosts.reduce((sum, p) => sum + (p.likes || 0), 0)
                : contentData && contentData.length > 0
                  ? contentData.reduce((sum, c) => sum + (c.metrics?.likes || 0), 0)
                  : null;
              const prevLikes = prevMetrics?.total_likes;
              return (
                <>
                  <p className="text-2xl font-bold">
                    {currentLikes !== null ? formatNumber(currentLikes) : "—"}
                  </p>
                  {prevLikes != null && currentLikes != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        vs {formatNumber(prevLikes)} (prev week)
                      </span>
                      {renderTrendIndicator(currentLikes, prevLikes, false, true)}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Engagement</span>
            </div>
            <p className="text-2xl font-bold">
              {liveEngagement !== null 
                ? `${liveEngagement.toFixed(2)}%`
                : `${accountMetrics?.engagement_rate?.toFixed(2) || "0"}%`
              }
            </p>
            {prevMetrics?.engagement_rate != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevMetrics.engagement_rate.toFixed(2)}% (prev week)
                </span>
                {renderTrendIndicator(
                  liveEngagement ?? accountMetrics?.engagement_rate,
                  prevMetrics.engagement_rate,
                  true
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            {(() => {
              const currentPosts = livePosts.length > 0 
                ? livePosts.length 
                : contentData && contentData.length > 0 
                  ? contentData.length 
                  : null;
              const prevPosts = prevMetrics?.total_content;
              return (
                <>
                  <p className="text-2xl font-bold">
                    {currentPosts !== null ? currentPosts : "—"}
                  </p>
                  {prevPosts != null && currentPosts != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        vs {prevPosts} (prev week)
                      </span>
                      {renderTrendIndicator(currentPosts, prevPosts, false, true)}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Last Synced</span>
            </div>
            {lastSyncTime ? (
              <p className="text-sm font-medium">
                {format(lastSyncTime, "MMM d, h:mm a")}
              </p>
            ) : metricsLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : accountMetrics ? (
              <p className="text-sm font-medium">
                {format(new Date(accountMetrics.collected_at), "MMM d, h:mm a")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Never</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follower Timeline Chart */}
      {followerTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Follower Growth
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">7 Days</Badge>
            </CardTitle>
            <CardDescription>
              Daily follower count over the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followerTimeline}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(value)}
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), "Followers"]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="followers" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demographics Section */}
      {demographics && (demographics.gender || (demographics.countries && demographics.countries.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gender Distribution */}
          {demographics.gender && (demographics.gender.male > 0 || demographics.gender.female > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Gender Distribution
                </CardTitle>
                <CardDescription>
                  Follower breakdown by gender
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-8">
                  <div className="h-[180px] w-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Male", value: demographics.gender.male, fill: "#3b82f6" },
                            { name: "Female", value: demographics.gender.female, fill: "#ec4899" },
                            ...(demographics.gender.unknown && demographics.gender.unknown > 0 
                              ? [{ name: "Unknown", value: demographics.gender.unknown, fill: "#94a3b8" }] 
                              : []),
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                      <span className="text-sm">Male: {demographics.gender.male.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ec4899" }} />
                      <span className="text-sm">Female: {demographics.gender.female.toFixed(1)}%</span>
                    </div>
                    {demographics.gender.unknown && demographics.gender.unknown > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                        <span className="text-sm">Unknown: {demographics.gender.unknown.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Country Distribution */}
          {demographics.countries && demographics.countries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Top Countries
                </CardTitle>
                <CardDescription>
                  Follower breakdown by location
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={demographics.countries.slice(0, 5)}
                      layout="vertical"
                      margin={{ left: 60, right: 20 }}
                    >
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                      <YAxis 
                        dataKey="country" 
                        type="category" 
                        tick={{ fontSize: 12 }}
                        width={55}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "Followers"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="percentage" 
                        fill="#10b981" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Content Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              Recent {platform === "tiktok" ? "Videos" : "Posts"}
              {livePosts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Live</Badge>
              )}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {(() => {
                const { start, end } = getDateRange();
                return formatDateRange(start, end);
              })()}
            </Badge>
          </div>
          <CardDescription>
            Latest {platform === "tiktok" ? "videos" : "posts"} with performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show live posts if available */}
          {livePosts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">{platform === "linkedin" ? "Post" : "Video"}</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Eye className="h-3 w-3" />
                      {platform === "linkedin" ? "Impressions" : "Views"}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" />
                      {platform === "linkedin" ? "Reactions" : "Likes"}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Share2 className="h-3 w-3" />
                      Shares
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Engagement
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livePosts.map((post, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        {(post.url || post.link) ? (
                          <a
                            href={post.url || post.link || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
                            title={post.title || post.url || post.link}
                          >
                            <span className="truncate max-w-[250px]">
                              {post.title || "Untitled"}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <p className="font-medium text-sm truncate max-w-[250px]">
                            {post.title || "Untitled"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {post.date ? (() => {
                            try {
                              const parsed = new Date(post.date);
                              if (!isNaN(parsed.getTime())) {
                                return format(parsed, "EEEE, MMM d");
                              }
                            } catch (e) {}
                            return post.date;
                          })() : "Unknown date"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {post.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.likes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.comments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.shares.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          post.engagement >= 5
                            ? "bg-green-500/20 text-green-600"
                            : post.engagement >= 2
                            ? "bg-yellow-500/20 text-yellow-600"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {post.engagement?.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : contentLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contentData && contentData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Video</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Eye className="h-3 w-3" />
                      Views
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" />
                      Likes
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Share2 className="h-3 w-3" />
                      Shares
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentData.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        {content.url ? (
                          <a
                            href={content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
                            title={content.title || content.url}
                          >
                            <span className="truncate max-w-[250px]">
                              {content.title || "Untitled"}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <p className="font-medium text-sm truncate max-w-[250px]">
                            {content.title || "Untitled"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(content.published_at), "EEEE, MMM d")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(content.metrics?.views || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.likes || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.comments || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.shares || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No content data yet.</p>
              <p className="text-sm">Click "Sync Now" to fetch data from Metricool.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricoolAnalyticsSection;
