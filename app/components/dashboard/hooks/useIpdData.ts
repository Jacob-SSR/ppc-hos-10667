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
  preset: string;
  setStart: (d: Date) => void;
  setEnd: (d: Date) => void;
  handlePreset: (p: string) => void;
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

function getPresetRange(preset: string): { start: Date; end: Date } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "สัปดาห์นี้") {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: mon, end: today };
  }
  if (preset === "เดือนนี้") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };
  }
  return { start: today, end: today };
}

const PRESETS = ["วันนี้", "สัปดาห์นี้", "เดือนนี้"];

export function useIpdData(): UseIpdDataReturn {
  const [preset, setPreset] = useState("วันนี้");
  const [start, setStart] = useState<Date>(
    () => getPresetRange("วันนี้").start,
  );
  const [end, setEnd] = useState<Date>(() => getPresetRange("วันนี้").end);
  const [rows, setRows] = useState<BedOccupancyApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [infoLabel, setInfoLabel] = useState("");

  const fetchData = useCallback(async (s: Date, e: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ipd/bed-occupancy?start=${fmt(s)}&end=${fmt(e)}`,
        { credentials: "include" },
      );
      if (res.ok) setRows(await res.json());
      const sLabel = toThaiDate(fmt(s));
      const eLabel = toThaiDate(fmt(e));
      setInfoLabel(sLabel === eLabel ? sLabel : `${sLabel} – ${eLabel}`);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { start: s, end: e } = getPresetRange("วันนี้");
    fetchData(s, e);
  }, [fetchData]);

  useEffect(() => {
    const { start: s, end: e } = getPresetRange("วันนี้");
    fetchData(s, e);
  }, [fetchData]);

  const handlePreset = useCallback(
    (p: string) => {
      setPreset(p);
      const { start: s, end: e } = getPresetRange(p);
      setStart(s);
      setEnd(e);
      fetchData(s, e);
    },
    [fetchData],
  );

  const handleSearch = useCallback(() => {
    fetchData(start, end);
  }, [fetchData, start, end]);

  return {
    displayWards: buildDisplayWards(rows),
    loading,
    start,
    end,
    preset,
    setStart,
    setEnd,
    handlePreset,
    handleSearch,
    infoLabel,
  };
}
