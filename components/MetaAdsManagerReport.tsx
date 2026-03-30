import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RefreshCw, Search, ChevronDown, ChevronRight, ChevronUp, Settings2 } from "lucide-react";
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
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  } | null;
}

interface TableRowData {
  id: string;
  entityId: string;
  name: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
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
  children?: BreakdownChild[];
}

interface BreakdownChild {
  breakdownKey: string;
  breakdownValue: string;
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

type SortField = 'name' | 'reach' | 'impressions' | 'frequency' | 'spend' | 'clicks' | 'linkClicks' | 'ctr' | 'cpc' | 'cpm' | 'purchases' | 'revenue' | 'roas';

const COLUMN_PRESETS = {
  performance: ['clicks', 'linkClicks', 'ctr', 'cpc', 'cpm'],
  delivery: ['reach', 'impressions', 'frequency'],
  conversions: ['purchases', 'revenue', 'roas'],
  all: ['clicks', 'linkClicks', 'ctr', 'cpc', 'cpm', 'purchases', 'revenue', 'roas'],
} as const;

const OPTIONAL_COLUMNS = [
  { key: 'clicks', label: 'Clicks (All)' },
  { key: 'linkClicks', label: 'Link clicks' },
  { key: 'ctr', label: 'CTR (link click-through rate)' },
  { key: 'cpc', label: 'CPC (cost per link click)' },
  { key: 'cpm', label: 'CPM (cost per 1,000 impressions)' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'revenue', label: 'Purchase conversion value' },
  { key: 'roas', label: 'Purchase ROAS' },
] as const;

const MetaAdsManagerReport = ({ clientId, clientName }: MetaAdsManagerReportProps) => {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Hierarchy navigation
  const [level, setLevel] = useState<string>("campaign");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ level: string; id: string; name: string }>>([]);
  const [filterCampaignId, setFilterCampaignId] = useState<string | null>(null);
  const [filterAdsetId, setFilterAdsetId] = useState<string | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [breakdown, setBreakdown] = useState<string>("none");
  const [ungroupBreakdowns, setUngroupBreakdowns] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Data
  const [rawData, setRawData] = useState<MetaAdsRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDesc, setSortDesc] = useState(true);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['purchases', 'revenue', 'roas'])
  );

  // Fetch cached data from database
  const fetchCachedData = useCallback(async () => {
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
      
      // Apply hierarchy filters
      if (filterCampaignId && (level === 'adset' || level === 'ad')) {
        query = query.eq('campaign_id', filterCampaignId);
      }
      if (filterAdsetId && level === 'ad') {
        query = query.eq('adset_id', filterAdsetId);
      }
      
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
  }, [clientId, dateRange, level, breakdown, filterCampaignId, filterAdsetId]);
  
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

      // Sync all levels
      for (const syncLevel of ['campaign', 'adset', 'ad']) {
        const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
          body: {
            since: format(dateRange.from, "yyyy-MM-dd"),
            until: format(dateRange.to, "yyyy-MM-dd"),
            level: syncLevel,
            breakdowns: breakdown !== "none" ? breakdown : undefined,
            clientId,
          },
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || "Sync failed");
        }
        
        console.log(`Synced ${syncLevel}: ${data.inserted} rows`);
      }

      toast.success("Sync completed");
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
  }, [fetchCachedData]);

  // Build table data with grouping for breakdowns
  const tableData = useMemo((): TableRowData[] => {
    const grouped = new Map<string, TableRowData>();
    
    const getBreakdownValue = (row: MetaAdsRow): { key: string; value: string } | null => {
      if (!row.breakdowns || breakdown === 'none') return null;
      const bd = row.breakdowns;
      if (breakdown === 'publisher_platform' && bd.publisher_platform) {
        return { key: 'Platform', value: bd.publisher_platform };
      }
      if (breakdown === 'platform_position' && bd.platform_position) {
        return { key: 'Placement', value: bd.platform_position };
      }
      if (breakdown === 'device_platform' && bd.device_platform) {
        return { key: 'Device', value: bd.device_platform };
      }
      return null;
    };
    
    rawData.forEach(row => {
      let entityId: string;
      let name: string;
      
      if (level === 'campaign') {
        entityId = row.campaign_id || 'unknown';
        name = row.campaign_name || 'Unknown Campaign';
      } else if (level === 'adset') {
        entityId = row.adset_id || 'unknown';
        name = row.adset_name || 'Unknown Ad Set';
      } else {
        entityId = row.ad_id || 'unknown';
        name = row.ad_name || 'Unknown Ad';
      }
      
      const breakdownInfo = getBreakdownValue(row);
      
      // If ungroupBreakdowns, treat each breakdown value as a separate row
      if (breakdown !== 'none' && ungroupBreakdowns && breakdownInfo) {
        const id = `${entityId}::${breakdownInfo.value}`;
        const existing = grouped.get(id) || {
          id,
          entityId,
          name: `${name} (${breakdownInfo.value})`,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          adsetId: row.adset_id,
          adsetName: row.adset_name,
          adId: row.ad_id,
          adName: row.ad_name,
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
          reach: existing.reach + (row.reach || 0),
          impressions: existing.impressions + (row.impressions || 0),
          spend: existing.spend + (row.spend || 0),
          clicks: existing.clicks + (row.link_clicks || 0),
          linkClicks: existing.linkClicks + (row.link_clicks || 0),
          purchases: existing.purchases + (row.purchases || 0),
          revenue: existing.revenue + (row.revenue || 0),
        });
      } else {
        // Group by entity, aggregate breakdowns as children
        const existing = grouped.get(entityId) || {
          id: entityId,
          entityId,
          name,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          adsetId: row.adset_id,
          adsetName: row.adset_name,
          adId: row.ad_id,
          adName: row.ad_name,
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
          children: breakdown !== 'none' ? [] : undefined,
        };
        
        // Add to parent totals
        existing.reach += row.reach || 0;
        existing.impressions += row.impressions || 0;
        existing.spend += row.spend || 0;
        existing.clicks += row.link_clicks || 0;
        existing.linkClicks += row.link_clicks || 0;
        existing.purchases += row.purchases || 0;
        existing.revenue += row.revenue || 0;
        
        // Add breakdown child if applicable
        if (breakdown !== 'none' && breakdownInfo && existing.children) {
          const existingChild = existing.children.find(c => c.breakdownValue === breakdownInfo.value);
          if (existingChild) {
            existingChild.reach += row.reach || 0;
            existingChild.impressions += row.impressions || 0;
            existingChild.spend += row.spend || 0;
            existingChild.clicks += row.link_clicks || 0;
            existingChild.linkClicks += row.link_clicks || 0;
            existingChild.purchases += row.purchases || 0;
            existingChild.revenue += row.revenue || 0;
          } else {
            existing.children.push({
              breakdownKey: breakdownInfo.key,
              breakdownValue: breakdownInfo.value,
              reach: row.reach || 0,
              impressions: row.impressions || 0,
              frequency: 0,
              spend: row.spend || 0,
              clicks: row.link_clicks || 0,
              linkClicks: row.link_clicks || 0,
              ctr: 0,
              cpc: 0,
              cpm: 0,
              purchases: row.purchases || 0,
              revenue: row.revenue || 0,
              roas: 0,
            });
          }
        }
        
        grouped.set(entityId, existing);
      }
    });
    
    // Calculate derived metrics
    const rows = Array.from(grouped.values()).map(row => {
      const result = {
        ...row,
        frequency: row.reach > 0 ? row.impressions / row.reach : 0,
        ctr: row.impressions > 0 ? (row.linkClicks / row.impressions) * 100 : 0,
        cpc: row.linkClicks > 0 ? row.spend / row.linkClicks : 0,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
        roas: row.spend > 0 ? row.revenue / row.spend : 0,
      };
      
      // Calculate children metrics
      if (result.children) {
        result.children = result.children.map(child => ({
          ...child,
          frequency: child.reach > 0 ? child.impressions / child.reach : 0,
          ctr: child.impressions > 0 ? (child.linkClicks / child.impressions) * 100 : 0,
          cpc: child.linkClicks > 0 ? child.spend / child.linkClicks : 0,
          cpm: child.impressions > 0 ? (child.spend / child.impressions) * 1000 : 0,
          roas: child.spend > 0 ? child.revenue / child.spend : 0,
        }));
      }
      
      return result;
    });
    
    // Filter by search
    const filtered = searchQuery
      ? rows.filter(row => 
          row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          row.entityId.includes(searchQuery)
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

  const toggleRowExpand = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  // Drilldown handler
  const handleDrilldown = (row: TableRowData) => {
    if (level === 'campaign') {
      setBreadcrumbs([{ level: 'campaign', id: row.entityId, name: row.name }]);
      setFilterCampaignId(row.entityId);
      setLevel('adset');
    } else if (level === 'adset') {
      setBreadcrumbs(prev => [...prev, { level: 'adset', id: row.entityId, name: row.name }]);
      setFilterAdsetId(row.entityId);
      setLevel('ad');
    }
  };

  // Navigate breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Go to root
      setBreadcrumbs([]);
      setFilterCampaignId(null);
      setFilterAdsetId(null);
      setLevel('campaign');
    } else {
      const crumb = breadcrumbs[index];
      if (crumb.level === 'campaign') {
        setBreadcrumbs([crumb]);
        setFilterCampaignId(crumb.id);
        setFilterAdsetId(null);
        setLevel('adset');
      }
    }
  };

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    setBreadcrumbs([]);
    setFilterCampaignId(null);
    setFilterAdsetId(null);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
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
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-1">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }
  
  const hasData = rawData.length > 0;
  const levelLabel = level === 'campaign' ? 'campaigns' : level === 'adset' ? 'ad sets' : 'ads';
  const hasBreakdownChildren = breakdown !== 'none' && !ungroupBreakdowns;
  
  // Sort indicator
  const SortCaret = ({ field }: { field: SortField }) => (
    <span className={cn("ml-1 inline-flex", sortField === field ? "text-foreground" : "text-muted-foreground/50")}>
      {sortField === field && sortDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
    </span>
  );
  
  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-background sticky top-0 z-20 py-2">
        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 font-normal">
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d, yyyy")}</>
                ) : (
                  format(dateRange.from, "MMM d, yyyy")
                )
              ) : (
                "Select dates"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
        
        {/* Level Tabs */}
        <div className="flex bg-muted rounded-md p-0.5">
          {['campaign', 'adset', 'ad'].map((l) => (
            <button
              key={l}
              onClick={() => handleLevelChange(l)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                level === l ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l === 'campaign' ? 'Campaigns' : l === 'adset' ? 'Ad sets' : 'Ads'}
            </button>
          ))}
        </div>
        
        {/* Breakdown */}
        <Select value={breakdown} onValueChange={setBreakdown}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Breakdown" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No breakdown</SelectItem>
            <SelectItem value="publisher_platform">Platform</SelectItem>
            <SelectItem value="platform_position">Placement</SelectItem>
            <SelectItem value="device_platform">Device</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Ungroup toggle */}
        {breakdown !== 'none' && (
          <div className="flex items-center gap-1.5">
            <Switch
              id="ungroup"
              checked={ungroupBreakdowns}
              onCheckedChange={setUngroupBreakdowns}
              className="scale-75"
            />
            <Label htmlFor="ungroup" className="text-xs text-muted-foreground cursor-pointer">
              Ungroup
            </Label>
          </div>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
        
        {/* Columns */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {OPTIONAL_COLUMNS.map(col => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleColumns.has(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Sync */}
        {isAdmin && (
          <Button onClick={handleSync} disabled={syncing} size="sm" variant="outline" className="h-8 ml-auto">
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", syncing && "animate-spin")} />
            <span className="text-xs">{syncing ? "Syncing..." : "Sync"}</span>
          </Button>
        )}
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => navigateToBreadcrumb(-1)} className="hover:text-foreground">
            All {level === 'adset' || level === 'ad' ? 'Campaigns' : 'Ad sets'}
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button 
                onClick={() => idx < breadcrumbs.length - 1 ? navigateToBreadcrumb(idx) : undefined}
                className={cn(idx < breadcrumbs.length - 1 && "hover:text-foreground")}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Charts */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Daily Spend</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#spendGrad)" strokeWidth={1.5} name="spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Daily Purchases & Revenue</p>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={dailyData}>
                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="purchases" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} name="purchases" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} name="revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasData && !loading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No results for the selected date range</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Sync" to fetch data from Meta Ads API</p>
        </div>
      )}
      
      {/* Table */}
      {hasData && (
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/30 sticky top-0">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead 
                    className="font-medium text-muted-foreground h-9 px-3 min-w-[200px] sticky left-0 bg-muted/30 z-10 cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    {level === 'campaign' ? 'Campaign name' : level === 'adset' ? 'Ad set name' : 'Ad name'}
                    <SortCaret field="name" />
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('reach')}>
                    Reach<SortCaret field="reach" />
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('impressions')}>
                    Impressions<SortCaret field="impressions" />
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('frequency')}>
                    Frequency<SortCaret field="frequency" />
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('spend')}>
                    Amount spent<SortCaret field="spend" />
                  </TableHead>
                  {visibleColumns.has('clicks') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('clicks')}>
                      Clicks (All)<SortCaret field="clicks" />
                    </TableHead>
                  )}
                  {visibleColumns.has('linkClicks') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('linkClicks')}>
                      Link clicks<SortCaret field="linkClicks" />
                    </TableHead>
                  )}
                  {visibleColumns.has('ctr') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('ctr')}>
                      CTR<SortCaret field="ctr" />
                    </TableHead>
                  )}
                  {visibleColumns.has('cpc') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('cpc')}>
                      CPC<SortCaret field="cpc" />
                    </TableHead>
                  )}
                  {visibleColumns.has('cpm') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('cpm')}>
                      CPM<SortCaret field="cpm" />
                    </TableHead>
                  )}
                  {visibleColumns.has('purchases') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('purchases')}>
                      Purchases<SortCaret field="purchases" />
                    </TableHead>
                  )}
                  {visibleColumns.has('revenue') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('revenue')}>
                      Conv. value<SortCaret field="revenue" />
                    </TableHead>
                  )}
                  {visibleColumns.has('roas') && (
                    <TableHead className="font-medium text-muted-foreground h-9 px-3 text-right cursor-pointer" onClick={() => handleSort('roas')}>
                      ROAS<SortCaret field="roas" />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <>
                    <TableRow key={row.id} className="hover:bg-muted/30 border-b border-border/50">
                      <TableCell className="font-medium px-3 py-2 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1">
                          {hasBreakdownChildren && row.children && row.children.length > 0 && (
                            <button onClick={() => toggleRowExpand(row.id)} className="p-0.5 hover:bg-muted rounded">
                              {expandedRows.has(row.id) ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button 
                            onClick={() => level !== 'ad' && handleDrilldown(row)}
                            className={cn(
                              "truncate max-w-[180px] text-left",
                              level !== 'ad' && "hover:text-primary hover:underline cursor-pointer"
                            )}
                            title={row.name}
                          >
                            {row.name}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-3 py-2 tabular-nums">{formatNumber(row.reach)}</TableCell>
                      <TableCell className="text-right px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</TableCell>
                      <TableCell className="text-right px-3 py-2 tabular-nums">{row.frequency.toFixed(2)}</TableCell>
                      <TableCell className="text-right px-3 py-2 tabular-nums font-medium">{formatCurrency(row.spend)}</TableCell>
                      {visibleColumns.has('clicks') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</TableCell>
                      )}
                      {visibleColumns.has('linkClicks') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatNumber(row.linkClicks)}</TableCell>
                      )}
                      {visibleColumns.has('ctr') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</TableCell>
                      )}
                      {visibleColumns.has('cpc') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatCurrency(row.cpc)}</TableCell>
                      )}
                      {visibleColumns.has('cpm') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatCurrency(row.cpm)}</TableCell>
                      )}
                      {visibleColumns.has('purchases') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{row.purchases}</TableCell>
                      )}
                      {visibleColumns.has('revenue') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                      )}
                      {visibleColumns.has('roas') && (
                        <TableCell className="text-right px-3 py-2 tabular-nums">{row.roas.toFixed(2)}x</TableCell>
                      )}
                    </TableRow>
                    
                    {/* Breakdown children */}
                    {hasBreakdownChildren && expandedRows.has(row.id) && row.children?.map((child) => (
                      <TableRow key={`${row.id}-${child.breakdownValue}`} className="bg-muted/10 hover:bg-muted/20 border-b border-border/30">
                        <TableCell className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10">
                          <span className="pl-6 text-muted-foreground flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                              {child.breakdownValue}
                            </Badge>
                          </span>
                        </TableCell>
                        <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatNumber(child.reach)}</TableCell>
                        <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatNumber(child.impressions)}</TableCell>
                        <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{child.frequency.toFixed(2)}</TableCell>
                        <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatCurrency(child.spend)}</TableCell>
                        {visibleColumns.has('clicks') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatNumber(child.clicks)}</TableCell>
                        )}
                        {visibleColumns.has('linkClicks') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatNumber(child.linkClicks)}</TableCell>
                        )}
                        {visibleColumns.has('ctr') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatPercent(child.ctr)}</TableCell>
                        )}
                        {visibleColumns.has('cpc') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatCurrency(child.cpc)}</TableCell>
                        )}
                        {visibleColumns.has('cpm') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatCurrency(child.cpm)}</TableCell>
                        )}
                        {visibleColumns.has('purchases') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{child.purchases}</TableCell>
                        )}
                        {visibleColumns.has('revenue') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{formatCurrency(child.revenue)}</TableCell>
                        )}
                        {visibleColumns.has('roas') && (
                          <TableCell className="text-right px-3 py-1.5 text-muted-foreground tabular-nums">{child.roas.toFixed(2)}x</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Totals Row */}
          <div className="border-t-2 bg-muted/40 px-3 py-2">
            <div className="flex items-center text-xs">
              <span className="font-semibold min-w-[200px]">
                Results from {tableData.length} {levelLabel}
              </span>
              <div className="flex-1 flex items-center justify-end gap-6 tabular-nums">
                <span><span className="text-muted-foreground">Reach:</span> {formatNumber(totals.reach)}</span>
                <span><span className="text-muted-foreground">Impr:</span> {formatNumber(totals.impressions)}</span>
                <span><span className="text-muted-foreground">Freq:</span> {totals.frequency.toFixed(2)}</span>
                <span className="font-semibold"><span className="text-muted-foreground">Spent:</span> {formatCurrency(totals.spend)}</span>
                {visibleColumns.has('purchases') && (
                  <span><span className="text-muted-foreground">Purch:</span> {totals.purchases}</span>
                )}
                {visibleColumns.has('revenue') && (
                  <span><span className="text-muted-foreground">Value:</span> {formatCurrency(totals.revenue)}</span>
                )}
                {visibleColumns.has('roas') && (
                  <span><span className="text-muted-foreground">ROAS:</span> {totals.roas.toFixed(2)}x</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaAdsManagerReport;
