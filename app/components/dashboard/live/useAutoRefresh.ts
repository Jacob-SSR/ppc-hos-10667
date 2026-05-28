// app/components/dashboard/live/useAutoRefresh.ts
// รวม fetch + countdown + interval ที่ copy กันมา 5 หน้า dashboard
// (accident, drug, homeward, sepsis, stroke)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AutoRefreshState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  secondsLeft: number;
  refetch: () => void;
}

export function useAutoRefresh<T>(
  url: string,
  intervalMs = 30_000,
): AutoRefreshState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(intervalMs / 1000);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        setData(await res.json());
        setConnected(true);
      } catch (e) {
        setConnected(false);
        if (!silent) setError((e as Error).message);
      } finally {
        if (!silent) setLoading(false);
        setSecondsLeft(intervalMs / 1000);
      }
    },
    [url, intervalMs],
  );

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), intervalMs);
    countRef.current = setInterval(
      () => setSecondsLeft((s) => (s <= 1 ? intervalMs / 1000 : s - 1)),
      1000,
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [fetchData, intervalMs]);

  return {
    data,
    loading,
    error,
    connected,
    secondsLeft,
    refetch: () => fetchData(),
  };
}
