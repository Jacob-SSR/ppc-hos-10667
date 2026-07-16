// hooks/useWorklogData.ts
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  STAFF_COLORS,
  SHORT_COLOR,
  taskColor,
  taskShort,
  taskGroup,
  SLA_SECTIONS,
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
    // ทันเวลา = มีค่า timeliness และไม่ขึ้นต้น/มีคำว่า "ไม่"
    // (รองรับทั้งสะกด "ทันเวลา" และ "ท้นเวลา" ในชีต)
    const onTimeCount = filtered.filter((r) => {
      const t = (r.timeliness ?? "").trim();
      return t !== "" && !t.includes("ไม่");
    }).length;
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

  // ร้อยละต่อช่วงเวลา: เร่งด่วน / ทันเวลา / งานพัฒนา (สำหรับกราฟแนวโน้ม)
  const statusTrendData = useMemo(() => {
    const map = new Map<
      string,
      { total: number; urgent: number; onTime: number; dev: number }
    >();
    filtered.forEach((r) => {
      const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
      if (!map.has(key))
        map.set(key, { total: 0, urgent: 0, onTime: 0, dev: 0 });
      const e = map.get(key)!;
      e.total++;
      if (r.urgency === "เร่งด่วน") e.urgent++;
      const t = (r.timeliness ?? "").trim();
      if (t !== "" && !t.includes("ไม่")) e.onTime++;
      if (r.devType === "งานพัฒนา") e.dev++;
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, e]) => ({
        label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
        เร่งด่วน: e.total > 0 ? Math.round((e.urgent / e.total) * 100) : 0,
        ทันเวลา: e.total > 0 ? Math.round((e.onTime / e.total) * 100) : 0,
        งานพัฒนา: e.total > 0 ? Math.round((e.dev / e.total) * 100) : 0,
      }));
  }, [filtered, viewMode]);

  // จำนวนงาน "ทันเวลา" ต่อเจ้าหน้าที่ ตามช่วงเวลา (สำหรับกราฟเส้นเปรียบเทียบ)
  const staffTimelinessTrend = useMemo(() => {
    const staffSet = new Set<string>();
    const map = new Map<string, Record<string, number>>();
    filtered.forEach((r) => {
      if (!r.staff) return;
      const t = (r.timeliness ?? "").trim();
      if (t === "" || t.includes("ไม่")) return; // นับเฉพาะงานที่ทันเวลา
      staffSet.add(r.staff);
      const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
      if (!map.has(key)) map.set(key, {});
      const e = map.get(key)!;
      e[r.staff] = (e[r.staff] || 0) + 1;
    });
    const staffs = Array.from(staffSet).sort();
    const rows = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({
        label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
        ...Object.fromEntries(staffs.map((s) => [s, counts[s] ?? 0])),
      }));
    return { staffs, rows };
  }, [filtered, viewMode]);

  // ความทันเวลาแยกกลุ่ม Software / Hardware
  // ต่อกลุ่ม: กราฟเส้น ทันเวลา/ไม่ทันเวลา ตามช่วงเวลา + สถิติสรุป
  const timelinessByGroup = useMemo(() => {
    return (["Software", "Hardware"] as const).map((group) => {
      const groupRows = filtered.filter((r) => taskGroup(r.mainTask) === group);
      const map = new Map<string, { onTime: number; late: number }>();
      let onTime = 0;
      let late = 0;
      const durations: number[] = [];
      const onTimeSubMap: Record<string, number> = {};
      const lateSubMap: Record<string, number> = {};

      groupRows.forEach((r) => {
        const t = (r.timeliness ?? "").trim();
        const isLate = t.includes("ไม่");
        const isOnTime = t !== "" && !isLate;
        const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
        if (!map.has(key)) map.set(key, { onTime: 0, late: 0 });
        const e = map.get(key)!;
        const subName =
          (r.subTask ?? "").trim() || (r.mainTask ?? "").trim() || "ไม่ระบุ";
        if (isOnTime) {
          e.onTime++;
          onTime++;
          onTimeSubMap[subName] = (onTimeSubMap[subName] || 0) + 1;
        }
        if (isLate) {
          e.late++;
          late++;
          lateSubMap[subName] = (lateSubMap[subName] || 0) + 1;
        }
        if (r.duration > 0) durations.push(r.duration);
      });

      // top 6 + รวมที่เหลือเป็น "อื่นๆ"
      const buildShare = (m: Record<string, number>) => {
        const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
        const top = entries
          .slice(0, 6)
          .map(([name, value]) => ({ name, value }));
        const rest = entries.slice(6).reduce((s, [, v]) => s + v, 0);
        if (rest > 0) top.push({ name: "อื่นๆ", value: rest });
        return top;
      };

      const rows = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, e]) => ({
          label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
          ทันเวลา: e.onTime,
          ไม่ทันเวลา: e.late,
        }));

      return {
        group,
        rows,
        total: groupRows.length,
        onTime,
        late,
        avgMin: durations.length
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
          : 0,
        minMin: durations.length ? Math.min(...durations) : 0,
        maxMin: durations.length ? Math.max(...durations) : 0,
        onTimeShare: buildShare(onTimeSubMap),
        lateShare: buildShare(lateSubMap),
      };
    });
  }, [filtered, viewMode]);

  // SLA Reports — Service Desk (ให้คำปรึกษา) และ Report (ระบบข้อมูลและรายงาน)
  // แยกกันคนละ section ตามที่กำหนดใน SLA_SECTIONS
  const slaReports = useMemo(() => {
    return SLA_SECTIONS.map(({ title, mainTask }) => {
      const rows = filtered.filter((r) => r.mainTask === mainTask);

      const map = new Map<string, { onTime: number; late: number }>();
      let onTime = 0;
      let late = 0;
      const durations: number[] = [];
      const deptMap: Record<string, number> = {};
      const subMap: Record<string, number> = {};

      rows.forEach((r) => {
        const t = (r.timeliness ?? "").trim();
        const isLate = t.includes("ไม่");
        const isOnTime = t !== "" && !isLate;
        const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
        if (!map.has(key)) map.set(key, { onTime: 0, late: 0 });
        const e = map.get(key)!;
        if (isOnTime) {
          e.onTime++;
          onTime++;
        }
        if (isLate) {
          e.late++;
          late++;
        }
        if (r.duration > 0) durations.push(r.duration);
        const dept = (r.department ?? "").trim();
        if (dept) deptMap[dept] = (deptMap[dept] || 0) + 1;
        const sub = (r.subTask ?? "").trim();
        if (sub) subMap[sub] = (subMap[sub] || 0) + 1;
      });

      const total = rows.length;
      const trend = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, e]) => ({
          label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
          ทันเวลา: e.onTime,
          ไม่ทันเวลา: e.late,
        }));

      const departments = Object.entries(deptMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const topSubtasks = Object.entries(subMap)
        .map(([name, count]) => ({
          name,
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        title,
        category: mainTask,
        trend,
        total,
        onTime,
        late,
        avgMin: durations.length
          ? Math.round(
              (durations.reduce((s, d) => s + d, 0) / durations.length) * 100,
            ) / 100
          : 0,
        minMin: durations.length ? Math.min(...durations) : 0,
        maxMin: durations.length ? Math.max(...durations) : 0,
        departments,
        topSubtasks,
      };
    });
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
    statusTrendData,
    staffTimelinessTrend,
    timelinessByGroup,
    slaReports,
    staffLoad,
    pieData,
    mainTasksWithSub,
    shortColor: SHORT_COLOR,
  };
}
