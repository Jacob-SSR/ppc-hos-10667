"use client";

import { useState, useCallback, useEffect } from "react";
import type { WardDisplayItem } from "../types/dashboard.types";

interface BedOccupancyApiRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

interface UseIpdDataReturn {
  displayWards: WardDisplayItem[];
  loading: boolean;
  start: Date;
  end: Date;
  setStart: (d: Date) => void;
  setEnd: (d: Date) => void;
  refetch: () => void;
}

function buildDisplayWards(rows: BedOccupancyApiRow[]): WardDisplayItem[] {
  return rows.map((r) => {
    const vacant = r.total_beds - r.current_admit;
    const vacantLabel =
      vacant <= 0
        ? "เต็ม"
        : r.current_admit === 0
          ? `ว่าง ${r.total_beds}`
          : `ว่าง ${vacant}`;

    return {
      ward_code: r.ward_code,
      label: r.label,
      totalBeds: r.total_beds,
      admit: r.current_admit,
      vacantLabel,
    };
  });
}

export function useIpdData(): UseIpdDataReturn {
  const [rows, setRows] = useState<BedOccupancyApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ipd/bed-occupancy", {
        credentials: "include",
      });
      if (res.ok) setRows(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    displayWards: buildDisplayWards(rows),
    loading,
    start,
    end,
    setStart,
    setEnd,
    refetch: fetchData,
  };
}
