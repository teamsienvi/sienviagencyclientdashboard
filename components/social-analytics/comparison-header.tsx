import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, RefreshCw } from "lucide-react";
import type { DateRangePreset } from "@/types/social-analytics";
import type { CanonicalComparisonResponse } from "@/lib/analytics/comparison-contract.ts";
import { DataCoverageBadge } from "./data-coverage-badge";

interface ComparisonHeaderProps {
  comparison: CanonicalComparisonResponse;
  activePreset: DateRangePreset;
  onPresetSelect: (preset: DateRangePreset) => void;
  isFetching?: boolean;
}

export const ComparisonHeader: React.FC<ComparisonHeaderProps> = ({
  comparison,
  activePreset,
  onPresetSelect,
  isFetching = false,
}) => {
  const { meta, reconciliation } = comparison;
  const { currentPeriod, comparisonPeriod, reportingTimezone, generatedAt, adaptiveGranularity, comparisonType } = meta;

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: "7d", label: "7 Days WoW" },
    { id: "14d", label: "14 Days WoW" },
    { id: "30d", label: "30 Days PoP" },
    { id: "60d", label: "60 Days" },
    { id: "90d", label: "Quarterly" },
    { id: "365d", label: "1 Year" },
  ];

  const formattedSyncTime = new Date(generatedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const titlePrefix = comparisonType === "wow_split" ? "Week-over-Week Comparison" : "Period-over-Period Comparison";
  const periodDescription = comparisonType === "wow_split"
    ? `Current Week (${currentPeriod.label}) vs Prior Week (${comparisonPeriod.label})`
    : `Current ${currentPeriod.elapsedDays} Days (${currentPeriod.label}) vs Prior ${comparisonPeriod.elapsedDays} Days (${comparisonPeriod.label})`;

  return (
    <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-xl border-b border-white/10 text-white p-4 shadow-xl w-full min-w-0 overflow-hidden rounded-t-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
        
        {/* Left: Range Details & Coverage Badges */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-violet-400" />
              {titlePrefix}
            </span>
            
            <DataCoverageBadge
              rangeCompleteness={meta.rangeCompleteness}
              dataCompleteness={meta.dataCompleteness}
              reconciled={reconciliation.reconciled}
            />

            <Badge className="bg-white/10 text-slate-300 border-white/10 text-[10px] uppercase font-mono">
              Granularity: {adaptiveGranularity}
            </Badge>

            <span className="text-[10px] text-slate-400 font-mono">
              TZ: {reportingTimezone}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-white bg-violet-600/40 border border-violet-500/40 px-2.5 py-0.5 rounded-lg">
              {periodDescription}
            </span>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-violet-400" />}
          </div>
        </div>

        {/* Right: Horizon Selector */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="bg-black/40 p-1 rounded-xl backdrop-blur-md flex flex-wrap items-center gap-1 border border-white/10">
            {presets.map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onPresetSelect(p.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    isActive
                      ? "bg-violet-600 text-white shadow-md font-bold border border-violet-400/30"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-500" />
            Last Synced: {formattedSyncTime}
          </p>
        </div>

      </div>
    </div>
  );
};
