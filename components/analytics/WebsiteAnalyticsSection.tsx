"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Eye, Clock, TrendingDown, Activity, Globe, Info, ExternalLink } from "lucide-react";
import { format, subDays } from "date-fns";

export function WebsiteAnalyticsSection({ clientId }: { clientId: string }) {
  const [dateRange, setDateRange] = useState<string>("30d");

  // Fetch GA4 config for external link
  const { data: ga4Config } = useQuery({
    queryKey: ["ga4-config", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_ga4_config" as any)
        .select("website_url, ga4_property_id")
        .eq("client_id", clientId)
        .maybeSingle();
      return data as { website_url: string; ga4_property_id: string } | null;
    },
    enabled: !!clientId,
  });

  // Fetch analytics
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ["ga4-analytics", clientId, dateRange],
    queryFn: async () => {
      let days = 30;
      if (dateRange === "7d") days = 7;
      if (dateRange === "90d") days = 90;
      
      const { data, error: invokeError } = await supabase.functions.invoke("fetch-ga4-analytics", {
        body: {
          clientId,
          startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
          endDate: format(new Date(), "yyyy-MM-dd"),
        },
      });

      if (invokeError) throw new Error(invokeError.message || "Failed to fetch analytics");
      if (data?.ok === false) throw new Error(data.error || "Failed to fetch analytics");
      return data;
    },
    enabled: !!clientId && !!ga4Config, // Only run if config exists
  });

  const analytics = analyticsData?.analytics;
  const errorType = analyticsData?.errorType;

  if (!ga4Config) return null; // Hide the section completely if no GA4 config exists for this client

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <Card className="hover:border-primary/40 transition-all shadow-sm bg-card/80 backdrop-blur-sm mt-4 col-span-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 transition-colors">
            <Globe className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Website Traffic
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">GA4</Badge>
            </CardTitle>
            {ga4Config.website_url && (
              <a href={ga4Config.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3" /> {ga4Config.website_url}
              </a>
            )}
          </div>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error || errorType ? (
          <div className="text-center py-8">
            <Info className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {errorType === 'not_configured' ? "GA4 is not fully configured" : "Unable to load analytics"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              Please verify your GA4 Property ID and ensure the service account has Viewer access.
            </p>
          </div>
        ) : analytics ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Visitors</p>
                <Users className="h-4 w-4 text-blue-500/70" />
              </div>
              <p className="text-2xl font-bold text-foreground">{analytics.uniqueVisitors?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Sessions</p>
                <Eye className="h-4 w-4 text-blue-500/70" />
              </div>
              <p className="text-2xl font-bold text-foreground">{analytics.totalSessions?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg. Duration</p>
                <Clock className="h-4 w-4 text-blue-500/70" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatDuration(analytics.avgDuration)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bounce Rate</p>
                <TrendingDown className="h-4 w-4 text-blue-500/70" />
              </div>
              <p className="text-2xl font-bold text-foreground">{analytics.bounceRate?.toFixed(1) || 0}%</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No data available for this date range.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
