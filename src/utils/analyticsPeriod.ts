// Standardized analytics periods for week-over-week comparison
// Current period: Dec 15-21, 2024
// Previous period: Dec 8-14, 2024
// These update weekly on Sundays

export const ANALYTICS_PERIOD = {
  // Current week
  start: '2024-12-15',
  end: '2024-12-21',
  startDate: new Date('2024-12-15'),
  endDate: new Date('2024-12-21'),
  
  // Previous week for comparison
  prevStart: '2024-12-08',
  prevEnd: '2024-12-14',
  prevStartDate: new Date('2024-12-08'),
  prevEndDate: new Date('2024-12-14'),
};

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
