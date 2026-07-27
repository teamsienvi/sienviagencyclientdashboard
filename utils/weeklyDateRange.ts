import { startOfWeek, endOfWeek, subWeeks, format, subDays } from "date-fns";

/**
 * Get the most recent Monday (start of the current week)
 */
const getMostRecentMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Sunday = 6 days back, otherwise day - 1
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the current reporting period - the LAST COMPLETED week (Mon-Sun).
 * This matches the Meta analytics date logic exactly.
 * E.g., if today is Jan 19 (Sunday), shows Jan 13-19.
 * If today is Jan 20 (Monday), shows Jan 13-19 (the week that just ended).
 */
export const getCurrentReportingWeek = () => {
  const today = new Date();
  const thisMonday = getMostRecentMonday(today);
  const prevMonday = subDays(thisMonday, 7); // Previous week's Monday
  const prevSunday = subDays(thisMonday, 1); // Previous week's Sunday
  
  return {
    start: prevMonday,
    end: prevSunday,
    dateRange: formatDateRange(prevMonday, prevSunday),
  };
};

/**
 * Format a date range as "Jan 12-18" style
 */
export const formatDateRange = (start: Date, end: Date): string => {
  const startMonth = format(start, "MMM");
  const endMonth = format(end, "MMM");
  const startDay = format(start, "d");
  const endDay = format(end, "d");
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
};

/**
 * Get the previous reporting week (two weeks ago)
 */
export const getPreviousReportingWeek = () => {
  const { start: currentStart } = getCurrentReportingWeek();
  const prevStart = subDays(currentStart, 7);
  const prevEnd = subDays(currentStart, 1);
  
  return {
    start: prevStart,
    end: prevEnd,
    dateRange: formatDateRange(prevStart, prevEnd),
  };
};

/**
 * Get the biweekly (14-day) reporting period — the last TWO completed weeks.
 * Week 2 = last completed week (Mon-Sun)
 * Week 1 = the week before that
 * Combined = full 14-day window
 */
export const getBiweeklyReportingPeriod = () => {
  const week2 = getCurrentReportingWeek();
  const week1 = getPreviousReportingWeek();

  return {
    week1: {
      start: week1.start,
      end: week1.end,
      dateRange: week1.dateRange,
    },
    week2: {
      start: week2.start,
      end: week2.end,
      dateRange: week2.dateRange,
    },
    combined: {
      start: week1.start,
      end: week2.end,
      dateRange: formatDateRange(week1.start, week2.end),
    },
  };
};

/**
 * Format a date range as "July 13 to July 26, 2026" style (for PDF report titles)
 */
export const formatDateRangeFull = (start: Date, end: Date): string => {
  const sameYear = format(start, "yyyy") === format(end, "yyyy");
  if (sameYear) {
    return `${format(start, "MMMM d")} to ${format(end, "MMMM d, yyyy")}`;
  }
  return `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
};
