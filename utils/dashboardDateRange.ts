import { subDays, differenceInDays, startOfDay, format } from "date-fns";

export type DateRangePreset = "7d" | "14d" | "30d" | "60d" | "90d" | "365d" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Dashboard-specific date range utility.
 * Does NOT affect weeklyDateRange.ts (Mon-Sun reporting week for other consumers).
 *
 * - "7d" = previous 7 completed calendar days
 * - "14d" = previous 14 completed calendar days
 * - "30d" = previous 30 completed calendar days
 * - "60d" = previous 60 completed calendar days
 * - "90d" = previous 90 completed calendar days (Quarterly)
 * - "365d" = previous 365 completed calendar days (Yearly)
 * - "custom" = user-supplied range
 */
export const getDashboardDateRange = (
  preset: DateRangePreset,
  customRange?: DateRange
): DateRange => {
  if (preset === "custom" && customRange) {
    return { start: startOfDay(customRange.start), end: startOfDay(customRange.end) };
  }

  const yesterday = startOfDay(subDays(new Date(), 1));

  if (preset === "14d") return { start: subDays(yesterday, 13), end: yesterday };
  if (preset === "30d") return { start: subDays(yesterday, 29), end: yesterday };
  if (preset === "60d") return { start: subDays(yesterday, 59), end: yesterday };
  if (preset === "90d") return { start: subDays(yesterday, 89), end: yesterday };
  if (preset === "365d") return { start: subDays(yesterday, 364), end: yesterday };

  // Default: 7d
  return { start: subDays(yesterday, 6), end: yesterday };
};

/**
 * Equal-length comparison period immediately preceding the selected period.
 *
 * e.g. if selected = Mar 23–29 (7 days), comparison = Mar 16–22 (7 days)
 *      if selected = Feb 28–Mar 29 (30 days), comparison = Jan 29–Feb 27 (30 days)
 */
export const getComparisonDateRange = (current: DateRange): DateRange => {
  const periodLength = differenceInDays(current.end, current.start) + 1;
  const compEnd = subDays(current.start, 1);
  const compStart = subDays(compEnd, periodLength - 1);
  return { start: compStart, end: compEnd };
};

/**
 * Format helpers for display labels.
 */
export const formatPeriodLabel = (range: DateRange): string => {
  const sameYear = range.start.getFullYear() === range.end.getFullYear();
  const sameMonth = sameYear && range.start.getMonth() === range.end.getMonth();

  if (sameMonth) {
    return `${format(range.start, "MMM d")}–${format(range.end, "d")}`;
  }
  if (sameYear) {
    return `${format(range.start, "MMM d")} – ${format(range.end, "MMM d")}`;
  }
  return `${format(range.start, "MMM d, yyyy")} – ${format(range.end, "MMM d, yyyy")}`;
};
