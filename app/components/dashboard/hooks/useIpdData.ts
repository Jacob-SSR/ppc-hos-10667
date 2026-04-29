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
  date: Date;
  setDate: (d: Date) => void;
  handleSearch: () => void;
  infoLabel: string;
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

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toThaiDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

function getToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function useIpdData(): UseIpdDataReturn {
  const [date, setDate] = useState<Date>(() => getToday());
  const [rows, setRows] = useState<BedOccupancyApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [infoLabel, setInfoLabel] = useState("");

  const fetchData = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const dateStr = fmt(d);
      const res = await fetch(
        `/api/ipd/bed-occupancy?start=${dateStr}&end=${dateStr}`,
        { credentials: "include" },
      );
      if (res.ok) setRows(await res.json());
      setInfoLabel(toThaiDate(dateStr));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(getToday());
  }, [fetchData]);

  const handleSearch = useCallback(() => {
    fetchData(date);
  }, [fetchData, date]);

  return {
    displayWards: buildDisplayWards(rows),
    loading,
    date,
    setDate,
    handleSearch,
    infoLabel,
  };
}
