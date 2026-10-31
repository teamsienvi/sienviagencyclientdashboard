import { GeographicHeatmapWidget } from "@/components/analytics/GeographicHeatmapWidget";
import type { DateRangePreset } from "@/hooks/useClientAnalytics";

interface TopCountriesWidgetProps {
  clientId: string;
  dateRange: DateRangePreset;
  countriesData?: any[];
  className?: string;
}

export const TopCountriesWidget = ({ clientId, dateRange, countriesData, className }: TopCountriesWidgetProps) => {
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
