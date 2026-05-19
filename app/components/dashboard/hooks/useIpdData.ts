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
      admit: r.current_admit,       // ← ตัวเลข live จาก DB โดยตรง
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

  // ── fetch โดยไม่ส่ง date = ดึง live (dchdate IS NULL) เหมือน WardDetailModal ──
  const fetchLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ipd/bed-occupancy", { credentials: "include" });
      if (res.ok) {
        const data: BedOccupancyApiRow[] = await res.json();
        setRows(data);
      }
      const today = getToday();
      setDate(today);
      setInfoLabel(toThaiDate(fmt(today)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // ── fetch ตาม date ที่ user เลือก (ส่ง start/end) ──────────────────────────
  const fetchByDate = useCallback(async (d: Date) => {
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

  // โหลดครั้งแรก → ใช้ live (ไม่มี date param)
  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // เมื่อ user กด Search
  const handleSearch = useCallback(() => {
    const today = getToday();
    const isToday = fmt(date) === fmt(today);
    // ถ้าเลือกวันนี้ → live, ถ้าเลือกวันอื่น → ตาม date
    if (isToday) {
      fetchLive();
    } else {
      fetchByDate(date);
    }
  }, [date, fetchLive, fetchByDate]);

  return {
    displayWards: buildDisplayWards(rows),
    loading,
    date,
    setDate,
    handleSearch,
    infoLabel,
  };
}