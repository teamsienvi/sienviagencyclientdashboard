import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RefreshCw, Search, TrendingUp, TrendingDown, Download, ArrowUpDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DirectMetaAdsSectionProps {
  clientId: string;
  clientName: string;
}

interface MetaAdsRow {
  id: string;
  date_start: string;
  level: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  reach: number;
  link_clicks: number;
  unique_clicks: number | null;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  revenue: number;
  roas: number;
  breakdowns: Record<string, unknown> | null;
}

interface AggregatedData {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  revenue: number;
  roas: number;
}

interface DailyData {
  date: string;
  displayDate: string;
  spend: number;
  impressions: number;
  revenue: number;
  purchases: number;
}

interface CampaignRow {
  id: string;
  name: string;
  breakdownValue: string | null;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  revenue: number;
  roas: number;
}

type SortField = 'name' | 'breakdownValue' | 'spend' | 'impressions' | 'reach' | 'linkClicks' | 'ctr' | 'cpc' | 'cpm' | 'purchases' | 'revenue' | 'roas';

const DirectMetaAdsSection = ({ clientId, clientName }: DirectMetaAdsSectionProps) => {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [level, setLevel] = useState<string>("campaign");
  const [breakdown, setBreakdown] = useState<string>("none");
  
  // Data
  const [rawData, setRawData] = useState<MetaAdsRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDesc, setSortDesc] = useState(true);
  
  // Fetch cached data from database
  const fetchCachedData = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      setLoading(true);
      
      // Build query with breakdown filter
      let query = supabase
        .from('meta_ads_daily')
        .select('*')
        .eq('client_id', clientId)
        .eq('level', level)
        .gte('date_start', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date_start', format(dateRange.to, 'yyyy-MM-dd'));
      
      // Filter by breakdown type
      if (breakdown !== 'none') {
        query = query.not('breakdowns', 'is', null);
        query = query.filter('breakdowns->>type', 'eq', breakdown);
      } else {
        query = query.is('breakdowns', null);
      }
      
      const { data, error } = await query.order('date_start', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match our interface
      const transformedData = (data || []).map(row => ({
        ...row,
        breakdowns: row.breakdowns as Record<string, unknown> | null,
      })) as MetaAdsRow[];
      
      setRawData(transformedData);
    } catch (error) {
      console.error('Error fetching cached data:', error);
      toast.error('Failed to load Meta Ads data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Sync data from Meta API (admin only)
  const handleSync = async () => {
    if (authLoading) return;

    if (!isAdmin) {
      toast.error("Admin only: syncing is restricted");
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    try {
      setSyncing(true);

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: {
          since: format(dateRange.from, "yyyy-MM-dd"),
          until: format(dateRange.to, "yyyy-MM-dd"),
          level,
          breakdowns: breakdown !== "none" ? breakdown : undefined,
          clientId,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Sync failed");
      }

      toast.success(`Synced ${data.inserted ?? 0} rows`);
      await fetchCachedData();
    } catch (error) {
      console.error("Error syncing data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync Meta Ads data");
    } finally {
      setSyncing(false);
    }
  };
  
  useEffect(() => {
    fetchCachedData();
  }, [clientId, dateRange, level, breakdown]);
  
  // Calculate aggregated metrics
  const aggregatedData = useMemo((): AggregatedData => {
    if (rawData.length === 0) {
      return {
        spend: 0,
        impressions: 0,
        reach: 0,
        linkClicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        purchases: 0,
        revenue: 0,
        roas: 0,
      };
    }
    
    const totals = rawData.reduce((acc, row) => ({
      spend: acc.spend + (row.spend || 0),
      impressions: acc.impressions + (row.impressions || 0),
      reach: acc.reach + (row.reach || 0),
      linkClicks: acc.linkClicks + (row.link_clicks || 0),
      purchases: acc.purchases + (row.purchases || 0),
      revenue: acc.revenue + (row.revenue || 0),
    }), { spend: 0, impressions: 0, reach: 0, linkClicks: 0, purchases: 0, revenue: 0 });
    
    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0,
      cpc: totals.linkClicks > 0 ? totals.spend / totals.linkClicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
    };
  }, [rawData]);
  
  // Build daily chart data
  const dailyData = useMemo((): DailyData[] => {
    if (!dateRange?.from || !dateRange?.to || rawData.length === 0) return [];
    
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const dataByDate = new Map<string, { spend: number; impressions: number; revenue: number; purchases: number }>();
    
    rawData.forEach(row => {
      const dateKey = row.date_start;
      const existing = dataByDate.get(dateKey) || { spend: 0, impressions: 0, revenue: 0, purchases: 0 };
      dataByDate.set(dateKey, {
        spend: existing.spend + (row.spend || 0),
        impressions: existing.impressions + (row.impressions || 0),
        revenue: existing.revenue + (row.revenue || 0),
        purchases: existing.purchases + (row.purchases || 0),
      });
    });
    
    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const data = dataByDate.get(dateKey) || { spend: 0, impressions: 0, revenue: 0, purchases: 0 };
      return {
        date: dateKey,
        displayDate: format(day, 'MMM d'),
        ...data,
      };
    });
  }, [rawData, dateRange]);
  
  // Build campaign/adset/ad table data with breakdown support
  const tableData = useMemo((): CampaignRow[] => {
    const grouped = new Map<string, CampaignRow>();
    
    // Helper to get breakdown value from row
    const getBreakdownValue = (row: MetaAdsRow): string | null => {
      if (!row.breakdowns || breakdown === 'none') return null;
      const bd = row.breakdowns as Record<string, string | null>;
      if (breakdown === 'publisher_platform') return bd.publisher_platform || null;
      if (breakdown === 'platform_position') return bd.platform_position || null;
      if (breakdown === 'device_platform') return bd.device_platform || null;
      return null;
    };
    
    rawData.forEach(row => {
      let baseId: string;
      let name: string;
      
      if (level === 'campaign') {
        baseId = row.campaign_id || 'unknown';
        name = row.campaign_name || 'Unknown Campaign';
      } else if (level === 'adset') {
        baseId = row.adset_id || 'unknown';
        name = row.adset_name || 'Unknown Ad Set';
      } else {
        baseId = row.ad_id || 'unknown';
        name = row.ad_name || 'Unknown Ad';
      }
      
      const breakdownValue = getBreakdownValue(row);
      // When breakdown is active, group by baseId + breakdownValue
      const id = breakdown !== 'none' && breakdownValue 
        ? `${baseId}::${breakdownValue}` 
        : baseId;
      
      const existing = grouped.get(id) || {
        id,
        name,
        breakdownValue,
        spend: 0,
        impressions: 0,
        reach: 0,
        linkClicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        purchases: 0,
        revenue: 0,
        roas: 0,
      };
      
      grouped.set(id, {
        ...existing,
        breakdownValue: breakdownValue || existing.breakdownValue,
        spend: existing.spend + (row.spend || 0),
        impressions: existing.impressions + (row.impressions || 0),
        reach: existing.reach + (row.reach || 0),
        linkClicks: existing.linkClicks + (row.link_clicks || 0),
        purchases: existing.purchases + (row.purchases || 0),
        revenue: existing.revenue + (row.revenue || 0),
      });
    });
    
    // Calculate derived metrics
    const rows = Array.from(grouped.values()).map(row => ({
      ...row,
      ctr: row.impressions > 0 ? (row.linkClicks / row.impressions) * 100 : 0,
      cpc: row.linkClicks > 0 ? row.spend / row.linkClicks : 0,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      roas: row.spend > 0 ? row.revenue / row.spend : 0,
    }));
    
    // Filter by search
    const filtered = searchQuery
      ? rows.filter(row => 
          row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (row.breakdownValue && row.breakdownValue.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : rows;
    
    // Sort
    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDesc ? 1 : -1;
      if (bVal === null) return sortDesc ? -1 : 1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [rawData, level, breakdown, searchQuery, sortField, sortDesc]);
  
  // Formatters
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  
  // Metric Card
  const MetricCard = ({ label, value, format: formatFn = formatNumber, info }: { label: string; value: number; format?: (v: number) => string; info?: string }) => (
    <div className="bg-card rounded-lg p-4 border">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {info && (
          <UITooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{info}</p>
            </TooltipContent>
          </UITooltip>
        )}
      </div>
      <p className="text-2xl font-bold">{formatFn(value)}</p>
    </div>
  );
  
  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="capitalize">{entry.name}:</span>
              <span className="font-medium">
                {entry.name === 'spend' || entry.name === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };
  
  if (loading && rawData.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  
  const hasData = rawData.length > 0;
  
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Meta Ads (Direct API)</h2>
          <p className="text-sm text-muted-foreground">{clientName} • Direct Meta Graph API</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          
          {/* Level Selector */}
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campaign">Campaign</SelectItem>
              <SelectItem value="adset">Ad Set</SelectItem>
              <SelectItem value="ad">Ad</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Breakdown Selector */}
          <Select value={breakdown} onValueChange={setBreakdown}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Breakdown" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="publisher_platform">Platform</SelectItem>
              <SelectItem value="platform_position">Placement</SelectItem>
              <SelectItem value="device_platform">Device</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Sync Button (admin only) */}
          {isAdmin ? (
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          ) : (
            <UITooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" disabled>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Admin only</p>
              </TooltipContent>
            </UITooltip>
          )}
        </div>
      </div>
      
      {/* No Data State */}
      {!hasData && !loading && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg text-muted-foreground">No Meta Ads Data</CardTitle>
            <CardDescription>
              Click "Sync Now" to fetch data from Meta Ads API for the selected date range.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* KPI Cards */}
      {hasData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Spend" value={aggregatedData.spend} format={formatCurrency} />
            <MetricCard label="Impressions" value={aggregatedData.impressions} />
            <MetricCard label="Reach" value={aggregatedData.reach} />
            <MetricCard label="Link Clicks" value={aggregatedData.linkClicks} />
            <MetricCard label="CTR" value={aggregatedData.ctr} format={formatPercent} />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="CPC" value={aggregatedData.cpc} format={formatCurrency} />
            <MetricCard label="CPM" value={aggregatedData.cpm} format={formatCurrency} />
            <MetricCard 
              label="Purchases" 
              value={aggregatedData.purchases}
              info="Purchase events tracked via Meta Pixel"
            />
            <MetricCard label="Revenue" value={aggregatedData.revenue} format={formatCurrency} />
            <MetricCard label="ROAS" value={aggregatedData.roas} format={(v) => `${v.toFixed(2)}x`} />
          </div>
          
          {/* Time Series Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spend & Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={dailyData}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="spend" />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="revenue" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Data Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base capitalize">{level}s</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${level}s...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px] cursor-pointer" onClick={() => handleSort('name')}>
                        Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      {breakdown !== 'none' && (
                        <TableHead className="min-w-[120px] cursor-pointer" onClick={() => handleSort('breakdownValue')}>
                          {breakdown === 'publisher_platform' ? 'Platform' : 
                           breakdown === 'platform_position' ? 'Placement' : 
                           breakdown === 'device_platform' ? 'Device' : 'Breakdown'}
                          <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('spend')}>
                        Spend <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('impressions')}>
                        Impr. <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('reach')}>
                        Reach <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('linkClicks')}>
                        Clicks <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('ctr')}>
                        CTR <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('cpc')}>
                        CPC <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('purchases')}>
                        Purch. <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('revenue')}>
                        Revenue <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('roas')}>
                        ROAS <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium truncate max-w-[200px]" title={row.name}>
                          {row.name}
                        </TableCell>
                        {breakdown !== 'none' && (
                          <TableCell className="truncate max-w-[120px]" title={row.breakdownValue || '-'}>
                            <Badge variant="outline" className="font-normal">
                              {row.breakdownValue || '-'}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right">{formatCurrency(row.spend)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.impressions)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.reach)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.linkClicks)}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.ctr)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.cpc)}</TableCell>
                        <TableCell className="text-right">{row.purchases}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="text-right">{row.roas.toFixed(2)}x</TableCell>
                      </TableRow>
                    ))}
                    {tableData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={breakdown !== 'none' ? 11 : 10} className="text-center text-muted-foreground py-8">
                          No {level}s found{breakdown !== 'none' ? ` with ${breakdown.replace('_', ' ')} breakdown` : ''}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DirectMetaAdsSection;
