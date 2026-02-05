import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RefreshCw, Search, ArrowUpDown, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

interface MetaAdsManagerReportProps {
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
  breakdowns: {
    type?: string;
    publisher_platform?: string;
    platform_position?: string;
    device_platform?: string;
    impression_device?: string;
  } | null;
}

interface TableRow {
  id: string;
  campaignId: string | null;
  campaignName: string;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  breakdownValue: string | null;
  reach: number;
  impressions: number;
  frequency: number;
  spend: number;
  clicks: number;
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
  purchases: number;
  revenue: number;
  impressions: number;
}

type SortField = keyof Omit<TableRow, 'id' | 'campaignId' | 'adsetId' | 'adId'>;

const OPTIONAL_COLUMNS = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'linkClicks', label: 'Link Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roas', label: 'ROAS' },
] as const;

const MetaAdsManagerReport = ({ clientId, clientName }: MetaAdsManagerReportProps) => {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [level, setLevel] = useState<string>("campaign");
  const [breakdown, setBreakdown] = useState<string>("none");
  const [ungroupBreakdowns, setUngroupBreakdowns] = useState(false);
  
  // Data
  const [rawData, setRawData] = useState<MetaAdsRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDesc, setSortDesc] = useState(true);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['clicks', 'linkClicks', 'ctr', 'purchases', 'revenue', 'roas'])
  );
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Fetch cached data from database
  const fetchCachedData = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      setLoading(true);
      
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
      
      const transformedData = (data || []).map(row => ({
        ...row,
        breakdowns: row.breakdowns as MetaAdsRow['breakdowns'],
      })) as MetaAdsRow[];
      
      setRawData(transformedData);
    } catch (error) {
      console.error('Error fetching cached data:', error);
      toast.error('Failed to load Meta Ads data');
    } finally {
      setLoading(false);
    }
  };
  
  // Sync data from Meta API
  const handleSync = async () => {
    if (authLoading || !isAdmin) {
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

  // Build table data with grouping
  const tableData = useMemo((): TableRow[] => {
    const grouped = new Map<string, TableRow>();
    
    const getBreakdownValue = (row: MetaAdsRow): string | null => {
      if (!row.breakdowns || breakdown === 'none') return null;
      const bd = row.breakdowns;
      if (breakdown === 'publisher_platform') return bd.publisher_platform || null;
      if (breakdown === 'platform_position') return bd.platform_position || null;
      if (breakdown === 'device_platform') return bd.device_platform || null;
      if (breakdown === 'impression_device') return bd.impression_device || null;
      return null;
    };
    
    rawData.forEach(row => {
      let baseId: string;
      let campaignName = row.campaign_name || 'Unknown Campaign';
      let adsetName = level !== 'campaign' ? (row.adset_name || 'Unknown Ad Set') : null;
      let adName = level === 'ad' ? (row.ad_name || 'Unknown Ad') : null;
      
      if (level === 'campaign') {
        baseId = row.campaign_id || 'unknown';
      } else if (level === 'adset') {
        baseId = row.adset_id || 'unknown';
      } else {
        baseId = row.ad_id || 'unknown';
      }
      
      const breakdownValue = getBreakdownValue(row);
      
      // If ungroupBreakdowns is false, aggregate all breakdown values together
      // If true, keep them separate
      const id = (breakdown !== 'none' && ungroupBreakdowns && breakdownValue)
        ? `${baseId}::${breakdownValue}` 
        : baseId;
      
      const existing = grouped.get(id) || {
        id,
        campaignId: row.campaign_id,
        campaignName,
        adsetId: row.adset_id,
        adsetName,
        adId: row.ad_id,
        adName,
        breakdownValue: ungroupBreakdowns ? breakdownValue : null,
        reach: 0,
        impressions: 0,
        frequency: 0,
        spend: 0,
        clicks: 0,
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
        breakdownValue: ungroupBreakdowns ? (breakdownValue || existing.breakdownValue) : null,
        reach: existing.reach + (row.reach || 0),
        impressions: existing.impressions + (row.impressions || 0),
        spend: existing.spend + (row.spend || 0),
        clicks: existing.clicks + (row.link_clicks || 0),
        linkClicks: existing.linkClicks + (row.link_clicks || 0),
        purchases: existing.purchases + (row.purchases || 0),
        revenue: existing.revenue + (row.revenue || 0),
      });
    });
    
    // Calculate derived metrics
    const rows = Array.from(grouped.values()).map(row => ({
      ...row,
      frequency: row.reach > 0 ? row.impressions / row.reach : 0,
      ctr: row.impressions > 0 ? (row.linkClicks / row.impressions) * 100 : 0,
      cpc: row.linkClicks > 0 ? row.spend / row.linkClicks : 0,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      roas: row.spend > 0 ? row.revenue / row.spend : 0,
    }));
    
    // Filter by search
    const filtered = searchQuery
      ? rows.filter(row => {
          const searchLower = searchQuery.toLowerCase();
          return row.campaignName.toLowerCase().includes(searchLower) ||
            (row.adsetName && row.adsetName.toLowerCase().includes(searchLower)) ||
            (row.adName && row.adName.toLowerCase().includes(searchLower)) ||
            (row.breakdownValue && row.breakdownValue.toLowerCase().includes(searchLower));
        })
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
  }, [rawData, level, breakdown, ungroupBreakdowns, searchQuery, sortField, sortDesc]);

  // Calculate totals
  const totals = useMemo(() => {
    const t = tableData.reduce((acc, row) => ({
      reach: acc.reach + row.reach,
      impressions: acc.impressions + row.impressions,
      spend: acc.spend + row.spend,
      clicks: acc.clicks + row.clicks,
      linkClicks: acc.linkClicks + row.linkClicks,
      purchases: acc.purchases + row.purchases,
      revenue: acc.revenue + row.revenue,
    }), { reach: 0, impressions: 0, spend: 0, clicks: 0, linkClicks: 0, purchases: 0, revenue: 0 });

    return {
      ...t,
      frequency: t.reach > 0 ? t.impressions / t.reach : 0,
      ctr: t.impressions > 0 ? (t.linkClicks / t.impressions) * 100 : 0,
      cpc: t.linkClicks > 0 ? t.spend / t.linkClicks : 0,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
    };
  }, [tableData]);

  // Build daily chart data
  const dailyData = useMemo((): DailyData[] => {
    if (!dateRange?.from || !dateRange?.to || rawData.length === 0) return [];
    
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const dataByDate = new Map<string, { spend: number; purchases: number; revenue: number; impressions: number }>();
    
    rawData.forEach(row => {
      const dateKey = row.date_start;
      const existing = dataByDate.get(dateKey) || { spend: 0, purchases: 0, revenue: 0, impressions: 0 };
      dataByDate.set(dateKey, {
        spend: existing.spend + (row.spend || 0),
        purchases: existing.purchases + (row.purchases || 0),
        revenue: existing.revenue + (row.revenue || 0),
        impressions: existing.impressions + (row.impressions || 0),
      });
    });
    
    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const data = dataByDate.get(dateKey) || { spend: 0, purchases: 0, revenue: 0, impressions: 0 };
      return {
        date: dateKey,
        displayDate: format(day, 'MMM d'),
        ...data,
      };
    });
  }, [rawData, dateRange]);
  
  // Formatters
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const toggleColumn = (col: string) => {
    const next = new Set(visibleColumns);
    if (next.has(col)) {
      next.delete(col);
    } else {
      next.add(col);
    }
    setVisibleColumns(next);
  };

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
  
  if (loading && rawData.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  const hasData = rawData.length > 0;
  const showBreakdownColumn = breakdown !== 'none' && ungroupBreakdowns;
  
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Ads Manager Report</h2>
            <p className="text-sm text-muted-foreground">{clientName} • Meta Ads</p>
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Breakdown" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Breakdown</SelectItem>
                <SelectItem value="publisher_platform">Platform</SelectItem>
                <SelectItem value="platform_position">Placement</SelectItem>
                <SelectItem value="device_platform">Device</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Sync Button */}
            {isAdmin ? (
              <Button onClick={handleSync} disabled={syncing} variant="outline">
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Sync"}
              </Button>
            ) : (
              <UITooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" disabled>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync
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

        {/* Secondary controls */}
        {breakdown !== 'none' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="ungroup-breakdowns"
                checked={ungroupBreakdowns}
                onCheckedChange={setUngroupBreakdowns}
              />
              <Label htmlFor="ungroup-breakdowns" className="text-sm">
                Ungroup breakdowns
              </Label>
            </div>
          </div>
        )}
      </div>
      
      {/* No Data State */}
      {!hasData && !loading && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg text-muted-foreground">No Meta Ads Data</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Sync" to fetch data from Meta Ads API for the selected date range.
            </p>
          </CardHeader>
        </Card>
      )}
      
      {hasData && (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#spendGradient)" name="spend" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Purchases & Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={dailyData}>
                    <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="purchases" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="purchases" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="revenue" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base">
                  {level === 'campaign' ? 'Campaigns' : level === 'adset' ? 'Ad Sets' : 'Ads'}
                  <span className="text-muted-foreground font-normal ml-2">({tableData.length})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {/* Column Visibility */}
                  <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings2 className="h-4 w-4 mr-1" />
                        Columns
                        {columnsOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="absolute right-0 mt-2 z-50 bg-background border rounded-lg p-4 shadow-lg min-w-[200px]">
                      <div className="space-y-2">
                        {OPTIONAL_COLUMNS.map(col => (
                          <div key={col.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={col.key}
                              checked={visibleColumns.has(col.key)}
                              onCheckedChange={() => toggleColumn(col.key)}
                            />
                            <label htmlFor={col.key} className="text-sm cursor-pointer">{col.label}</label>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px] cursor-pointer sticky left-0 bg-background z-10" onClick={() => handleSort('campaignName')}>
                        {level === 'campaign' ? 'Campaign' : level === 'adset' ? 'Ad Set' : 'Ad'}
                        <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      {level !== 'campaign' && (
                        <TableHead className="min-w-[140px]">Campaign</TableHead>
                      )}
                      {showBreakdownColumn && (
                        <TableHead className="min-w-[100px] cursor-pointer" onClick={() => handleSort('breakdownValue')}>
                          {breakdown === 'publisher_platform' ? 'Platform' : 
                           breakdown === 'platform_position' ? 'Placement' : 
                           breakdown === 'device_platform' ? 'Device' : 'Breakdown'}
                          <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('reach')}>
                        Reach <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('impressions')}>
                        Impressions <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('frequency')}>
                        Frequency <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('spend')}>
                        Amount Spent <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      {visibleColumns.has('clicks') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('clicks')}>
                          Clicks <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('linkClicks') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('linkClicks')}>
                          Link Clicks <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('ctr') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('ctr')}>
                          CTR <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('cpc') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('cpc')}>
                          CPC <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('cpm') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('cpm')}>
                          CPM <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('purchases') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('purchases')}>
                          Purchases <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('revenue') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('revenue')}>
                          Revenue <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                      {visibleColumns.has('roas') && (
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('roas')}>
                          ROAS <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium truncate max-w-[180px] sticky left-0 bg-background" title={level === 'campaign' ? row.campaignName : level === 'adset' ? row.adsetName || '' : row.adName || ''}>
                          {level === 'campaign' ? row.campaignName : level === 'adset' ? row.adsetName : row.adName}
                        </TableCell>
                        {level !== 'campaign' && (
                          <TableCell className="truncate max-w-[140px] text-muted-foreground" title={row.campaignName}>
                            {row.campaignName}
                          </TableCell>
                        )}
                        {showBreakdownColumn && (
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {row.breakdownValue || '-'}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right">{formatNumber(row.reach)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.impressions)}</TableCell>
                        <TableCell className="text-right">{row.frequency.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.spend)}</TableCell>
                        {visibleColumns.has('clicks') && (
                          <TableCell className="text-right">{formatNumber(row.clicks)}</TableCell>
                        )}
                        {visibleColumns.has('linkClicks') && (
                          <TableCell className="text-right">{formatNumber(row.linkClicks)}</TableCell>
                        )}
                        {visibleColumns.has('ctr') && (
                          <TableCell className="text-right">{formatPercent(row.ctr)}</TableCell>
                        )}
                        {visibleColumns.has('cpc') && (
                          <TableCell className="text-right">{formatCurrency(row.cpc)}</TableCell>
                        )}
                        {visibleColumns.has('cpm') && (
                          <TableCell className="text-right">{formatCurrency(row.cpm)}</TableCell>
                        )}
                        {visibleColumns.has('purchases') && (
                          <TableCell className="text-right">{row.purchases}</TableCell>
                        )}
                        {visibleColumns.has('revenue') && (
                          <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                        )}
                        {visibleColumns.has('roas') && (
                          <TableCell className="text-right">{row.roas.toFixed(2)}x</TableCell>
                        )}
                      </TableRow>
                    ))}
                    
                    {/* Totals Row */}
                    {tableData.length > 0 && (
                      <TableRow className="bg-muted/50 font-semibold border-t-2">
                        <TableCell className="sticky left-0 bg-muted/50">
                          Total ({tableData.length} {level === 'campaign' ? 'campaigns' : level === 'adset' ? 'ad sets' : 'ads'})
                        </TableCell>
                        {level !== 'campaign' && <TableCell />}
                        {showBreakdownColumn && <TableCell />}
                        <TableCell className="text-right">{formatNumber(totals.reach)}</TableCell>
                        <TableCell className="text-right">{formatNumber(totals.impressions)}</TableCell>
                        <TableCell className="text-right">{totals.frequency.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.spend)}</TableCell>
                        {visibleColumns.has('clicks') && (
                          <TableCell className="text-right">{formatNumber(totals.clicks)}</TableCell>
                        )}
                        {visibleColumns.has('linkClicks') && (
                          <TableCell className="text-right">{formatNumber(totals.linkClicks)}</TableCell>
                        )}
                        {visibleColumns.has('ctr') && (
                          <TableCell className="text-right">{formatPercent(totals.ctr)}</TableCell>
                        )}
                        {visibleColumns.has('cpc') && (
                          <TableCell className="text-right">{formatCurrency(totals.cpc)}</TableCell>
                        )}
                        {visibleColumns.has('cpm') && (
                          <TableCell className="text-right">{formatCurrency(totals.cpm)}</TableCell>
                        )}
                        {visibleColumns.has('purchases') && (
                          <TableCell className="text-right">{totals.purchases}</TableCell>
                        )}
                        {visibleColumns.has('revenue') && (
                          <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                        )}
                        {visibleColumns.has('roas') && (
                          <TableCell className="text-right">{totals.roas.toFixed(2)}x</TableCell>
                        )}
                      </TableRow>
                    )}
                    
                    {tableData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={20} className="text-center text-muted-foreground py-8">
                          No data found for the selected filters
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

export default MetaAdsManagerReport;
