import { useState, useMemo, useEffect } from "react";
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
import { Calendar, ExternalLink, ChevronRight, ArrowRight, ImageIcon, Upload, TrendingUp, FileText, Eye, Youtube, Twitter, Music2, Linkedin } from "lucide-react";
import { CSVUploadDialog } from "@/components/CSVUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientCardProps {
  client: Client;
  clientIndex: number;
  clientId?: string; // Database ID for YouTube analytics
  websiteAnalyticsId?: string; // Database ID for website analytics (only if supabase_url is set)
  metricoolPlatforms?: string[]; // Platforms with Metricool config (e.g., ['tiktok', 'linkedin'])
}

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

export const ClientCard = ({ client, clientIndex, clientId, websiteAnalyticsId, metricoolPlatforms }: ClientCardProps) => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [hasXAccount, setHasXAccount] = useState(false);
  const [metaAccounts, setMetaAccounts] = useState<{ facebook: boolean; instagram: boolean }>({ facebook: false, instagram: false });
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  
  // Check if client has connected social accounts
  useEffect(() => {
    const checkSocialAccounts = async () => {
      if (!clientId) return;
      
      // Check X account
      const { data: xData } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .limit(1);
      
      setHasXAccount(xData && xData.length > 0);
      
      // Check Meta OAuth accounts
      const { data: metaData } = await supabase
        .from("social_oauth_accounts")
        .select("platform")
        .eq("client_id", clientId)
        .eq("is_active", true);
      
      if (metaData) {
        setMetaAccounts({
          facebook: metaData.some(acc => acc.platform === "facebook"),
          instagram: metaData.some(acc => acc.platform === "instagram"),
        });
      }
    };
    
    checkSocialAccounts();
  }, [clientId]);

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
  
  const handleConnectMeta = async (platform: "facebook" | "instagram") => {
    if (!clientId) return;
    
    setConnectingPlatform(platform);
    try {
      const redirectUri = `${window.location.origin}/oauth/meta/callback`;
      
      const { data, error } = await supabase.functions.invoke("meta-oauth-init", {
        body: {
          clientId,
          redirectUri,
          platform,
        },
      });

      if (error) throw error;
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error("OAuth init error:", err);
      toast.error("Failed to start Meta connection");
      setConnectingPlatform(null);
    }
  };

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
      className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group cursor-pointer"
      style={{ animationDelay: `${clientIndex * 100}ms` }}
      onClick={() => clientId && navigate(`/client/${clientId}`)}
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
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>{client.reports.length} reports</span>
          </div>
          {metricoolPlatforms && metricoolPlatforms.length > 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span>{metricoolPlatforms.length + 2} platforms</span>
            </div>
          )}
        </div>

        {/* Latest Report Preview */}
        {latestReport && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Latest: {latestReport.dateRange}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                handleViewLatest();
              }}
            >
              View
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        {/* Open Dashboard CTA */}
        <div className="pt-2">
          <Button 
            variant="default" 
            className="w-full justify-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              if (clientId) navigate(`/client/${clientId}`);
            }}
          >
            Open Dashboard
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
