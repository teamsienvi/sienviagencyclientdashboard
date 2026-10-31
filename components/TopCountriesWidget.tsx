import { GeographicHeatmapWidget } from "@/components/analytics/GeographicHeatmapWidget";
import type { DateRangePreset } from "@/hooks/useClientAnalytics";

interface TopCountriesWidgetProps {
  clientId: string;
  dateRange: DateRangePreset;
  countriesData?: any[];
}

export const TopCountriesWidget = ({ clientId, dateRange, countriesData }: TopCountriesWidgetProps) => {
  return (
    <GeographicHeatmapWidget
      clientId={clientId}
      dateRange={dateRange}
      countriesData={countriesData}
    />
  );
};
