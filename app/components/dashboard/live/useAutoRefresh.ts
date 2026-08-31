// app/components/dashboard/live/useAutoRefresh.ts
// รวม fetch + countdown + interval ที่ copy กันมา 5 หน้า dashboard
// (accident, drug, homeward, sepsis, stroke)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { visibleInterval } from "@/lib/visibleInterval";

interface AutoRefreshState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  secondsLeft: number;
  refetch: () => void;
}

export interface AutoRefreshOptions {
  /** URL ที่ใช้เฉพาะตอนผู้ใช้กดปุ่มรีเฟรชเอง — ใส่ ?refresh=1 เพื่อล้าง cache ฝั่ง server
   *  (poll อัตโนมัติยังใช้ url ปกติ จะได้ไม่ไปทุบ cache ทุก 30 วิ) */
  refreshUrl?: string;
}

export function useAutoRefresh<T>(
  url: string,
  intervalMs = 30_000,
  opts: AutoRefreshOptions = {},
): AutoRefreshState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(intervalMs / 1000);

  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { refreshUrl } = opts;

  const fetchData = useCallback(
    async (silent = false, force = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const target = force && refreshUrl ? refreshUrl : url;
        const res = await fetch(target, {
          credentials: "include",
          cache: force ? "no-store" : "default",
        });
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
    [url, refreshUrl, intervalMs],
  );

  useEffect(() => {
    fetchData();
    // poll เฉพาะตอนแท็บเปิดอยู่จริง — ซ่อนอยู่ = ไม่ยิง, กลับมาดู = ยิงชดเชยทันที
    const stopPoll = visibleInterval(() => fetchData(true), intervalMs);
    countRef.current = setInterval(
      () => setSecondsLeft((s) => (s <= 1 ? intervalMs / 1000 : s - 1)),
      1000,
    );
    return () => {
      stopPoll();
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [fetchData, intervalMs]);

  return {
    data,
    loading,
    error,
    connected,
    secondsLeft,
    refetch: () => fetchData(false, true),
  };
}
