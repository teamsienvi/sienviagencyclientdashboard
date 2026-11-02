import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GeographicHeatmapWidget } from "@/components/analytics/GeographicHeatmapWidget";
import type { DateRangePreset } from "@/hooks/useClientAnalytics";

interface TopCountriesWidgetProps {
  clientId: string;
  dateRange: DateRangePreset;
  countriesData?: any[];
  className?: string;
}

export const TopCountriesWidget = ({ clientId, dateRange, countriesData, className }: TopCountriesWidgetProps) => {
  // Only show the Geographic Demand & Product Heatmap for clients with Shopify analytics.
  // Same queryKey/queryFn as GeographicHeatmapWidget so the result is shared from cache.
  const { data: shopifyCache, isLoading } = useQuery({
    queryKey: ["platform-analytics-cache", clientId, "shopify", "analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_analytics_cache" as any)
        .select("data, collected_at")
        .eq("client_id", clientId)
        .eq("platform", "shopify")
        .eq("module", "analytics")
        .maybeSingle();

      if (error) throw error;
      return (data as any) || null;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const hasShopifyAnalytics = !!shopifyCache?.data && Object.keys(shopifyCache.data).length > 0;

  if (isLoading || !hasShopifyAnalytics) return null;

  return (
    <div className={`col-span-full w-full ${className || ""}`}>
      <GeographicHeatmapWidget
        clientId={clientId}
        dateRange={dateRange}
        countriesData={countriesData}
      />
    </div>
  );
};
