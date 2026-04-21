'use client';

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in cache for 7 days
          },
        },
      })
  );

  const persister = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: "SIENVI_DASHBOARD_CACHE",
    });
  }, []);

  // Only persist lightweight summary/overview keys to avoid localStorage bloat
  const persistOptions = {
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    dehydrateOptions: {
      shouldDehydrateQuery: (query: any) => {
        const key = query.queryKey[0];
        const whitelist = [
          "analytics-summary",
          "client-seo-metrics",
          "metricool-account-metrics",
          "summary-metrics",
          "client-social-metrics",
          "all-time-top-posts",
        ];
        return whitelist.includes(key) && query.state.status === "success";
      }
    }
  };

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions as any}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
