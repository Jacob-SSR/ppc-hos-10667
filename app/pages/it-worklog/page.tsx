// app/pages/it-worklog/page.tsx  (refactored)
// ลดจาก ~600 บรรทัด เหลือ ~180 บรรทัด
// แยก component ออกเป็น:
//   - WorklogCharts    (DailyBarChart, AvgDurationChart, StaffUrgencySection)
//   - SubTaskSection   (SubTaskBreakdown + SubTaskChart)
//   - StatCard         (จาก components/ui/StatCard)
//   - CsvDropzone      (เดิม)

"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    TrendingUp, Clock, AlertTriangle, Activity, Users, Info,
    Calendar, RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from "recharts";
import CsvDropzone from "@/app/components/CsvDropzone";
import { StatCard } from "@/app/components/ui/StatCard";
import { Shimmer } from "@/app/components/ui/Shimmer";
import { DailyBarChart, AvgDurationChart, StaffUrgencySection } from "./components/WorklogCharts";
import { SubTaskSection } from "./components/SubTaskSection";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkRow {
    date: string;
    staff: string;
    mainTask: string;
    subTask: string;
    urgency: string;
    devType: string;
    duration: number;
    department: string;
    timeliness: string;
    [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MINT = { 500: "#3aa36a", 700: "#236b43" };

const TASK_CFG: Record<string, { color: string; short: string }> = {
    "ระบบ HosXP": { color: "#0ea5e9", short: "HosXP" },
    "ระบบ KPHIS": { color: MINT[500], short: "KPHIS" },
    "ระบบ Network": { color: "#10b981", short: "Network" },
    "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง": { color: "#f59e0b", short: "คอมฯ" },
    "ระบบข้อมูล และรายงาน": { color: "#8b5cf6", short: "รายงาน" },
    "ระบบอื่นๆ": { color: "#94a3b8", short: "อื่นๆ" },
    "ระบบเอกสาร": { color: "#ec4899", short: "เอกสาร" },
    "ระบบ  HosOffice": { color: "#f97316", short: "HosOffice" },
    "ระบบ  GTWOffice": { color: "#14b8a6", short: "GTWOffice" },
    "ระบบอินทราเน็ต": { color: "#55b882", short: "Intranet" },
    "ให้คำปรึกษาด้านไอที": { color: "#64748b", short: "ปรึกษา" },
    "แก้ไขปรับปรุง ระบบความเสี่ยง": { color: "#ef4444", short: "ความเสี่ยง" },
};

const STAFF_COLORS: Record<string, string> = {
    "นายรุจิศักดิ์ บวรชาติ": MINT[500],
    "นายชิต คุมสุข": "#0ea5e9",
    "นายวีระเทพ ทองใส": "#f59e0b",
    "นายทีปกร เสงี่ยมศักดิ์": "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtShort(d: string) {
    const [, m, day] = d.split("-").map(Number);
    return `${day} ${THAI_MONTHS[m] ?? ""}`;
}
function fmtMonth(d: string) {
    const [y, m] = d.split("-").map(Number);
    return `${THAI_MONTHS[m]} ${String(y + 543).slice(2)}`;
}
const taskColor = (t: string) => TASK_CFG[t]?.color ?? "#94a3b8";
const taskShort = (t: string) => TASK_CFG[t]?.short ?? t;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ItWorklogPage() {
    const [allData, setAllData] = useState<WorkRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStaff, setSelectedStaff] = useState("ทั้งหมด");
    const [dateRange, setDateRange] = useState(30);
    const [viewMode, setViewMode] = useState<"day" | "month">("day");
    const [selectedMainForSub, setSelectedMainForSub] = useState("");

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/it-worklog-csv", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setAllData(Array.isArray(json) ? json : []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Derived ───────────────────────────────────────────────────────────────
    const staffList = useMemo(() =>
        ["ทั้งหมด", ...Array.from(new Set(allData.map((r) => r.staff).filter(Boolean))).sort()],
        [allData]);

    const filtered = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - dateRange);
        const cutStr = cutoff.toISOString().slice(0, 10);
        return allData.filter((r) => {
            if (selectedStaff !== "ทั้งหมด" && r.staff !== selectedStaff) return false;
            return r.date >= cutStr;
        });
    }, [allData, selectedStaff, dateRange]);

    // KPIs
    const totalJobs = filtered.length;
    const totalMin = filtered.reduce((s, r) => s + r.duration, 0);
    const avgMin = totalJobs > 0 ? Math.round(totalMin / totalJobs) : 0;
    const urgentCount = filtered.filter((r) => r.urgency === "เร่งด่วน").length;
    const onTimeCount = filtered.filter((r) => r.timeliness?.includes("ท้น")).length;
    const devCount = filtered.filter((r) => r.devType === "งานพัฒนา").length;

    // Chart data
    const shortColor: Record<string, string> = {};
    Object.entries(TASK_CFG).forEach(([, v]) => { shortColor[v.short] = v.color; });

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
            const e = map.get(key)!;
            const t = taskShort(r.mainTask) || "อื่นๆ";
            e[t] = (e[t] || 0) + 1;
        });
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
            .map(([key, counts]) => ({ label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key), ...counts }));
    }, [filtered, viewMode]);

    const areaData = useMemo(() => {
        const map = new Map<string, { total: number; count: number }>();
        filtered.forEach((r) => {
            if (!r.duration) return;
            const key = viewMode === "month" ? r.date.slice(0, 7) : r.date;
            if (!map.has(key)) map.set(key, { total: 0, count: 0 });
            const e = map.get(key)!; e.total += r.duration; e.count++;
        });
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
            .map(([key, { total, count }]) => ({
                label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
                avg: count > 0 ? Math.round(total / count) : 0,
            }));
    }, [filtered, viewMode]);

    const staffLoad = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((r) => { if (r.staff) map[r.staff] = (map[r.staff] || 0) + 1; });
        return Object.entries(map).map(([name, count]) => ({
            name, count, color: STAFF_COLORS[name] ?? "#7ec8a0",
        })).sort((a, b) => b.count - a.count);
    }, [filtered]);

    const pieData = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((r) => { const t = r.mainTask || "อื่นๆ"; map[t] = (map[t] || 0) + 1; });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value, color: taskColor(name), short: taskShort(name) }))
            .sort((a, b) => b.value - a.value);
    }, [filtered]);

    const mainTasksWithSub = useMemo(() => {
        const s = new Set<string>();
        filtered.forEach((r) => { if (r.subTask) s.add(r.mainTask); });
        return Array.from(s).sort();
    }, [filtered]);

    useEffect(() => {
        if (mainTasksWithSub.length > 0 && !selectedMainForSub) {
            setSelectedMainForSub(mainTasksWithSub[0]);
        }
    }, [mainTasksWithSub, selectedMainForSub]);

    const hasData = !loading && allData.length > 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-bold text-[#717171] mb-3">
                    บันทึกงานประจำวัน — เจ้าหน้าที่ไอที
                </h4>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 text-[#717171]">
                        <Calendar size={16} />
                        <div>
                            <p className="text-sm">ข้อมูลตามช่วงเวลา</p>
                            <p className="text-xs text-gray-400">โหลดจาก data/it-worklog.csv</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                        {/* Date range */}
                        <div className="flex rounded-md overflow-hidden border border-gray-200">
                            {[7, 30, 90, 180, 365].map((d) => (
                                <button key={d} onClick={() => setDateRange(d)}
                                    className="px-3 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: dateRange === d ? MINT[500] : "white",
                                        color: dateRange === d ? "white" : "#4b5563",
                                        fontWeight: dateRange === d ? 600 : 400,
                                    }}>
                                    {d}ว.
                                </button>
                            ))}
                            <button onClick={() => setDateRange(99999)}
                                className="px-3 py-1.5 text-sm transition-colors"
                                style={{
                                    backgroundColor: dateRange === 99999 ? MINT[500] : "white",
                                    color: dateRange === 99999 ? "white" : "#4b5563",
                                    fontWeight: dateRange === 99999 ? 600 : 400,
                                }}>
                                ทั้งหมด
                            </button>
                        </div>

                        {/* View toggle */}
                        <div className="flex rounded-md overflow-hidden border border-gray-200">
                            {(["day", "month"] as const).map((m) => (
                                <button key={m} onClick={() => setViewMode(m)}
                                    className="px-3 py-1.5 text-sm transition-colors"
                                    style={{
                                        backgroundColor: viewMode === m ? MINT[700] : "white",
                                        color: viewMode === m ? "white" : "#4b5563",
                                        fontWeight: viewMode === m ? 600 : 400,
                                    }}>
                                    {m === "day" ? "รายวัน" : "รายเดือน"}
                                </button>
                            ))}
                        </div>

                        {/* Staff filter */}
                        <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
                            disabled={loading}
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white disabled:opacity-50">
                            {staffList.map((s) => <option key={s}>{s}</option>)}
                        </select>

                        {/* Refresh */}
                        <button onClick={fetchData} disabled={loading}
                            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors">
                            {loading
                                ? <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
                                : <RefreshCw size={14} />}
                            รีเฟรช
                        </button>
                    </div>
                </div>

                {/* Info bar */}
                <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
                    <Info size={14} />
                    {error
                        ? <span className="text-red-500">{error}</span>
                        : <span>
                            แสดงข้อมูล:{" "}
                            <span className="font-bold">
                                {loading ? "กำลังโหลด..." : `${filtered.length.toLocaleString()} รายการ (ทั้งหมด ${allData.length.toLocaleString()} รายการ)`}
                            </span>
                        </span>
                    }
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} h="h-[168px]" />)
                        : <>
                            <StatCard icon={TrendingUp} label="งานทั้งหมด" value={totalJobs.toLocaleString()} sub="รายการ" bg="#E0F2FE" accent="#0369A1" delay={0} />
                            <StatCard icon={Clock} label="เฉลี่ยต่องาน" value={`${avgMin} นาที`} sub={`รวม ${Math.round(totalMin / 60)} ชม.`} bg="#FEF9C3" accent="#854D0E" delay={0.04} />
                            <StatCard icon={AlertTriangle} label="งานเร่งด่วน" value={urgentCount.toLocaleString()} sub={`${totalJobs > 0 ? Math.round(urgentCount / totalJobs * 100) : 0}%`} bg="#FEE2E2" accent="#991B1B" delay={0.08} />
                            <StatCard icon={Activity} label="งานพัฒนา" value={devCount.toLocaleString()} sub={`จาก ${totalJobs}`} bg="#EDE9FE" accent="#5B21B6" delay={0.12} />
                            <StatCard icon={Users} label="เจ้าหน้าที่" value={new Set(filtered.map((r) => r.staff).filter(Boolean)).size} sub="คน" bg="#D1FAE5" accent="#065F46" delay={0.16} />
                            <StatCard icon={TrendingUp} label="ทันเวลา" value={`${totalJobs > 0 ? Math.round(onTimeCount / totalJobs * 100) : 0}%`} sub={`${onTimeCount} รายการ`} bg="#CCFBF1" accent="#134E4A" delay={0.20} />
                        </>
                    }
                </div>
            </div>

            {/* Charts */}
            {hasData && (
                <DailyBarChart data={barData} usedShorts={usedShorts} shortColor={shortColor} viewMode={viewMode} />
            )}

            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pie chart — สัดส่วนประเภทงาน */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">สัดส่วนประเภทงาน</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                            <div className="w-2 h-2 rounded-full" style={{ background: MINT[500] }} />
                            แสดงข้อมูล: <strong className="text-gray-700">{filtered.length.toLocaleString()} รายการ</strong>
                        </div>
                        {/* Pie + legend แนวตั้ง: chart บน legend ล่าง เพื่อไม่ให้ถูกตัด */}
                        <div className="flex flex-col items-center gap-4">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%" cy="50%"
                                        outerRadius={95} innerRadius={50}
                                        dataKey="value"
                                        paddingAngle={2}
                                        label={({ percent }) =>
                                            (percent ?? 0) > 0.05
                                                ? `${((percent ?? 0) * 100).toFixed(0)}%`
                                                : ""
                                        }
                                        labelLine={false}
                                    >
                                        {pieData.map((e, i) => (
                                            <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <PieTooltip
                                        formatter={(v: number | undefined, _, p) => [`${v ?? 0} งาน`, p?.payload?.name]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Legend grid 2 คอลัมน์ */}
                            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {pieData.map((t) => (
                                    <div key={t.name} className="flex items-center gap-2 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
                                        <span className="text-xs text-gray-600 truncate flex-1">{t.short}</span>
                                        <span className="text-xs font-bold text-gray-800 tabular-nums shrink-0">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <AvgDurationChart data={areaData} avgMin={avgMin} />
                </div>
            )}

            {hasData && (
                <SubTaskSection
                    filtered={filtered}
                    mainTasksWithSub={mainTasksWithSub}
                    selectedMain={selectedMainForSub}
                    onSelectMain={setSelectedMainForSub}
                />
            )}

            {hasData && (
                <StaffUrgencySection
                    staffLoad={staffLoad}
                    totalJobs={totalJobs}
                    urgentCount={urgentCount}
                    devCount={devCount}
                />
            )}

            {/* ── Recent table ── */}
            {hasData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-[#717171]">รายการล่าสุด</h4>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full border"
                            style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                            {filtered.length.toLocaleString()} รายการ
                        </span>
                    </div>
                    <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    {["วันที่", "เจ้าหน้าที่", "ประเภทงาน", "หมวดย่อย", "เวลา (นาที)", "ความเร่งด่วน"].map((h) => (
                                        <th key={h}
                                            className="sticky top-0 text-white px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r"
                                            style={{ backgroundColor: MINT[700], borderColor: "#1a5233" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice().reverse().slice(0, 100).map((row, i) => {
                                    const isEven = i % 2 === 0;
                                    const baseColor = isEven ? "#ffffff" : "#f9fafb";
                                    return (
                                        <tr key={i}
                                            className="border-b border-gray-100 transition-colors duration-100"
                                            style={{ backgroundColor: baseColor }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = baseColor)}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                                {(() => { const [, m, d] = row.date.split("-").map(Number); return `${d} ${["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][m] ?? ""}`; })()}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ background: STAFF_COLORS[row.staff] ?? MINT[500] }} />
                                                    <span className="font-medium text-gray-800">{row.staff}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                                                    style={{ background: taskColor(row.mainTask) }}>
                                                    {taskShort(row.mainTask) || row.mainTask}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                                                {row.subTask ? (
                                                    <span
                                                        className="inline-block px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-full"
                                                        style={{
                                                            background: taskColor(row.mainTask) + "14",
                                                            color: taskColor(row.mainTask),
                                                            border: `1px solid ${taskColor(row.mainTask)}33`,
                                                        }}
                                                        title={row.subTask}
                                                    >
                                                        {row.subTask}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center font-medium text-gray-700">
                                                {row.duration || "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.urgency === "เร่งด่วน" ? "bg-red-100 text-red-700" : "text-white"}`}
                                                    style={row.urgency !== "เร่งด่วน" ? { background: MINT[500] } : {}}>
                                                    {row.urgency}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <CsvDropzone onUploadSuccess={fetchData} />
        </div>
    );
}