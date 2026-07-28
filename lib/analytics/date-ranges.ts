import {
  subDays,
  differenceInDays,
  startOfDay,
  format,
  startOfWeek,
  endOfWeek,
  isAfter,
} from "date-fns";
import type { DateRangePreset, PeriodMeta, ComparisonMode } from "../../types/social-analytics.ts";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Returns weekday index where 0 = Monday, 6 = Sunday.
 */
export const getMondayBasedWeekdayIndex = (d: Date): number => {
  const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  return day === 0 ? 6 : day - 1;
};

/**
 * Returns Monday-Sunday week bounds for a given date.
 */
export const getMonSunWeekBounds = (date: Date): { start: Date; end: Date } => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return { start: startOfDay(start), end: startOfDay(end) };
};

/**
 * Generates structured PeriodMeta for current and comparison periods.
 */
export const buildPeriodMeta = (
  start: Date,
  end: Date,
  isComplete: boolean = true
): PeriodMeta => {
  const s = startOfDay(start);
  const e = startOfDay(end);
  const elapsedDays = Math.max(1, differenceInDays(e, s) + 1);

  const startStr = format(s, "yyyy-MM-dd");
  const endStr = format(e, "yyyy-MM-dd");

  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  let label = "";
  if (sameMonth) {
    label = `${format(s, "MMM d")}–${format(e, "d")}`;
  } else if (sameYear) {
    label = `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
  } else {
    label = `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
  }

  return {
    start: s,
    end: e,
    startStr,
    endStr,
    elapsedDays,
    isComplete,
    label,
  };
};

/**
 * Computes exact Current & Comparison Period Metas for WoW comparison.
 */
export const calculateComparisonPeriods = (
  preset: DateRangePreset,
  customRange?: { start: Date; end: Date },
  forcedMode?: ComparisonMode
): { current: PeriodMeta; previous: PeriodMeta; mode: ComparisonMode } => {
  const now = startOfDay(new Date());
  const yesterday = startOfDay(subDays(now, 1));

  // Default mode: "wow_split" for 7d & 14d, "preceding_period" for larger horizons
  let mode: ComparisonMode = forcedMode || (preset === "14d" || preset === "7d" ? "wow_split" : "preceding_period");

  if (preset === "custom" && customRange) {
    const curStart = startOfDay(customRange.start);
    const curEnd = startOfDay(customRange.end);
    const days = differenceInDays(curEnd, curStart) + 1;
    
    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, days - 1);

    const isComplete = !isAfter(curEnd, yesterday);

    return {
      current: buildPeriodMeta(curStart, curEnd, isComplete),
      previous: buildPeriodMeta(compStart, compEnd, true),
      mode: "preceding_period",
    };
  }

  if (preset === "14d") {
    // 14-day WoW mode: Splits 14 days into Week 2 (Current 7d) vs Week 1 (Previous 7d)
    const curEnd = yesterday;
    const curStart = subDays(curEnd, 6); // 7 days

    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, 6); // 7 days

    return {
      current: buildPeriodMeta(curStart, curEnd, true),
      previous: buildPeriodMeta(compStart, compEnd, true),
      mode: "wow_split",
    };
  }

  if (preset === "7d") {
    // 7-day WoW mode: Current 7 days vs Preceding 7 days
    const curEnd = yesterday;
    const curStart = subDays(curEnd, 6);

    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, 6);

    return {
      current: buildPeriodMeta(curStart, curEnd, true),
      previous: buildPeriodMeta(compStart, compEnd, true),
      mode: "wow_split",
    };
  }

  // Preset 30d, 60d, 90d, 365d: Preceding equal length range
  const days = preset === "365d" ? 365 : preset === "90d" ? 90 : preset === "60d" ? 60 : 30;
  const curEnd = yesterday;
  const curStart = subDays(curEnd, days - 1);

  const compEnd = subDays(curStart, 1);
  const compStart = subDays(compEnd, days - 1);

  return {
    current: buildPeriodMeta(curStart, curEnd, true),
    previous: buildPeriodMeta(compStart, compEnd, true),
    mode: "preceding_period",
  };
};

/**
 * Builds aligned weekday series (Mon-Sun) matching current and previous periods.
 */
export const buildAlignedWeekdayDates = (current: PeriodMeta, previous: PeriodMeta) => {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const series = [];

  const curDays = current.elapsedDays;

  for (let i = 0; i < Math.min(curDays, 7); i++) {
    const curD = subDays(current.end, curDays - 1 - i);
    const prevD = subDays(previous.end, curDays - 1 - i);

    const idx = getMondayBasedWeekdayIndex(curD);

    series.push({
      weekdayIndex: idx,
      weekdayShort: weekdays[idx],
      currentDate: format(curD, "yyyy-MM-dd"),
      previousDate: format(prevD, "yyyy-MM-dd"),
      currentLabel: format(curD, "MMM d"),
      previousLabel: format(prevD, "MMM d"),
    });
  }

  return series;
};
