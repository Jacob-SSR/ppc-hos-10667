// app/components/dashboard/live/useFetchOnce.ts
// โหลดข้อมูลครั้งเดียวตอน mount (ไม่มี polling / auto-refresh)
"use client";

import { useEffect, useState } from "react";

interface FetchOnceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useFetchOnce<T>(url: string): FetchOnceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const j = (await res.json()) as T;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
