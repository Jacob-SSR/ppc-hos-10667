"use client";

import { useState, useCallback, useEffect } from "react";
import type { OccupancyRow } from "../types/dashboard.types";

interface UseBedOccupancyReturn {
  data: OccupancyRow[];
  loading: boolean;
  refetch: () => void;
}

export function useBedOccupancy(): UseBedOccupancyReturn {
  const [data, setData] = useState<OccupancyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ipd/bed-occupancy", {
        credentials: "include",
      });
      if (res.ok) setData(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
