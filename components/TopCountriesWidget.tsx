import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { subDays, format } from "date-fns";
import type { DateRangePreset } from "@/hooks/useClientAnalytics";

// Country code to name mapping for common codes
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", IN: "India", BR: "Brazil", JP: "Japan",
  PH: "Philippines", MX: "Mexico", ES: "Spain", IT: "Italy", NL: "Netherlands",
  KR: "South Korea", CN: "China", RU: "Russia", ZA: "South Africa",
  NG: "Nigeria", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  PL: "Poland", PT: "Portugal", AR: "Argentina", CL: "Chile", CO: "Colombia",
  NZ: "New Zealand", SG: "Singapore", MY: "Malaysia", TH: "Thailand",
  ID: "Indonesia", VN: "Vietnam", AE: "United Arab Emirates", SA: "Saudi Arabia",
  EG: "Egypt", KE: "Kenya", GH: "Ghana", IE: "Ireland", CH: "Switzerland",
  AT: "Austria", BE: "Belgium", CZ: "Czech Republic", HU: "Hungary",
  RO: "Romania", UA: "Ukraine", TR: "Turkey", IL: "Israel", TW: "Taiwan",
  HK: "Hong Kong", XX: "Unknown",
};

const getCountryLabel = (code: string) => COUNTRY_NAMES[code] || code;

// Country flag emoji from code
const getFlag = (code: string) => {
  if (!code || code === "XX" || code.length !== 2 || code === "Unknown") return "🌐";
  try {
    return String.fromCodePoint(
      ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return "🌐";
  }
};

const getDateRange = (preset: DateRangePreset) => {
  const end = new Date();
  let start: Date;
  switch (preset) {
    case "7d": start = subDays(end, 7); break;
    case "30d": start = subDays(end, 30); break;
    case "all": start = new Date("2020-01-01"); break;
    default: start = subDays(end, 7);
  }
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
};

interface TopCountriesWidgetProps {
  clientId: string;
  dateRange: DateRangePreset;
  countriesData?: any[];
}

export const TopCountriesWidget = ({ clientId, dateRange, countriesData }: TopCountriesWidgetProps) => {
  const [metric, setMetric] = useState<"pageviews" | "sessions" | "visitors">("pageviews");
  const dates = getDateRange(dateRange);

  const { data, isLoading } = useQuery({
    queryKey: ["country-breakdown", clientId, dates.startDate, dates.endDate, metric],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("country-breakdown", {
        body: {
          clientId,
          startDate: dates.startDate,
          endDate: dates.endDate,
          metric,
        },
      });
      if (error) throw error;
      return data as { items: { country: string; value: number }[] };
    },
    enabled: !!clientId && (!countriesData || countriesData.length === 0),
    staleTime: 5 * 60 * 1000,
  });

  const items = countriesData && countriesData.length > 0
    ? countriesData.map(c => ({ 
        country: c.country || c.key || 'XX', 
        value: c.count || c.value || 0 
      })).sort((a,b) => b.value - a.value)
    : (data?.items || []);
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const top = items.slice(0, 10);

  const colors = [
    "bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5",
    "bg-accent", "bg-muted-foreground", "bg-primary/70", "bg-chart-2/70", "bg-chart-3/70",
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Top Countries
          </CardTitle>
          <CardDescription>Geographic breakdown of traffic</CardDescription>
        </div>
        <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pageviews">Pageviews</SelectItem>
            <SelectItem value="sessions">Sessions</SelectItem>
            <SelectItem value="visitors">Visitors</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : top.length === 0 ? (
          <div className="py-8 text-center">
            <Info className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No country data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Data will appear once visitors with country info arrive
            </p>
            <div className="mt-4 text-xs text-left bg-black/50 p-2 rounded overflow-auto max-h-32">
              Debug countriesData: {JSON.stringify(countriesData)}
              <br/>Debug items: {JSON.stringify(items)}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {top.map((item, index) => {
              const pct = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
              return (
                <div key={item.country} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span>{getFlag(item.country)}</span>
                      <span>{getCountryLabel(item.country)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {item.value.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {items.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                + {items.length - 10} more countries
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
