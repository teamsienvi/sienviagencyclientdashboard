import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, DollarSign, Eye, MousePointer, Users, ArrowUp, ArrowDown, Minus, Target, Percent, MousePointerClick, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface AdsAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface Campaign {
  name: string;
  status: string;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  spent: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  actions?: Record<string, number>;
}

interface AggregatedData {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actions: Record<string, number>;
  campaigns: Campaign[];
}

interface AdsData {
  current: AggregatedData;
  previous: AggregatedData;
}

// Get the most recent Monday
const getMostRecentMonday = (fromDate: Date = new Date()) => {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysToSubtract);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Tracked action keys
const TRACKED_ACTIONS = [
  "link_click",
  "landing_page_view",
  "view_content",
  "add_to_cart",
  "purchase",
  "video_view",
  "video_play_actions.video_views",
  "video_15_sec_watched_actions.video_views",
  "post_engagement",
  "page_engagement",
  "outbound_click",
];

const AdsAnalyticsSection = ({ clientId, clientName }: AdsAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaAds, setMetaAds] = useState<AdsData | null>(null);
  const [upstreamDebug, setUpstreamDebug] = useState<Record<string, unknown> | null>(null);

  // Get reporting period dates (last completed Mon-Sun)
  const getDateRange = () => {
    const today = new Date();
    const thisMonday = getMostRecentMonday(today);
    const prevMonday = subDays(thisMonday, 7);
    const prevSunday = subDays(thisMonday, 1);
    return { start: prevMonday, end: prevSunday };
  };

  const getPrevDateRange = () => {
    const { start } = getDateRange();
    const prevMonday = subDays(start, 7);
    const prevSunday = subDays(start, 1);
    return { start: prevMonday, end: prevSunday };
  };

  const fetchAdsData = async () => {
    try {
      const { start, end } = getDateRange();
      const { start: prevStart, end: prevEnd } = getPrevDateRange();

      const { data, error } = await supabase.functions.invoke("metricool-ads", {
        body: {
          clientId,
          from: format(start, "yyyy-MM-dd"),
          to: format(end, "yyyy-MM-dd"),
          prevFrom: format(prevStart, "yyyy-MM-dd"),
          prevTo: format(prevEnd, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;

      if (data?.success) {
        setMetaAds(data.data?.metaAds || null);
        if (data.upstreamDebug) {
          setUpstreamDebug(data.upstreamDebug);
        }
      } else if (data?.upstreamDebug) {
        setUpstreamDebug(data.upstreamDebug);
      }
    } catch (error) {
      console.error("Error fetching ads data:", error);
      toast.error("Failed to load ads analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdsData();
  }, [clientId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdsData();
  };

  // Formatters
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return value.toLocaleString();
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  // Render WoW change indicator
  const renderWoW = (current: number | null | undefined, previous: number | null | undefined, isCurrency = false, isPercent = false) => {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    
    const delta = current - previous;
    const isPositive = delta > 0;
    const isNegative = delta < 0;
    
    // For cost metrics (spend, cpc, cpm), down is good
    const invertColors = isCurrency;
    const colorClass = invertColors
      ? (isNegative ? "text-green-500" : isPositive ? "text-red-500" : "text-muted-foreground")
      : (isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground");
    
    const percentChange = previous > 0 ? ((delta / previous) * 100) : null;
    
    const formatDelta = () => {
      if (isCurrency) {
        const sign = delta >= 0 ? "+" : "";
        return `${sign}$${Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (isPercent) {
        const sign = delta >= 0 ? "+" : "";
        return `${sign}${delta.toFixed(2)}%`;
      }
      const sign = delta >= 0 ? "+" : "";
      return `${sign}${delta.toLocaleString()}`;
    };
    
    return (
      <div className={`flex items-center text-xs gap-0.5 mt-1 ${colorClass}`}>
        {isPositive && <ArrowUp className="h-3 w-3" />}
        {isNegative && <ArrowDown className="h-3 w-3" />}
        {delta === 0 && <Minus className="h-3 w-3" />}
        <span className="font-medium">{formatDelta()}</span>
        {percentChange !== null && !isPercent && (
          <span className="text-muted-foreground ml-1">({percentChange >= 0 ? "+" : ""}{percentChange.toFixed(1)}%)</span>
        )}
      </div>
    );
  };

  // Render a single KPI card
  const renderKPICard = (
    label: string,
    icon: React.ReactNode,
    current: number | null | undefined,
    previous: number | null | undefined,
    formatter: (v: number | null | undefined) => string,
    isCurrency = false,
    isPercent = false
  ) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <p className="text-2xl font-bold">
          {formatter(current)}
        </p>
        {previous !== null && previous !== undefined && current !== null && current !== undefined && (
          <>
            <span className="text-xs text-muted-foreground">
              vs {formatter(previous)} (prev week)
            </span>
            {renderWoW(current, previous, isCurrency, isPercent)}
          </>
        )}
      </CardContent>
    </Card>
  );

  const { start, end } = getDateRange();
  const currentLabel = `${format(start, "MMM d")}-${format(end, "d, yyyy")}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = metaAds !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meta Ads Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Reporting Period: {currentLabel}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              No Meta Ads Data Available
            </CardTitle>
            <CardDescription>
              No Meta Ads data found for {clientName}. This could mean:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Facebook Ads account is not connected in Metricool</li>
                <li>No ads were running during the selected period</li>
                <li>Ad spend is $0 for this time range</li>
              </ul>
              {upstreamDebug && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(upstreamDebug, null, 2)}
                  </pre>
                </details>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasData && metaAds && (
        <>
          {/* KPI Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Meta Ads
                <Badge variant="default" className="ml-2 bg-blue-500">Metricool</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {renderKPICard("Ad Spend", <DollarSign className="h-4 w-4" />, metaAds.current.spend, metaAds.previous.spend, formatCurrency, true)}
                {renderKPICard("Impressions", <Eye className="h-4 w-4" />, metaAds.current.impressions, metaAds.previous.impressions, formatNumber)}
                {renderKPICard("Reach", <Users className="h-4 w-4" />, metaAds.current.reach, metaAds.previous.reach, formatNumber)}
                {renderKPICard("Clicks", <MousePointer className="h-4 w-4" />, metaAds.current.clicks, metaAds.previous.clicks, formatNumber)}
                {renderKPICard("Unique Clicks", <MousePointerClick className="h-4 w-4" />, metaAds.current.uniqueClicks, metaAds.previous.uniqueClicks, formatNumber)}
                {renderKPICard("CTR", <Percent className="h-4 w-4" />, metaAds.current.ctr, metaAds.previous.ctr, formatPercent, false, true)}
                {renderKPICard("CPC", <DollarSign className="h-4 w-4" />, metaAds.current.cpc, metaAds.previous.cpc, formatCurrency, true)}
                {renderKPICard("CPM", <DollarSign className="h-4 w-4" />, metaAds.current.cpm, metaAds.previous.cpm, formatCurrency, true)}
                {renderKPICard("Conversions", <Target className="h-4 w-4" />, metaAds.current.conversions, metaAds.previous.conversions, formatNumber)}
              </div>
            </CardContent>
          </Card>

          {/* Actions Breakdown */}
          {Object.keys(metaAds.current.actions).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Actions Breakdown
                </CardTitle>
                <CardDescription>Aggregated action totals across all campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {TRACKED_ACTIONS.map((actionKey) => {
                    const currentVal = metaAds.current.actions[actionKey] || 0;
                    const prevVal = metaAds.previous.actions[actionKey] || 0;
                    
                    // Only show if we have any data for this action
                    if (currentVal === 0 && prevVal === 0) return null;
                    
                    return (
                      <Card key={actionKey}>
                        <CardContent className="pt-4 pb-4">
                          <p className="text-xs text-muted-foreground mb-1 capitalize">
                            {actionKey.replace(/_/g, " ").replace(/\./g, " ")}
                          </p>
                          <p className="text-xl font-bold">{formatNumber(currentVal)}</p>
                          <span className="text-xs text-muted-foreground">
                            vs {formatNumber(prevVal)}
                          </span>
                          {renderWoW(currentVal, prevVal)}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {/* Show any other actions not in TRACKED_ACTIONS */}
                  {Object.entries(metaAds.current.actions)
                    .filter(([key]) => !TRACKED_ACTIONS.includes(key))
                    .map(([key, currentVal]) => {
                      const prevVal = metaAds.previous.actions[key] || 0;
                      if (currentVal === 0 && prevVal === 0) return null;
                      
                      return (
                        <Card key={key}>
                          <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground mb-1 capitalize">
                              {key.replace(/_/g, " ").replace(/\./g, " ")}
                            </p>
                            <p className="text-xl font-bold">{formatNumber(currentVal)}</p>
                            <span className="text-xs text-muted-foreground">
                              vs {formatNumber(prevVal)}
                            </span>
                            {renderWoW(currentVal, prevVal)}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaigns Table */}
          {metaAds.current.campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campaigns ({metaAds.current.campaigns.length})</CardTitle>
                <CardDescription>Individual campaign performance for current period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right">CPM</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...metaAds.current.campaigns]
                        .sort((a, b) => b.spent - a.spent)
                        .map((campaign, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium max-w-[200px] truncate" title={campaign.name}>
                              {campaign.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant={campaign.status === "ACTIVE" ? "default" : "secondary"}>
                                {campaign.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.reach)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.spent)}</TableCell>
                            <TableCell className="text-right">{formatPercent(campaign.ctr)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cpc)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cpm)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.conversions)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AdsAnalyticsSection;
