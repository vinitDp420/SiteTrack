'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export interface SWROptions<T> {
  dedupingInterval?: number; // ms to reuse in-flight / fresh cache (default 4000ms)
  revalidateOnFocus?: boolean;
  fallbackData?: T;
}

export interface SWRResponse<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (newData?: T | Promise<T>, shouldRevalidate?: boolean) => Promise<T | undefined>;
}

/**
 * Perform a cached JSON fetch with deduplication and stale-while-revalidate behavior.
 */
export async function fetchWithCache<T>(
  url: string,
  ttlMs = 10000
): Promise<T> {
  const cached = memoryCache.get(url);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // Deduplicate concurrent in-flight requests for the exact same URL
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)! as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      memoryCache.set(url, { data: json, timestamp: Date.now() });
      return json as T;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise;
}

/**
 * Lightweight native SWR hook for Next.js / React 19.
 * Delivers immediate cached response (0ms navigation) with background revalidation.
 */
export function useSWR<T = any>(
  key: string | null,
  fetcher?: (url: string) => Promise<T>,
  options: SWROptions<T> = {}
): SWRResponse<T> {
  const { dedupingInterval = 5000, fallbackData } = options;

  const defaultFetcher = useCallback(async (url: string): Promise<T> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return res.json();
  }, []);

  const activeFetcher = fetcher || defaultFetcher;

  const cached = key ? memoryCache.get(key) : undefined;
  const [data, setData] = useState<T | undefined>(cached ? cached.data : fallbackData);
  const [error, setError] = useState<Error | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const keyRef = useRef(key);
  keyRef.current = key;

  const revalidate = useCallback(async (): Promise<T | undefined> => {
    if (!key) return undefined;

    const currentKey = key;
    const now = Date.now();
    const existing = memoryCache.get(currentKey);

    // If cache is still very fresh within dedupingInterval and we have data, skip network
    if (existing && now - existing.timestamp < dedupingInterval) {
      setData(existing.data);
      return existing.data;
    }

    setIsValidating(true);

    try {
      let fetchPromise = inFlightRequests.get(currentKey);
      if (!fetchPromise) {
        fetchPromise = activeFetcher(currentKey);
        inFlightRequests.set(currentKey, fetchPromise);
      }

      const freshData = await fetchPromise;

      if (keyRef.current === currentKey) {
        memoryCache.set(currentKey, { data: freshData, timestamp: Date.now() });
        setData(freshData);
        setError(null);
      }
      return freshData;
    } catch (err: any) {
      if (keyRef.current === currentKey) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      return undefined;
    } finally {
      inFlightRequests.delete(currentKey);
      if (keyRef.current === currentKey) {
        setIsValidating(false);
      }
    }
  }, [key, activeFetcher, dedupingInterval]);

  useEffect(() => {
    if (!key) return;

    // Immediately load from memory cache if available
    const existing = memoryCache.get(key);
    if (existing) {
      setData(existing.data);
    }

    revalidate();
  }, [key, revalidate]);

  const mutate = useCallback(
    async (newData?: T | Promise<T>, shouldRevalidate = true): Promise<T | undefined> => {
      if (!key) return undefined;

      if (newData !== undefined) {
        const resolved = await Promise.resolve(newData);
        memoryCache.set(key, { data: resolved, timestamp: Date.now() });
        setData(resolved);
      }

      if (shouldRevalidate) {
        return revalidate();
      }

      return key ? memoryCache.get(key)?.data : undefined;
    },
    [key, revalidate]
  );

  return {
    data,
    error,
    isLoading: data === undefined && !error,
    isValidating,
    mutate,
  };
}
