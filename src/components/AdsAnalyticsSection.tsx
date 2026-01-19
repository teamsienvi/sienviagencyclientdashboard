import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign, Eye, MousePointer, Users, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Minus, Target, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface AdsAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface AdsWeeklyData {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  conversions: number | null;
}

interface AdsData {
  current: AdsWeeklyData;
  previous: AdsWeeklyData;
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

const AdsAnalyticsSection = ({ clientId, clientName }: AdsAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaAds, setMetaAds] = useState<AdsData | null>(null);
  const [googleAds, setGoogleAds] = useState<AdsData | null>(null);

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
        setGoogleAds(data.data?.googleAds || null);
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

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format number
  const formatNumber = (value: number | null) => {
    if (value === null) return "N/A";
    return value.toLocaleString();
  };

  // Format percentage
  const formatPercent = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  // Render WoW change indicator
  const renderWoW = (current: number | null, previous: number | null, isCurrency = false, isPercent = false) => {
    if (current === null || previous === null) return null;
    
    const delta = current - previous;
    const isPositive = delta > 0;
    const isNegative = delta < 0;
    
    // For cost metrics (spend, cpc, cpm), down is good
    const invertColors = isCurrency;
    const colorClass = invertColors
      ? (isNegative ? "text-green-500" : isPositive ? "text-red-500" : "text-muted-foreground")
      : (isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground");
    
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
      </div>
    );
  };

  // Render a single KPI card
  const renderKPICard = (
    label: string,
    icon: React.ReactNode,
    current: number | null,
    previous: number | null,
    formatter: (v: number | null) => string,
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
        {previous !== null && current !== null && (
          <>
            <span className="text-xs text-muted-foreground">
              vs {formatter(previous)}
            </span>
            {renderWoW(current, previous, isCurrency, isPercent)}
          </>
        )}
      </CardContent>
    </Card>
  );

  // Render platform section
  const renderPlatformSection = (title: string, data: AdsData | null, platformIcon: React.ReactNode) => {
    if (!data) {
      return (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {platformIcon}
              {title}
              <Badge variant="secondary" className="ml-2">Not Connected</Badge>
            </CardTitle>
            <CardDescription>No data available for this platform</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const { current, previous } = data;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {platformIcon}
            {title}
            <Badge variant="default" className="ml-2 bg-blue-500">Metricool</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderKPICard("Ad Spend", <DollarSign className="h-4 w-4" />, current.spend, previous.spend, formatCurrency, true)}
            {renderKPICard("Impressions", <Eye className="h-4 w-4" />, current.impressions, previous.impressions, formatNumber)}
            {renderKPICard("Clicks", <MousePointer className="h-4 w-4" />, current.clicks, previous.clicks, formatNumber)}
            {renderKPICard("Reach", <Users className="h-4 w-4" />, current.reach, previous.reach, formatNumber)}
            {renderKPICard("CPC", <DollarSign className="h-4 w-4" />, current.cpc, previous.cpc, formatCurrency, true)}
            {renderKPICard("CPM", <DollarSign className="h-4 w-4" />, current.cpm, previous.cpm, formatCurrency, true)}
            {renderKPICard("CTR", <Percent className="h-4 w-4" />, current.ctr, previous.ctr, formatPercent, false, true)}
            {renderKPICard("Conversions", <Target className="h-4 w-4" />, current.conversions, previous.conversions, formatNumber)}
          </div>
        </CardContent>
      </Card>
    );
  };

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

  const hasAnyData = metaAds !== null || googleAds !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ads Analytics</h2>
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

      {!hasAnyData && (
        <Card>
          <CardHeader>
            <CardTitle>No Ads Data Available</CardTitle>
            <CardDescription>
              No Meta Ads or Google Ads data found for this client. Make sure ads accounts are connected in Metricool.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {renderPlatformSection(
        "Meta Ads",
        metaAds,
        <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )}

      {renderPlatformSection(
        "Google Ads",
        googleAds,
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
    </div>
  );
};

export default AdsAnalyticsSection;
