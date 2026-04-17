import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  weekKey: string;
}

const CACHE_KEY_PREFIX = 'analytics_cache_';
import { FRESHNESS_POLICIES } from "@/lib/freshnessPolicy";
const CACHE_TTL_MS = FRESHNESS_POLICIES.social.cacheTtlMs; // Default 7 days render cache

/**
 * Hook for caching analytics data per client + week selection.
 * Persists data to localStorage to survive navigation.
 */
export function useAnalyticsCache<T>(
  clientId: string,
  platform: string,
  weekKey: string // e.g., "2024-01-05_2024-01-11"
) {
  const cacheKey = `${CACHE_KEY_PREFIX}${clientId}_${platform}_${weekKey}`;
  
  const [cachedData, setCachedData] = useState<T | null>(() => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        const isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
        const isMatchingWeek = entry.weekKey === weekKey;
        
        if (!isExpired && isMatchingWeek) {
          return entry.data;
        }
      }
    } catch (e) {
      console.warn('Failed to read analytics cache:', e);
    }
    return null;
  });
  
  const updateCache = useCallback((data: T) => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      weekKey,
    };
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      setCachedData(data);
    } catch (e) {
      console.warn('Failed to write analytics cache:', e);
    }
  }, [cacheKey, weekKey]);
  
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
      setCachedData(null);
    } catch (e) {
      console.warn('Failed to clear analytics cache:', e);
    }
  }, [cacheKey]);
  
  // Clear stale cache entries for this client/platform when week changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (entry.weekKey !== weekKey) {
          // Week changed, invalidate cache
          localStorage.removeItem(cacheKey);
          setCachedData(null);
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [cacheKey, weekKey]);
  
  return {
    cachedData,
    updateCache,
    clearCache,
    hasCachedData: cachedData !== null,
  };
}

/**
 * Generate a week key from date range for caching
 */
export function getWeekKey(start: Date, end: Date): string {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return `${formatDate(start)}_${formatDate(end)}`;
}

/**
 * Clear all analytics cache for a client
 */
export function clearAllAnalyticsCache(clientId: string) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${CACHE_KEY_PREFIX}${clientId}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Failed to clear analytics cache:', e);
  }
}
