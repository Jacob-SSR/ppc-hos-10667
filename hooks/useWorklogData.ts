// hooks/useWorklogData.ts
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TASK_CFG,
  STAFF_COLORS,
  SHORT_COLOR,
  taskColor,
  taskShort,
} from "@/lib/worklog.constants";
import { fmtShort, fmtMonth, getCutoffDate } from "@/lib/worklog.utils";

export interface WorkRow {
  date: string;
  staff: string;
  mainTask: string;
  subTask: string;
  urgency: string;
  devType: string;
  duration: number;
  department: string;
  timeliness: string;
  color?: string;
  short?: string;
  [key: string]: unknown;
}

export type ViewMode = "day" | "month";

export function useWorklogData() {
  const [allData, setAllData] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStaff, setSelectedStaff] = useState("ทั้งหมด");
  const [dateRange, setDateRange] = useState(30);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedMainForSub, setSelectedMainForSub] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/it-worklog-sheets", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setAllData(Array.isArray(json) ? json : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const staffList = useMemo(
    () => [
      "ทั้งหมด",
      ...Array.from(
        new Set(allData.map((r) => r.staff).filter(Boolean)),
      ).sort(),
    ],
    [allData],
  );

  const filtered = useMemo(() => {
    const cutStr = getCutoffDate(dateRange);
    return allData.filter((r) => {
      if (selectedStaff !== "ทั้งหมด" && r.staff !== selectedStaff)
        return false;
      return r.date >= cutStr;
    });
  }, [allData, selectedStaff, dateRange]);

  const kpis = useMemo(() => {
    const totalJobs = filtered.length;
    const totalMin = filtered.reduce((s, r) => s + r.duration, 0);
    const urgentCount = filtered.filter((r) => r.urgency === "เร่งด่วน").length;
    const onTimeCount = filtered.filter((r) =>
      r.timeliness?.includes("ท้น"),
    ).length;
    const devCount = filtered.filter((r) => r.devType === "งานพัฒนา").length;
    const staffCount = new Set(filtered.map((r) => r.staff).filter(Boolean))
      .size;
    const avgMin = totalJobs > 0 ? Math.round(totalMin / totalJobs) : 0;
    return {
      totalJobs,
      totalMin,
      avgMin,
      urgentCount,
      onTimeCount,
      devCount,
      staffCount,
    };
  }, [filtered]);

  const usedShorts = useMemo(() => {
    const s = new Set<string>();
    filtered.forEach((r) => s.add(taskShort(r.mainTask) || "อื่นๆ"));
    return Array.from(s);
  }, [filtered]);

  const barData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    filtered.forEach((r) => {
      const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
      if (!map.has(key)) map.set(key, {});
      const entry = map.get(key)!;
      const t = taskShort(r.mainTask) || "อื่นๆ";
      entry[t] = (entry[t] || 0) + 1;
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({
        label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
        ...counts,
      }));
  }, [filtered, viewMode]);

  const areaData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    filtered.forEach((r) => {
      if (!r.duration) return;
      const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
      if (!map.has(key)) map.set(key, { total: 0, count: 0 });
      const e = map.get(key)!;
      e.total += r.duration;
      e.count++;
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { total, count }]) => ({
        label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
        avg: count > 0 ? Math.round(total / count) : 0,
      }));
  }, [filtered, viewMode]);

  const staffLoad = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      if (r.staff) map[r.staff] = (map[r.staff] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        color: STAFF_COLORS[name] ?? "#7ec8a0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const t = r.mainTask || "อื่นๆ";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        color: taskColor(name),
        short: taskShort(name),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const mainTasksWithSub = useMemo(() => {
    const s = new Set<string>();
    filtered.forEach((r) => {
      if (r.subTask) s.add(r.mainTask);
    });
    return Array.from(s).sort();
  }, [filtered]);

  useEffect(() => {
    if (mainTasksWithSub.length > 0 && !selectedMainForSub) {
      setSelectedMainForSub(mainTasksWithSub[0]);
    }
  }, [mainTasksWithSub, selectedMainForSub]);

  return {
    allData,
    loading,
    error,
    fetchData,
    staffList,
    selectedStaff,
    setSelectedStaff,
    dateRange,
    setDateRange,
    viewMode,
    setViewMode,
    selectedMainForSub,
    setSelectedMainForSub,
    filtered,
    kpis,
    usedShorts,
    barData,
    areaData,
    staffLoad,
    pieData,
    mainTasksWithSub,
    shortColor: SHORT_COLOR,
  };
}
