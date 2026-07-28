import {
  subDays,
  differenceInDays,
  startOfDay,
  format,
  isAfter,
} from "date-fns";
import type { DateRangePreset } from "../../types/social-analytics.ts";
import type { PeriodBoundaries, ComparisonType } from "./comparison-contract.ts";

export const getAdaptiveGranularity = (
  days: number
): "daily" | "weekly" | "monthly" => {
  if (days <= 14) return "daily";
  if (days <= 90) return "weekly";
  return "monthly";
};

export const buildPeriodBoundaries = (
  start: Date,
  end: Date,
  isComplete: boolean = true
): PeriodBoundaries => {
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

export const resolveComparisonBoundaries = (
  preset: DateRangePreset,
  customRange?: { start: Date; end: Date }
): {
  current: PeriodBoundaries;
  previous: PeriodBoundaries;
  comparisonType: ComparisonType;
  adaptiveGranularity: "daily" | "weekly" | "monthly";
} => {
  const now = startOfDay(new Date());
  const yesterday = startOfDay(subDays(now, 1));

  if (preset === "custom" && customRange) {
    const curStart = startOfDay(customRange.start);
    const curEnd = startOfDay(customRange.end);
    const days = differenceInDays(curEnd, curStart) + 1;

    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, days - 1);
    const isComplete = !isAfter(curEnd, yesterday);

    return {
      current: buildPeriodBoundaries(curStart, curEnd, isComplete),
      previous: buildPeriodBoundaries(compStart, compEnd, true),
      comparisonType: "preceding_period",
      adaptiveGranularity: getAdaptiveGranularity(days),
    };
  }

  if (preset === "14d") {
    // 14d mode: Current 14 days vs Previous 14 days
    const curEnd = yesterday;
    const curStart = subDays(curEnd, 13); // 14 full days

    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, 13); // 14 full days

    return {
      current: buildPeriodBoundaries(curStart, curEnd, true),
      previous: buildPeriodBoundaries(compStart, compEnd, true),
      comparisonType: "preceding_period",
      adaptiveGranularity: "daily",
    };
  }

  if (preset === "7d") {
    const curEnd = yesterday;
    const curStart = subDays(curEnd, 6);

    const compEnd = subDays(curStart, 1);
    const compStart = subDays(compEnd, 6);

    return {
      current: buildPeriodBoundaries(curStart, curEnd, true),
      previous: buildPeriodBoundaries(compStart, compEnd, true),
      comparisonType: "wow_split",
      adaptiveGranularity: "daily",
    };
  }

  const days = preset === "365d" ? 365 : preset === "90d" ? 90 : preset === "60d" ? 60 : 30;
  const curEnd = yesterday;
  const curStart = subDays(curEnd, days - 1);

  const compEnd = subDays(curStart, 1);
  const compStart = subDays(compEnd, days - 1);

  return {
    current: buildPeriodBoundaries(curStart, curEnd, true),
    previous: buildPeriodBoundaries(compStart, compEnd, true),
    comparisonType: "preceding_period",
    adaptiveGranularity: getAdaptiveGranularity(days),
  };
};

export const getMondayBasedWeekdayIndex = (d: Date): number => {
  const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  return day === 0 ? 6 : day - 1;
};

export const buildAlignedWeekdayDates = (current: PeriodBoundaries, previous: PeriodBoundaries) => {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const series = [];

  const curDays = Math.min(current.elapsedDays, 7);

  for (let i = 0; i < curDays; i++) {
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
