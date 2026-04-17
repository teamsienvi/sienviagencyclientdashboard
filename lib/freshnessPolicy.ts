export const FRESHNESS_POLICIES = {
  summary: {
    staleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days (Render cache)
  },
  seo: {
    staleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  ecommerce: {
    staleThresholdMs: 4 * 60 * 60 * 1000, // 4 hours
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  social: {
    staleThresholdMs: 4 * 60 * 60 * 1000, // 4 hours
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  live_data: {
    staleThresholdMs: 15 * 60 * 1000, // 15 mins for active debugging
    cacheTtlMs: 24 * 60 * 60 * 1000, // 1 day
  }
};

export const isDataStale = (lastSyncAt: string | null | Date, policyKey: keyof typeof FRESHNESS_POLICIES) => {
  if (!lastSyncAt) return true;
  const syncTime = new Date(lastSyncAt).getTime();
  return Date.now() - syncTime > FRESHNESS_POLICIES[policyKey].staleThresholdMs;
};
