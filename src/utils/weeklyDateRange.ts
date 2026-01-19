import { startOfWeek, endOfWeek, subWeeks, format, isMonday, subDays } from "date-fns";

/**
 * Get the current reporting period (Monday-Sunday) and previous week.
 * On Monday, shows the just-completed week. Otherwise, shows the current week in progress.
 */
export const getCurrentReportingWeek = () => {
  const today = new Date();
  
  // Get the most recent Monday (start of current/last complete week)
  // If today is Monday, we show the previous week (Mon-Sun just ended)
  // Otherwise, show the week containing today
  let weekStart: Date;
  
  if (isMonday(today)) {
    // If it's Monday, show last week's data (Sunday just ended)
    weekStart = startOfWeek(subDays(today, 1), { weekStartsOn: 1 });
  } else {
    // Show the current week in progress
    weekStart = startOfWeek(today, { weekStartsOn: 1 });
  }
  
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  return {
    start: weekStart,
    end: weekEnd,
    dateRange: formatDateRange(weekStart, weekEnd),
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
 * Get the previous reporting week
 */
export const getPreviousReportingWeek = () => {
  const { start: currentStart } = getCurrentReportingWeek();
  const prevStart = subWeeks(currentStart, 1);
  const prevEnd = endOfWeek(prevStart, { weekStartsOn: 1 });
  
  return {
    start: prevStart,
    end: prevEnd,
    dateRange: formatDateRange(prevStart, prevEnd),
  };
};
