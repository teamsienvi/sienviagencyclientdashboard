// Standardized analytics periods for week-over-week comparison
// Uses the last completed week (MonSun) as the "current" period to match the UI.

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const getMostRecentMonday = (fromDate: Date = new Date()) => {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysToSubtract);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildAnalyticsPeriod = (now: Date = new Date()) => {
  const thisMonday = getMostRecentMonday(now);

  // Current period = last completed Mon-Sun
  const startDate = new Date(thisMonday);
  startDate.setDate(thisMonday.getDate() - 7);
  const endDate = new Date(thisMonday);
  endDate.setDate(thisMonday.getDate() - 1);

  // Previous period = week before that
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(startDate.getDate() - 7);
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(startDate.getDate() - 1);

  return {
    start: toDateStr(startDate),
    end: toDateStr(endDate),
    startDate,
    endDate,
    prevStart: toDateStr(prevStartDate),
    prevEnd: toDateStr(prevEndDate),
    prevStartDate,
    prevEndDate,
  };
};

export const ANALYTICS_PERIOD = buildAnalyticsPeriod();

export const getStandardPeriod = () => ({
  periodStart: ANALYTICS_PERIOD.start,
  periodEnd: ANALYTICS_PERIOD.end,
});

export const getPreviousPeriod = () => ({
  periodStart: ANALYTICS_PERIOD.prevStart,
  periodEnd: ANALYTICS_PERIOD.prevEnd,
});

export const getBothPeriods = () => ({
  current: getStandardPeriod(),
  previous: getPreviousPeriod(),
});
