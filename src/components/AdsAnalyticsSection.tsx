import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RefreshCw, CalendarIcon, ArrowUp, ArrowDown, Minus, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

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

interface DateRange {
  from: Date;
  to: Date;
}

// Preset options
const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

// Tracked action keys
const TRACKED_ACTIONS = [
  "link_click",
  "landing_page_view",
  "view_content",
  "add_to_cart",
  "purchase",
  "video_view",
  "post_engagement",
  "page_engagement",
  "outbound_click",
];

const AdsAnalyticsSection = ({ clientId, clientName }: AdsAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaAds, setMetaAds] = useState<AdsData | null>(null);
  const [upstreamDebug, setUpstreamDebug] = useState<Record<string, unknown> | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Default to last 7 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: subDays(startOfDay(today), 6),
      to: endOfDay(today),
    };
  });

  const [selectedPreset, setSelectedPreset] = useState<string>("Last 7 days");

  const getPreviousRange = (range: DateRange): DateRange => {
    const daysDiff = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return {
      from: subDays(range.from, daysDiff),
      to: subDays(range.from, 1),
    };
  };

  const fetchAdsData = async () => {
    try {
      const prevRange = getPreviousRange(dateRange);

      const { data, error } = await supabase.functions.invoke("metricool-ads", {
        body: {
          clientId,
          from: format(dateRange.from, "yyyy-MM-dd"),
          to: format(dateRange.to, "yyyy-MM-dd"),
          prevFrom: format(prevRange.from, "yyyy-MM-dd"),
          prevTo: format(prevRange.to, "yyyy-MM-dd"),
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
    setLoading(true);
    fetchAdsData();
  }, [clientId, dateRange]);

  const handlePresetClick = (preset: { label: string; days: number }) => {
    const today = new Date();
    setDateRange({
      from: subDays(startOfDay(today), preset.days - 1),
      to: endOfDay(today),
    });
    setSelectedPreset(preset.label);
    setCalendarOpen(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdsData();
  };

  // Formatters
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "$0.00";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "0";
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "0%";
    return `${value.toFixed(2)}%`;
  };

  // Render WoW change
  const renderDelta = (current: number, previous: number, invertColors = false) => {
    const delta = current - previous;
    const percentChange = previous > 0 ? ((delta / previous) * 100) : 0;
    const isPositive = delta > 0;
    const isNegative = delta < 0;
    
    const colorClass = invertColors
      ? (isNegative ? "text-emerald-600" : isPositive ? "text-rose-600" : "text-muted-foreground")
      : (isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-muted-foreground");
    
    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${colorClass}`}>
        {isPositive && <ArrowUp className="h-4 w-4" />}
        {isNegative && <ArrowDown className="h-4 w-4" />}
        {delta === 0 && <Minus className="h-4 w-4" />}
        <span>{percentChange >= 0 ? "+" : ""}{percentChange.toFixed(1)}%</span>
      </div>
    );
  };

  // Metricool-style KPI Card
  const MetricoolKPICard = ({
    value,
    label,
    bgClass,
    previous,
    invertDelta = false,
  }: {
    value: string;
    label: string;
    bgClass: string;
    previous?: number;
    current?: number;
    invertDelta?: boolean;
  }) => (
    <div className={`rounded-xl p-4 ${bgClass} text-white flex flex-col items-center justify-center min-h-[100px]`}>
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-sm opacity-90 mt-1">{label}</span>
      {previous !== undefined && (
        <div className="mt-2 text-xs opacity-80">
          vs prev: {label.includes("Spent") || label.includes("CPC") || label.includes("CPM") ? formatCurrency(previous) : formatNumber(previous)}
        </div>
      )}
    </div>
  );

  const dateRangeLabel = `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = metaAds !== null;

  return (
    <div className="space-y-6">
      {/* Header with Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <div>
            <h2 className="text-2xl font-bold">Meta Ads</h2>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                {/* Presets */}
                <div className="border-r p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant={selectedPreset === preset.label ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                {/* Calendar */}
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                        setSelectedPreset("");
                        setCalendarOpen(false);
                      } else if (range?.from) {
                        setDateRange({ from: range.from, to: range.from });
                      }
                    }}
                    numberOfMonths={1}
                    className={cn("pointer-events-auto")}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!hasData && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg text-muted-foreground">No Meta Ads Data</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              No campaigns found for {clientName} in this period. Ensure Facebook Ads is connected in Metricool.
              {upstreamDebug && (
                <details className="mt-4 text-xs text-left">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
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
          {/* Reach Section - Metricool Style */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Reach</h3>
                <div className="flex gap-3">
                  <MetricoolKPICard
                    value={formatNumber(metaAds.current.impressions)}
                    label="Impressions"
                    bgClass="bg-indigo-500"
                    previous={metaAds.previous.impressions}
                    current={metaAds.current.impressions}
                  />
                  <MetricoolKPICard
                    value={formatCurrency(metaAds.current.spend)}
                    label="Spent"
                    bgClass="bg-amber-500"
                    previous={metaAds.previous.spend}
                    current={metaAds.current.spend}
                    invertDelta
                  />
                </div>
              </div>
              
              {/* Reach KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/30">
                  <p className="text-xs text-muted-foreground mb-1">Reach</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatNumber(metaAds.current.reach)}</p>
                  {renderDelta(metaAds.current.reach, metaAds.previous.reach)}
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-800/30">
                  <p className="text-xs text-muted-foreground mb-1">Unique Clicks</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{formatNumber(metaAds.current.uniqueClicks)}</p>
                  {renderDelta(metaAds.current.uniqueClicks, metaAds.previous.uniqueClicks)}
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/20 rounded-xl p-4 border border-cyan-200/50 dark:border-cyan-800/30">
                  <p className="text-xs text-muted-foreground mb-1">CPM</p>
                  <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{formatCurrency(metaAds.current.cpm)}</p>
                  {renderDelta(metaAds.current.cpm, metaAds.previous.cpm, true)}
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/20 rounded-xl p-4 border border-teal-200/50 dark:border-teal-800/30">
                  <p className="text-xs text-muted-foreground mb-1">CTR</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{formatPercent(metaAds.current.ctr)}</p>
                  {renderDelta(metaAds.current.ctr, metaAds.previous.ctr)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section - Metricool Style */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Results</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricoolKPICard
                  value={formatNumber(metaAds.current.clicks)}
                  label="Clicks"
                  bgClass="bg-indigo-500"
                  previous={metaAds.previous.clicks}
                  current={metaAds.current.clicks}
                />
                <MetricoolKPICard
                  value={formatNumber(metaAds.current.conversions)}
                  label="Conversions"
                  bgClass="bg-emerald-500"
                  previous={metaAds.previous.conversions}
                  current={metaAds.current.conversions}
                />
                <MetricoolKPICard
                  value={formatCurrency(metaAds.current.spend)}
                  label="Spent"
                  bgClass="bg-amber-500"
                  previous={metaAds.previous.spend}
                  current={metaAds.current.spend}
                  invertDelta
                />
                <MetricoolKPICard
                  value={formatCurrency(metaAds.current.cpc)}
                  label="CPC"
                  bgClass="bg-rose-500"
                  previous={metaAds.previous.cpc}
                  current={metaAds.current.cpc}
                  invertDelta
                />
                <MetricoolKPICard
                  value={formatPercent(metaAds.current.ctr)}
                  label="CTR"
                  bgClass="bg-sky-500"
                  previous={metaAds.previous.ctr}
                  current={metaAds.current.ctr}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions Breakdown */}
          {Object.keys(metaAds.current.actions).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  Actions Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[...TRACKED_ACTIONS, ...Object.keys(metaAds.current.actions).filter(k => !TRACKED_ACTIONS.includes(k))]
                    .filter((actionKey) => {
                      const currentVal = metaAds.current.actions[actionKey] || 0;
                      const prevVal = metaAds.previous.actions[actionKey] || 0;
                      return currentVal > 0 || prevVal > 0;
                    })
                    .map((actionKey) => {
                      const currentVal = metaAds.current.actions[actionKey] || 0;
                      const prevVal = metaAds.previous.actions[actionKey] || 0;
                      
                      return (
                        <div 
                          key={actionKey} 
                          className="bg-muted/50 rounded-lg p-3 border border-border/50"
                        >
                          <p className="text-xs text-muted-foreground mb-1 capitalize truncate" title={actionKey}>
                            {actionKey.replace(/_/g, " ").replace(/\./g, " ")}
                          </p>
                          <p className="text-xl font-bold">{formatNumber(currentVal)}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              vs {formatNumber(prevVal)}
                            </span>
                            {renderDelta(currentVal, prevVal)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaigns Table */}
          {metaAds.current.campaigns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Campaigns ({metaAds.current.campaigns.length})</CardTitle>
                <CardDescription>Sorted by spend (highest first)</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="pl-6">Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right pr-6">Conv.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...metaAds.current.campaigns]
                        .sort((a, b) => b.spent - a.spent)
                        .map((campaign, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/20">
                            <TableCell className="font-medium max-w-[200px] truncate pl-6" title={campaign.name}>
                              {campaign.name}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={campaign.status === "ACTIVE" ? "default" : "secondary"}
                                className={cn(
                                  campaign.status === "ACTIVE" && "bg-emerald-500 hover:bg-emerald-600"
                                )}
                              >
                                {campaign.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatNumber(campaign.impressions)}</TableCell>
                            <TableCell className="text-right font-mono">{formatNumber(campaign.reach)}</TableCell>
                            <TableCell className="text-right font-mono">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                              {formatCurrency(campaign.spent)}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatPercent(campaign.ctr)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(campaign.cpc)}</TableCell>
                            <TableCell className="text-right font-mono pr-6">{formatNumber(campaign.conversions)}</TableCell>
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
