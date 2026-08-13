import React, { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, RefreshCw, ArrowRightLeft } from "lucide-react";
import { subDays, differenceInDays, startOfDay } from "date-fns";
import type { DateRangePreset } from "@/types/social-analytics";
import type { CanonicalComparisonResponse } from "@/lib/analytics/comparison-contract.ts";
import { DataCoverageBadge } from "./data-coverage-badge";
import { DateRangePopover } from "./date-range-popover";

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "7d", label: "Last 7 Days" },
  { id: "14d", label: "Last 14 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "60d", label: "Last 60 Days" },
  { id: "90d", label: "Quarterly" },
  { id: "365d", label: "1 Year" },
];

interface ComparisonHeaderProps {
  comparison: CanonicalComparisonResponse;
  activePreset: DateRangePreset;
  onPresetSelect: (preset: DateRangePreset) => void;
  onCustomDateChange?: (
    current: { start: Date; end: Date },
    comparison: { start: Date; end: Date }
  ) => void;
  isFetching?: boolean;
}

export const ComparisonHeader: React.FC<ComparisonHeaderProps> = ({
  comparison,
  activePreset,
  onPresetSelect,
  onCustomDateChange,
  isFetching = false,
}) => {
  const { meta, reconciliation } = comparison;
  const { currentPeriod, comparisonPeriod, reportingTimezone, generatedAt, adaptiveGranularity, comparisonType } = meta;

  // Track whether the comparison period has been manually overridden
  const [compOverridden, setCompOverridden] = useState(false);

  // Local date state derived from the comparison object
  const [currentFrom, setCurrentFrom] = useState<Date>(currentPeriod.start);
  const [currentTo, setCurrentTo] = useState<Date>(currentPeriod.end);
  const [compFrom, setCompFrom] = useState<Date>(comparisonPeriod.start);
  const [compTo, setCompTo] = useState<Date>(comparisonPeriod.end);

  // Sync local date state when comparison object changes (e.g. preset change)
  useEffect(() => {
    setCurrentFrom(currentPeriod.start);
    setCurrentTo(currentPeriod.end);
    setCompFrom(comparisonPeriod.start);
    setCompTo(comparisonPeriod.end);
    setCompOverridden(false);
  }, [currentPeriod.startStr, currentPeriod.endStr, comparisonPeriod.startStr, comparisonPeriod.endStr]);

  const handleCurrentChange = useCallback(
    (range: { start: Date; end: Date } | null) => {
      if (!range) return;
      const start = startOfDay(range.start);
      const end = startOfDay(range.end);
      setCurrentFrom(start);
      setCurrentTo(end);

      // Auto-calculate comparison period (same length, immediately preceding)
      let newCompEnd: Date;
      let newCompStart: Date;
      if (!compOverridden) {
        const days = differenceInDays(end, start);
        newCompEnd = subDays(start, 1);
        newCompStart = subDays(newCompEnd, days);
        setCompFrom(newCompStart);
        setCompTo(newCompEnd);
      } else {
        newCompStart = compFrom;
        newCompEnd = compTo;
      }

      onCustomDateChange?.(
        { start, end },
        { start: compOverridden ? compFrom : newCompStart!, end: compOverridden ? compTo : newCompEnd! }
      );
    },
    [compOverridden, compFrom, compTo, onCustomDateChange]
  );

  const handleCompChange = useCallback(
    (range: { start: Date; end: Date } | null) => {
      if (!range) {
        setCompOverridden(false);
        // Reset to auto-calculated
        const days = differenceInDays(currentTo, currentFrom);
        const autoEnd = subDays(currentFrom, 1);
        const autoStart = subDays(autoEnd, days);
        setCompFrom(autoStart);
        setCompTo(autoEnd);
        onCustomDateChange?.(
          { start: currentFrom, end: currentTo },
          { start: autoStart, end: autoEnd }
        );
        return;
      }
      setCompOverridden(true);
      const start = startOfDay(range.start);
      const end = startOfDay(range.end);
      setCompFrom(start);
      setCompTo(end);
      onCustomDateChange?.(
        { start: currentFrom, end: currentTo },
        { start, end }
      );
    },
    [currentFrom, currentTo, onCustomDateChange]
  );

  const formattedSyncTime = new Date(generatedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const titlePrefix = comparisonType === "wow_split" ? "Weekly Comparison" : "Period Comparison";
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

        {/* Right: Date range pills + sync time */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <DateRangePopover
              label="Current Period"
              from={currentFrom}
              to={currentTo}
              onChange={handleCurrentChange}
              variant="current"
              presets={PRESETS}
              activePreset={activePreset}
              onPresetSelect={onPresetSelect}
            />
            <ArrowRightLeft className="h-3 w-3 text-slate-500 flex-shrink-0" />
            <DateRangePopover
              label="Compare To"
              from={compFrom}
              to={compTo}
              onChange={handleCompChange}
              variant="comparison"
            />
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
