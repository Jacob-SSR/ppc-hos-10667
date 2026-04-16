"use client";

import { useState, useCallback, useEffect } from "react";
import type { IpdApiSummary, WardDisplayItem } from "../types/dashboard.types";
import { WARD_CONFIG } from "../constants/dashboard.constants";
import { fmtDate } from "../components/utils/dashboard.utils";

interface UseIpdDataReturn {
  displayWards: WardDisplayItem[];
  loading: boolean;
  start: Date;
  end: Date;
  setStart: (d: Date) => void;
  setEnd: (d: Date) => void;
  refetch: () => void;
}

function buildDisplayWards(apiData: IpdApiSummary | null): WardDisplayItem[] {
  return Object.entries(WARD_CONFIG).map(([wc, cfg]) => {
    const apiWard = apiData?.byWard?.find((w) => String(w.ward_code) === wc);
    const admit = apiWard?.admit_total ?? 0;
    const vacant = cfg.totalBeds - admit;
    const vacantLabel =
      vacant <= 0
        ? "เต็ม"
        : admit === 0
          ? `ว่าง ${cfg.totalBeds}`
          : `ว่าง ${vacant}`;

    return {
      ward_code: wc,
      label: cfg.label,
      totalBeds: cfg.totalBeds,
      admit,
      vacantLabel,
    };
  });
}

export function useIpdData(): UseIpdDataReturn {
  const [apiData, setApiData] = useState<IpdApiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(new Date());

  const fetchData = useCallback(async (s: Date, e: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ipd/summary?start=${fmtDate(s)}&end=${fmtDate(e)}`,
        { credentials: "include" },
      );
      if (res.ok) setApiData(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    displayWards: buildDisplayWards(apiData),
    loading,
    start,
    end,
    setStart,
    setEnd,
    refetch: () => fetchData(start, end),
  };
}
