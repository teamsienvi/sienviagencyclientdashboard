import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RefreshCw, CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from "recharts";

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

interface TimelineDataPoint {
  date: string;
  value: number;
}

interface TimelineData {
  spend: TimelineDataPoint[];
  impressions: TimelineDataPoint[];
  reach: TimelineDataPoint[];
  clicks: TimelineDataPoint[];
}

interface AdsData {
  current: AggregatedData;
  previous: AggregatedData;
  timeline: TimelineData;
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

const AdsAnalyticsSection = ({ clientId, clientName }: AdsAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaAds, setMetaAds] = useState<AdsData | null>(null);
  const [upstreamDebug, setUpstreamDebug] = useState<Record<string, unknown> | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  
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

  // Merge timeline data into chart-ready format
  const buildChartData = (timeline: TimelineData | undefined) => {
    if (!timeline) return [];
    
    // Create a map of dates to all metrics
    const dateMap = new Map<string, {
      date: string;
      displayDate: string;
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      cpm: number;
      cpc: number;
      ctr: number;
    }>();
    
    // Helper to format date for display
    const formatDisplayDate = (dateStr: string) => {
      try {
        const date = parseISO(dateStr);
        return format(date, "MMM d");
      } catch {
        return dateStr;
      }
    };
    
    // Merge all timeline metrics by date
    timeline.spend.forEach(({ date, value }) => {
      const existing = dateMap.get(date) || { 
        date, displayDate: formatDisplayDate(date), spend: 0, impressions: 0, reach: 0, clicks: 0, cpm: 0, cpc: 0, ctr: 0 
      };
      existing.spend = value;
      dateMap.set(date, existing);
    });
    
    timeline.impressions.forEach(({ date, value }) => {
      const existing = dateMap.get(date) || { 
        date, displayDate: formatDisplayDate(date), spend: 0, impressions: 0, reach: 0, clicks: 0, cpm: 0, cpc: 0, ctr: 0 
      };
      existing.impressions = value;
      dateMap.set(date, existing);
    });
    
    timeline.reach.forEach(({ date, value }) => {
      const existing = dateMap.get(date) || { 
        date, displayDate: formatDisplayDate(date), spend: 0, impressions: 0, reach: 0, clicks: 0, cpm: 0, cpc: 0, ctr: 0 
      };
      existing.reach = value;
      dateMap.set(date, existing);
    });
    
    timeline.clicks.forEach(({ date, value }) => {
      const existing = dateMap.get(date) || { 
        date, displayDate: formatDisplayDate(date), spend: 0, impressions: 0, reach: 0, clicks: 0, cpm: 0, cpc: 0, ctr: 0 
      };
      existing.clicks = value;
      dateMap.set(date, existing);
    });
    
    // Compute rates for each day
    const chartData = Array.from(dateMap.values())
      .map(day => ({
        ...day,
        cpm: day.impressions > 0 ? (day.spend / day.impressions) * 1000 : 0,
        cpc: day.clicks > 0 ? day.spend / day.clicks : 0,
        ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return chartData;
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

  const toggleCampaignExpanded = (campaignName: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignName)) {
        next.delete(campaignName);
      } else {
        next.add(campaignName);
      }
      return next;
    });
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

  // Metricool-style KPI Badge
  const KPIBadge = ({
    value,
    label,
    bgClass,
  }: {
    value: string;
    label: string;
    bgClass: string;
  }) => (
    <div className={`rounded-lg px-4 py-3 ${bgClass} text-white flex flex-col items-center justify-center min-w-[100px]`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs opacity-90">{label}</span>
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
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = metaAds !== null;
  const chartData = hasData ? buildChartData(metaAds.timeline) : [];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize">{entry.name}:</span>
              <span className="font-medium">
                {entry.name === 'spend' || entry.name === 'cpc' || entry.name === 'cpm' 
                  ? formatCurrency(entry.value)
                  : entry.name === 'ctr'
                    ? formatPercent(entry.value)
                    : formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

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
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <h3 className="text-lg font-semibold">Reach</h3>
                <div className="flex gap-2">
                  <KPIBadge
                    value={formatNumber(metaAds.current.impressions)}
                    label="Impressions"
                    bgClass="bg-indigo-500"
                  />
                  <KPIBadge
                    value={formatNumber(metaAds.current.reach)}
                    label="Reach"
                    bgClass="bg-emerald-500"
                  />
                  <KPIBadge
                    value={formatCurrency(metaAds.current.spend)}
                    label="Spent"
                    bgClass="bg-amber-500"
                  />
                </div>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="displayDate" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spend" fill="hsl(45, 93%, 47%)" opacity={0.7} radius={[4, 4, 0, 0]} barSize={24} name="spend" />
                    <Area 
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="hsl(217, 91%, 60%)" 
                      strokeWidth={2}
                      fill="url(#reachGradient)"
                      name="impressions"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Results Section - Metricool Style */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <h3 className="text-lg font-semibold">Results</h3>
                <div className="flex gap-2">
                  <KPIBadge
                    value={formatNumber(metaAds.current.clicks)}
                    label="Clicks"
                    bgClass="bg-emerald-500"
                  />
                  <KPIBadge
                    value={formatCurrency(metaAds.current.spend)}
                    label="Spent"
                    bgClass="bg-violet-500"
                  />
                </div>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="displayDate" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spend" fill="hsl(45, 93%, 47%)" opacity={0.7} radius={[4, 4, 0, 0]} barSize={24} name="spend" />
                    <Area 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="hsl(217, 91%, 60%)" 
                      strokeWidth={2}
                      fill="url(#clicksGradient)"
                      name="clicks"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Performance Section - Metricool Style */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <h3 className="text-lg font-semibold">Performance</h3>
                <div className="flex gap-2">
                  <KPIBadge
                    value={formatCurrency(metaAds.current.cpm)}
                    label="CPM"
                    bgClass="bg-emerald-500"
                  />
                  <KPIBadge
                    value={formatCurrency(metaAds.current.cpc)}
                    label="CPC"
                    bgClass="bg-sky-500"
                  />
                  <KPIBadge
                    value={formatPercent(metaAds.current.ctr)}
                    label="CTR"
                    bgClass="bg-pink-500"
                  />
                  <KPIBadge
                    value={formatCurrency(metaAds.current.spend)}
                    label="Spent"
                    bgClass="bg-violet-500"
                  />
                </div>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="cpmGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="displayDate" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spend" fill="hsl(45, 93%, 47%)" opacity={0.7} radius={[4, 4, 0, 0]} barSize={24} name="spend" />
                    <Area 
                      type="monotone" 
                      dataKey="cpm" 
                      stroke="hsl(217, 91%, 60%)" 
                      strokeWidth={2}
                      fill="url(#cpmGradient)"
                      name="cpm"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns Table with Expandable Actions */}
          {metaAds.current.campaigns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Campaigns ({metaAds.current.campaigns.length})</CardTitle>
                <CardDescription>Click a row to see actions breakdown</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="pl-6 w-8"></TableHead>
                        <TableHead>Campaign</TableHead>
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
                        .map((campaign, idx) => {
                          const hasActions = campaign.actions && Object.keys(campaign.actions).length > 0;
                          const isExpanded = expandedCampaigns.has(campaign.name);
                          
                          return (
                            <>
                              <TableRow 
                                key={idx} 
                                className={cn(
                                  "hover:bg-muted/20",
                                  hasActions && "cursor-pointer"
                                )}
                                onClick={() => hasActions && toggleCampaignExpanded(campaign.name)}
                              >
                                <TableCell className="pl-6 w-8">
                                  {hasActions && (
                                    isExpanded 
                                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium max-w-[200px] truncate" title={campaign.name}>
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
                              
                              {/* Expanded Actions Row */}
                              {isExpanded && hasActions && (
                                <TableRow key={`${idx}-actions`} className="bg-muted/10">
                                  <TableCell colSpan={10} className="px-6 py-4">
                                    <div className="pl-8">
                                      <p className="text-sm font-medium text-muted-foreground mb-3">Actions Breakdown</p>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {Object.entries(campaign.actions!)
                                          .filter(([_, value]) => (value as number) > 0)
                                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                                          .map(([key, value]) => (
                                            <div 
                                              key={key}
                                              className="bg-background rounded-lg p-3 border border-border/50"
                                            >
                                              <p className="text-xs text-muted-foreground truncate capitalize" title={key}>
                                                {key.replace(/_/g, " ").replace(/\./g, " ")}
                                              </p>
                                              <p className="text-lg font-bold">{formatNumber(value as number)}</p>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
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
