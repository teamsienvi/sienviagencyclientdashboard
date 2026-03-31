import { subDays, differenceInDays, startOfDay, format } from "date-fns";

export type DateRangePreset = "7d" | "30d" | "60d" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Dashboard-specific date range utility.
 * Does NOT affect weeklyDateRange.ts (Mon-Sun reporting week for other consumers).
 *
 * - "7d" = previous 7 completed calendar days (yesterday − 6 → yesterday)
 * - "30d" = previous 30 completed calendar days (yesterday − 29 → yesterday)
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

  if (preset === "30d" || preset === "60d") {
    const days = preset === "60d" ? 59 : 29;
    return { start: subDays(yesterday, days), end: yesterday };
  }

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
  const sameMonth = range.start.getMonth() === range.end.getMonth();
  if (sameMonth) {
    return `${format(range.start, "MMM d")}–${format(range.end, "d")}`;
  }
  return `${format(range.start, "MMM d")} – ${format(range.end, "MMM d")}`;
};
