const startDate = '2026-04-28';
const endDate = '2026-05-04';
const published_at = '2026-05-03T20:03:00+00:00';

const publishedDate = new Date(published_at);
const periodStart = new Date(startDate);
const periodEnd = new Date(endDate);
periodEnd.setHours(23, 59, 59, 999);

console.log('publishedDate:', publishedDate.toISOString(), publishedDate.getTime());
console.log('periodStart:', periodStart.toISOString(), periodStart.getTime());
console.log('periodEnd:', periodEnd.toISOString(), periodEnd.getTime());
console.log('is within:', publishedDate >= periodStart && publishedDate <= periodEnd);

const metrics = [
  {
    period_start: '2026-04-28',
    period_end: '2026-05-04',
    reach: 118,
    likes: 1,
    comments: 0,
    shares: 0,
    collected_at: '2026-05-04T18:00:43.285+00:00'
  }
];

const findMetricsForPeriod = (metrics, targetStart, targetEnd) => {
  if (!metrics || metrics.length === 0) return null;

  const sorted = [...metrics].sort((a, b) =>
    new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
  );

  const targetStartDate = new Date(targetStart);
  const targetEndDate = new Date(targetEnd);

  const hasValidReach = (m) => {
    const reach = m.reach;
    const hasEngagement = (m.likes || 0) + (m.comments || 0) + (m.shares || 0) > 0;
    return reach > 0 || !hasEngagement;
  };

  const exactWithReach = sorted.find(m =>
    m.period_start === targetStart && m.period_end === targetEnd && hasValidReach(m)
  );
  if (exactWithReach) return exactWithReach;

  const exactMatch = sorted.find(m =>
    m.period_start === targetStart && m.period_end === targetEnd
  );
  if (exactMatch) return exactMatch;

  const overlappingWithReach = sorted.find(m => {
    if (!m.period_start || !m.period_end) return false;
    const pStart = new Date(m.period_start);
    const pEnd = new Date(m.period_end);
    const overlaps = pStart <= targetEndDate && pEnd >= targetStartDate;
    return overlaps && hasValidReach(m);
  });
  if (overlappingWithReach) return overlappingWithReach;

  const overlapping = sorted.find(m => {
    if (!m.period_start || !m.period_end) return false;
    const pStart = new Date(m.period_start);
    const pEnd = new Date(m.period_end);
    return pStart <= targetEndDate && pEnd >= targetStartDate;
  });
  if (overlapping) return overlapping;

  return sorted[0];
};

const matchedMetrics = findMetricsForPeriod(metrics, startDate, endDate);
console.log('matchedMetrics:', matchedMetrics);
