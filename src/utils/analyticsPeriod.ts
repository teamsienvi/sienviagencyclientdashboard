// Standardized analytics period - Dec 15-21, 2024
// This updates weekly on Sundays
export const ANALYTICS_PERIOD = {
  start: '2024-12-15',
  end: '2024-12-21',
  startDate: new Date('2024-12-15'),
  endDate: new Date('2024-12-21'),
};

export const getStandardPeriod = () => ({
  periodStart: ANALYTICS_PERIOD.start,
  periodEnd: ANALYTICS_PERIOD.end,
});
