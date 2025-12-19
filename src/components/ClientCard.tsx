import { useState, useMemo } from "react";
import { Client } from "@/data/clients";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, ChevronRight, ArrowRight, ImageIcon, Upload, Users, TrendingUp, TrendingDown, FileText, Eye, Clock, Layers, Youtube, Twitter } from "lucide-react";
import { CSVUploadDialog } from "@/components/CSVUploadDialog";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientCardProps {
  client: Client;
  clientIndex: number;
  clientId?: string; // Database ID for YouTube analytics
  websiteAnalyticsId?: string; // Database ID for website analytics (only if supabase_url is set)
}

type DateRangePreset = "7d" | "30d" | "custom";

// Helper to extract month from date range (e.g., "Nov 24-30" -> "November")
const getMonthFromDateRange = (dateRange: string): string => {
  const monthMap: Record<string, string> = {
    'Jan': 'January',
    'Feb': 'February',
    'Mar': 'March',
    'Apr': 'April',
    'May': 'May',
    'Jun': 'June',
    'Jul': 'July',
    'Aug': 'August',
    'Sep': 'September',
    'Oct': 'October',
    'Nov': 'November',
    'Dec': 'December'
  };
  
  const match = dateRange.match(/^([A-Za-z]+)/);
  if (match) {
    return monthMap[match[1]] || match[1];
  }
  return dateRange;
};

export const ClientCard = ({ client, clientIndex, clientId, websiteAnalyticsId }: ClientCardProps) => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRangePreset>("7d");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>();
  
  // Fetch website analytics if websiteAnalyticsId is provided
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useClientAnalytics({
    clientId: websiteAnalyticsId || "",
    dateRange,
    startDate: customRange?.start,
    endDate: customRange?.end,
    enabled: !!websiteAnalyticsId,
  });

  const handleDateRangeChange = (preset: DateRangePreset, custom?: { start: Date; end: Date }) => {
    setDateRange(preset);
    if (custom) {
      setCustomRange(custom);
    }
  };
  // Group reports by month
  const reportsByMonth = useMemo(() => {
    const grouped: Record<string, { index: number; report: typeof client.reports[0] }[]> = {};
    
    client.reports.forEach((report, index) => {
      const month = getMonthFromDateRange(report.dateRange);
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push({ index, report });
    });
    
    return grouped;
  }, [client.reports]);
  
  // Get unique months in order (most recent first)
  const months = useMemo(() => {
    return Object.keys(reportsByMonth).reverse();
  }, [reportsByMonth]);
  
  // Get weeks for selected month
  const weeksInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return [];
    return reportsByMonth[selectedMonth] || [];
  }, [selectedMonth, reportsByMonth]);
  
  const handleWeekSelect = (value: string) => {
    const reportIndex = parseInt(value);
    const report = client.reports[reportIndex];
    
    if (report.isInternal) {
      navigate(report.link);
    } else {
      window.open(report.link, '_blank');
    }
  };

  const handleViewLatest = () => {
    if (client.reports.length === 0) return;
    const latestReport = client.reports[client.reports.length - 1];
    if (latestReport.isInternal) {
      navigate(latestReport.link);
    } else {
      window.open(latestReport.link, '_blank');
    }
  };

  // Get the most recent report for display
  const latestReport = client.reports.length > 0 ? client.reports[client.reports.length - 1] : null;

  return (
    <div 
      className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group"
      style={{ animationDelay: `${clientIndex * 100}ms` }}
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo Placeholder */}
            <div className="h-14 w-14 rounded-xl bg-accent border-2 border-dashed border-border flex items-center justify-center overflow-hidden group-hover:border-primary/30 transition-all duration-300">
              {client.logo ? (
                <img 
                  src={client.logo} 
                  alt={`${client.name} logo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-heading font-semibold text-foreground mb-1 group-hover:text-primary transition-colors duration-300">
                {client.name}
              </h3>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {client.reports.length} Weekly Reports
              </p>
            </div>
          </div>
        </div>
        
        {/* Socials Analytics Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Social Media Analytics</h4>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* View Latest Button */}
            <Button
              variant="secondary"
              className="flex-1 justify-between group/btn hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              onClick={handleViewLatest}
              disabled={!latestReport}
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {latestReport ? "View Latest" : "No Reports"}
              </span>
              <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </Button>
            
            {/* CSV Upload Button */}
            <CSVUploadDialog
              clientName={client.name}
              trigger={
                <Button variant="outline" size="icon" className="shrink-0" title="Import CSV">
                  <Upload className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          
          {/* Step 1: Month Selection */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full bg-accent/50 border-border hover:bg-accent hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Browse by month" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border animate-scale-in">
              {months.map((month) => (
                <SelectItem 
                  key={month} 
                  value={month}
                  className="cursor-pointer transition-colors duration-200"
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>{month}</span>
                    <span className="text-xs text-muted-foreground">
                      {reportsByMonth[month].length} {reportsByMonth[month].length === 1 ? 'week' : 'weeks'}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Step 2: Week Selection (only show when month is selected) */}
          {selectedMonth && (
            <div className="animate-slide-down">
              <Select onValueChange={handleWeekSelect}>
                <SelectTrigger className="w-full bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Select week" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border animate-scale-in">
                  {weeksInSelectedMonth.map(({ index, report }) => (
                    <SelectItem 
                      key={index} 
                      value={index.toString()}
                      className="cursor-pointer transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{report.dateRange}</span>
                        {!report.isInternal && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {latestReport && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Latest: {latestReport.dateRange}
            </p>
          )}
        </div>

        {/* Website Analytics Section */}
        {websiteAnalyticsId && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Website Analytics</h4>
              <DateRangeSelector 
                value={dateRange} 
                onChange={handleDateRangeChange}
                customRange={customRange}
              />
            </div>
            
            {analyticsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-accent/50 rounded-lg p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : analyticsError ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-xs text-destructive">Failed to load analytics</p>
              </div>
            ) : analyticsData?.analytics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    <span className="text-xs">Visitors</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {analyticsData.analytics.visitors.toLocaleString()}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Eye className="h-3 w-3" />
                    <span className="text-xs">Page Views</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {analyticsData.analytics.pageViews.toLocaleString()}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Avg Duration</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {analyticsData.analytics.avgDuration < 60 
                      ? `${Math.round(analyticsData.analytics.avgDuration)}s`
                      : `${Math.floor(analyticsData.analytics.avgDuration / 60)}m ${Math.round(analyticsData.analytics.avgDuration % 60)}s`
                    }
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingDown className="h-3 w-3" />
                    <span className="text-xs">Bounce Rate</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {analyticsData.analytics.bounceRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">No analytics configured</p>
              </div>
            )}
          </div>
        )}

        {/* YouTube Analytics Section */}
        {clientId && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
            </div>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate(`/youtube-analytics/${clientId}`)}
            >
              <span className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                View YouTube Analytics
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* X (Twitter) Analytics Section */}
        {clientId && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">X Analytics</h4>
            </div>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate(`/x-analytics/${clientId}`)}
            >
              <span className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-foreground" />
                View X Analytics
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
