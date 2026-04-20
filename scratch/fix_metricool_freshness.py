import re

def inplace_replace(filepath, mapping):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for old, new in mapping:
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Update MetricoolAnalyticsSection.tsx
inplace_replace(
    'components/MetricoolAnalyticsSection.tsx',
    [
        (
            """  // Automatically sync when date range changes
  useEffect(() => {
    if (config && config.is_active && !syncMutation.isPending && !configLoading) {
      const timer = setTimeout(() => {
        syncMutation.mutate();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dateRangePreset, customDateRange, config?.is_active, configLoading]);""",
            """  // Check staleness before syncing automatically
  useEffect(() => {
    if (config && config.is_active && !syncMutation.isPending && !configLoading) {
      const timer = setTimeout(() => {
        // We persist metrics into social_account_metrics.
        // Prevent constant re-syncing if the data is already fresh, relying on the 'social' threshold.
        const shouldSync = isDataStale(accountMetrics?.collected_at, 'social');
        if (shouldSync) {
            syncMutation.mutate();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dateRangePreset, customDateRange, config?.is_active, configLoading, accountMetrics?.collected_at]);"""
        )
    ]
)
