"use client";

import { useEffect, useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell,
    AreaChart, Area,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
    Monitor, Wifi, FileText, Server, Database,
    Clock, AlertTriangle, TrendingUp, Calendar, Users,
    Activity, Info, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import CsvDropzone from "@/app/components/CsvDropzone";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkRow {
    date: string;
    staff: string;
    mainTask: string;
    subTask: string;
    subHosXP: string;
    subIntranet: string;
    subComputer: string;
    subNetwork: string;
    subReport: string;
    subOther: string;
    subDoc: string;
    urgency: string;
    devType: string;
    duration: number;
    department: string;
    timeliness: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const MINT = {
    50: "#f0faf4",
    100: "#d6f0e0",
    200: "#a8d5ba",
    300: "#7ec8a0",
    400: "#55b882",
    500: "#3aa36a",
    600: "#2d8a56",
    700: "#236b43",
    800: "#1a5233",
};

// ── Task config ───────────────────────────────────────────────────────────────
const TASK_CFG: Record<string, { color: string; short: string; icon: React.ReactNode }> = {
    "ระบบ HosXP": { color: "#0ea5e9", short: "HosXP", icon: <Database size={13} /> },
    "ระบบ KPHIS": { color: MINT[500], short: "KPHIS", icon: <Server size={13} /> },
    "ระบบ Network": { color: "#10b981", short: "Network", icon: <Wifi size={13} /> },
    "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง": { color: "#f59e0b", short: "คอมฯ", icon: <Monitor size={13} /> },
    "ระบบข้อมูล และรายงาน": { color: "#8b5cf6", short: "รายงาน", icon: <FileText size={13} /> },
    "ระบบอื่นๆ": { color: "#94a3b8", short: "อื่นๆ", icon: <Activity size={13} /> },
    "ระบบเอกสาร": { color: "#ec4899", short: "เอกสาร", icon: <FileText size={13} /> },
    "ระบบ  HosOffice": { color: "#f97316", short: "HosOffice", icon: <Server size={13} /> },
    "ระบบ  GTWOffice": { color: "#14b8a6", short: "GTWOffice", icon: <Server size={13} /> },
    "ระบบอินทราเน็ต": { color: MINT[400], short: "Intranet", icon: <Wifi size={13} /> },
    "ให้คำปรึกษาด้านไอที": { color: "#64748b", short: "ปรึกษา", icon: <Users size={13} /> },
    "แก้ไขปรับปรุง ระบบความเสี่ยง": { color: "#ef4444", short: "ความเสี่ยง", icon: <AlertTriangle size={13} /> },
};

const STAFF_COLORS: Record<string, string> = {
    "นายรุจิศักดิ์ บวรชาติ": MINT[500],
    "นายชิต คุมสุข": "#0ea5e9",
    "นายวีระเทพ ทองใส": "#f59e0b",
    "นายทีปกร เสงี่ยมศักดิ์": "#8b5cf6",
};

const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtShort(d: string) {
    const [, m, day] = d.split("-").map(Number);
    return `${day} ${THAI_MONTHS[m] ?? ""}`;
}
function fmtMonth(d: string) {
    const [y, m] = d.split("-").map(Number);
    return `${THAI_MONTHS[m]} ${String(y + 543).slice(2)}`;
}
function taskColor(t: string) { return TASK_CFG[t]?.color ?? "#94a3b8"; }
function taskShort(t: string) { return TASK_CFG[t]?.short ?? t; }

// ── Shimmer ───────────────────────────────────────────────────────────────────
function Shimmer({ className = "h-40" }: { className?: string }) {
    return <div className={`${className} rounded-xl bg-gray-100 animate-pulse`} />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function StatCard({
    icon: Icon, label, value, sub, bg, accent, delay = 0,
}: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; bg: string; accent: string; delay?: number;
}) {
    return (
        <motion.div
            className="rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            style={{ backgroundColor: bg }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: accent + "22" }}>
                <Icon size={22} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <p className="text-xs font-bold text-center leading-snug tracking-wide" style={{ color: accent }}>
                {label}
            </p>
            <p className="text-lg font-extrabold text-center tabular-nums" style={{ color: accent }}>
                {value}
            </p>
            {sub && (
                <p className="text-[10px] text-center" style={{ color: accent + "99" }}>{sub}</p>
            )}
        </motion.div>
    );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipPayloadItem {
    value?: number;
    name?: string;
    fill?: string;
    stroke?: string;
}

function ChartTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs">
            <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
            {payload.filter((p) => (p.value ?? 0) > 0).map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.fill ?? p.stroke }} />
                    <span className="text-gray-600">{p.name}</span>
                    <span className="font-bold text-gray-900 ml-auto pl-3">{p.value}</span>
                </div>
            ))}
        </div>
    );
}

// ── SubTask Breakdown Card ────────────────────────────────────────────────────
// แสดงรายการหมวดย่อยภายในหมวดหลัก พร้อม bar สัดส่วน
function SubTaskBreakdown({ data }: { data: { mainTask: string; subTask: string; count: number }[] }) {
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    // Group by mainTask
    const grouped = useMemo(() => {
        const map = new Map<string, { sub: string; count: number }[]>();
        for (const row of data) {
            if (!row.subTask) continue;
            if (!map.has(row.mainTask)) map.set(row.mainTask, []);
            const existing = map.get(row.mainTask)!.find((s) => s.sub === row.subTask);
            if (existing) {
                existing.count += row.count;
            } else {
                map.get(row.mainTask)!.push({ sub: row.subTask, count: row.count });
            }
        }
        // sort sub by count desc
        for (const [, subs] of map) subs.sort((a, b) => b.count - a.count);
        // sort main by total count desc
        return Array.from(map.entries())
            .map(([main, subs]) => ({
                main,
                subs,
                total: subs.reduce((s, r) => s + r.count, 0),
            }))
            .sort((a, b) => b.total - a.total);
    }, [data]);

    if (grouped.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-1">หมวดย่อยภายในแต่ละหมวดหลัก</h4>
            <p className="text-xs text-gray-400 mb-4">คลิกหมวดหลักเพื่อดูรายละเอียดหมวดย่อย</p>

            <div className="space-y-2">
                {grouped.map((g, gi) => {
                    const color = taskColor(g.main);
                    const isOpen = expandedTask === g.main;
                    const maxSub = g.subs[0]?.count ?? 0;

                    return (
                        <div key={g.main} className="border border-gray-100 rounded-xl overflow-hidden">
                            {/* Header row — คลิกเพื่อ expand */}
                            <button
                                onClick={() => setExpandedTask(isOpen ? null : g.main)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                {/* Color dot */}
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />

                                {/* Main task label */}
                                <span className="flex-1 text-sm font-semibold text-gray-800 truncate">
                                    {g.main}
                                </span>

                                {/* Subtask count badge */}
                                <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                    style={{ background: color + "18", color }}
                                >
                                    {g.subs.length} หมวดย่อย
                                </span>

                                {/* Total jobs */}
                                <span className="text-sm font-extrabold tabular-nums shrink-0" style={{ color }}>
                                    {g.total} งาน
                                </span>

                                {/* Chevron */}
                                <motion.span
                                    animate={{ rotate: isOpen ? 90 : 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="text-gray-400 shrink-0"
                                >
                                    <ChevronRight size={16} />
                                </motion.span>
                            </button>

                            {/* Expanded sub-task list */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="overflow-hidden border-t border-gray-100"
                                    >
                                        <div className="px-4 py-3 space-y-2.5 bg-gray-50/60">
                                            {g.subs.map((s, si) => {
                                                const pct = maxSub > 0 ? (s.count / maxSub) * 100 : 0;
                                                return (
                                                    <motion.div
                                                        key={s.sub}
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: si * 0.03 }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs text-gray-700 truncate max-w-[75%]">
                                                                {s.sub}
                                                            </span>
                                                            <span className="text-xs font-bold tabular-nums" style={{ color }}>
                                                                {s.count}
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                                                            <motion.div
                                                                className="h-full rounded-full"
                                                                style={{ background: color + "cc" }}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.5, ease: "easeOut", delay: si * 0.03 }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── SubTask Heatmap / Distribution ────────────────────────────────────────────
// Horizontal bar chart แสดงหมวดย่อยของ mainTask ที่เลือก
function SubTaskChart({ filtered, selectedMain }: { filtered: WorkRow[]; selectedMain: string }) {
    const data = useMemo(() => {
        const map: Record<string, number> = {};
        filtered
            .filter((r) => r.mainTask === selectedMain && r.subTask)
            .forEach((r) => { map[r.subTask] = (map[r.subTask] || 0) + 1; });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filtered, selectedMain]);

    if (data.length === 0) return (
        <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            ไม่มีหมวดย่อยสำหรับหมวดนี้
        </div>
    );

    const color = taskColor(selectedMain);
    const max = data[0]?.value ?? 1;

    return (
        <div className="space-y-2">
            {data.map((d, i) => (
                <div key={d.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 truncate max-w-[78%]">{d.name}</span>
                        <span className="font-bold tabular-nums" style={{ color }}>{d.value}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.value / max) * 100}%` }}
                            transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ItWorklogPage() {
    const [allData, setAllData] = useState<WorkRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStaff, setSelectedStaff] = useState("ทั้งหมด");
    const [dateRange, setDateRange] = useState(30);
    const [viewMode, setViewMode] = useState<"day" | "month">("day");
    const [selectedMainForSub, setSelectedMainForSub] = useState<string>("");

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
            .map(([key, counts]) => ({
                label: viewMode === "month" ? fmtMonth(key + "-01") : fmtShort(key),
                ...counts,
            }));
    }, [filtered, viewMode]);

    const pieData = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((r) => { const t = r.mainTask || "อื่นๆ"; map[t] = (map[t] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({
            name, value, color: taskColor(name), short: taskShort(name),
        })).sort((a, b) => b.value - a.value);
    }, [filtered]);

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
            name, count, color: STAFF_COLORS[name] ?? MINT[300],
        })).sort((a, b) => b.count - a.count);
    }, [filtered]);

    // ── Sub-task breakdown data ───────────────────────────────────────────────
    const subTaskData = useMemo(() => {
        return filtered
            .filter((r) => r.subTask)
            .map((r) => ({ mainTask: r.mainTask, subTask: r.subTask, count: 1 }));
    }, [filtered]);

    // List of mainTasks that have subTasks (for dropdown)
    const mainTasksWithSub = useMemo(() => {
        const s = new Set<string>();
        filtered.forEach((r) => { if (r.subTask) s.add(r.mainTask); });
        return Array.from(s).sort();
    }, [filtered]);

    // Set default selected main task
    useEffect(() => {
        if (mainTasksWithSub.length > 0 && !selectedMainForSub) {
            setSelectedMainForSub(mainTasksWithSub[0]);
        }
    }, [mainTasksWithSub]);

    const hasData = !loading && allData.length > 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ── Header section ───────────────────────────────────────────── */}
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
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
                        >
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
                        ? <span className="text-red-500">
                            {error} — ตรวจสอบว่ามีไฟล์ <code className="bg-red-50 px-1 rounded text-xs">data/it-worklog.csv</code>
                        </span>
                        : <span>
                            แสดงข้อมูล การ์ด:{" "}
                            <span className="font-bold">
                                {loading ? "กำลังโหลด..." : `${filtered.length.toLocaleString()} รายการ (ทั้งหมด ${allData.length.toLocaleString()} รายการ)`}
                            </span>
                        </span>
                    }
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-[168px] rounded-2xl bg-gray-100 animate-pulse" />
                        ))
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

            {/* ── Chart: งานแต่ละวัน ────────────────────────────────────────── */}
            {hasData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-base font-bold text-[#717171] mb-4">
                        จำนวนงาน{viewMode === "day" ? "แต่ละวัน" : "แต่ละเดือน"} แยกตามประเภท
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                            {usedShorts.map((short, i) => (
                                <Bar key={short} dataKey={short} stackId="a"
                                    fill={shortColor[short] ?? "#94a3b8"}
                                    radius={i === usedShorts.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        {usedShorts.map((s) => (
                            <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
                                style={{ background: shortColor[s] ?? "#94a3b8" }}>
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Pie + Area ────────────────────────────────────────────────── */}
            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">สัดส่วนประเภทงาน</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                            <div className="w-2 h-2 rounded-full" style={{ background: MINT[500] }} />
                            แสดงข้อมูล: <strong className="text-gray-700">{filtered.length.toLocaleString()} รายการ</strong>
                        </div>
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="55%" height={200}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={45}
                                        dataKey="value" paddingAngle={2}
                                        label={({ percent }) => (percent ?? 0) > 0.06 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                                        labelLine={false}>
                                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number | undefined, _, p) => [`${v ?? 0} งาน`, p?.payload?.name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {pieData.slice(0, 7).map((t) => (
                                    <div key={t.name} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
                                        <span className="text-xs text-gray-600 flex-1 truncate">{t.short}</span>
                                        <span className="text-xs font-bold text-gray-800 tabular-nums">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">ระยะเวลาเฉลี่ยต่องาน (นาที)</h4>
                        {areaData.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-sm text-gray-300">ไม่มีข้อมูลระยะเวลา</div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                    <div className="w-2 h-2 rounded-full" style={{ background: MINT[500] }} />
                                    เฉลี่ยทุกงาน: <strong className="text-gray-700">{avgMin} นาที</strong>
                                </div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={areaData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="mintGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={MINT[400]} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={MINT[400]} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} นาที`, "เฉลี่ย"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                                        <Area type="monotone" dataKey="avg" stroke={MINT[500]} strokeWidth={2.5} fill="url(#mintGrad)" dot={false} activeDot={{ r: 4, fill: MINT[500] }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── SubTask Breakdown (NEW) ───────────────────────────────────── */}
            {hasData && subTaskData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Accordion list ทุกหมวดหลัก */}
                    <SubTaskBreakdown data={subTaskData} />

                    {/* Right: Bar chart ของหมวดที่เลือก */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h4 className="text-base font-bold text-[#717171]">หมวดย่อยของ</h4>
                            <select
                                value={selectedMainForSub}
                                onChange={(e) => setSelectedMainForSub(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-400"
                                style={{ maxWidth: "220px" }}
                            >
                                {mainTasksWithSub.map((m) => (
                                    <option key={m} value={m}>{TASK_CFG[m]?.short ?? m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Color indicator */}
                        {selectedMainForSub && (
                            <div className="flex items-center gap-2 mb-4 text-xs">
                                <div className="w-3 h-3 rounded-full" style={{ background: taskColor(selectedMainForSub) }} />
                                <span className="text-gray-600 font-medium">{selectedMainForSub}</span>
                                <span className="text-gray-400 ml-auto">
                                    {filtered.filter((r) => r.mainTask === selectedMainForSub && r.subTask).length} งาน
                                </span>
                            </div>
                        )}

                        <div className="overflow-y-auto max-h-[340px] pr-1">
                            <SubTaskChart filtered={filtered} selectedMain={selectedMainForSub} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Staff + Urgency ───────────────────────────────────────────── */}
            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">ปริมาณงานต่อเจ้าหน้าที่</h4>
                        <div className="space-y-4">
                            {staffLoad.map((s, i) => {
                                const pct = staffLoad[0].count > 0 ? (s.count / staffLoad[0].count) * 100 : 0;
                                return (
                                    <div key={s.name}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                                                <span className="font-medium text-gray-700 truncate">{s.name}</span>
                                            </div>
                                            <span className="font-bold text-gray-900 tabular-nums">{s.count} งาน</span>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden" style={{ background: MINT[50] }}>
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: s.color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: "easeOut" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-base font-bold text-[#717171] mb-4">ระดับความเร่งด่วน</h4>
                        <div className="space-y-4 pt-2">
                            {[
                                { label: "เร่งด่วน", count: urgentCount, color: "#ef4444" },
                                { label: "ไม่เร่งด่วน", count: totalJobs - urgentCount, color: MINT[500] },
                            ].map((u) => {
                                const pct = totalJobs > 0 ? (u.count / totalJobs) * 100 : 0;
                                return (
                                    <div key={u.label}>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: u.color }} />
                                                <span className="font-medium text-gray-700">{u.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{u.count.toLocaleString()}</span>
                                                <span className="text-xs text-gray-400">({Math.round(pct)}%)</span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: u.color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.7, ease: "easeOut" }} />
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">ประเภทการดำเนินงาน</p>
                                {[
                                    { label: "งานพัฒนา", count: devCount, color: "#8b5cf6" },
                                    { label: "งานประจำ / บริการ", count: totalJobs - devCount, color: MINT[500] },
                                ].map((u) => {
                                    const pct = totalJobs > 0 ? (u.count / totalJobs) * 100 : 0;
                                    return (
                                        <div key={u.label} className="mb-3">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">{u.label}</span>
                                                <span className="font-bold text-gray-900">
                                                    {u.count.toLocaleString()}{" "}
                                                    <span className="text-xs text-gray-400">({Math.round(pct)}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                                                <motion.div className="h-full rounded-full" style={{ background: u.color }}
                                                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.6, ease: "easeOut" }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Recent table ──────────────────────────────────────────────── */}
            {hasData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-[#717171]">รายการล่าสุด</h4>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full border"
                            style={{ backgroundColor: MINT[50], borderColor: MINT[200], color: MINT[800] }}>
                            {filtered.length.toLocaleString()} รายการ
                        </span>
                    </div>
                    <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    {["วันที่", "เจ้าหน้าที่", "ประเภทงาน", "หมวดย่อย", "เวลา (นาที)", "ความเร่งด่วน"].map((h) => (
                                        <th key={h} className="sticky top-0 text-white px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r"
                                            style={{ backgroundColor: MINT[700], borderColor: MINT[600] }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice().reverse().slice(0, 100).map((row, i) => {
                                    return (
                                        <tr key={i}
                                            className={`border-b border-gray-100 transition-colors duration-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = MINT[50])}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#ffffff" : "#f9fafb")}>
                                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtShort(row.date)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ background: STAFF_COLORS[row.staff] ?? MINT[300] }} />
                                                    <span className="font-medium text-gray-800">{row.staff}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                                                    style={{ background: taskColor(row.mainTask) }}>
                                                    {taskShort(row.mainTask) || row.mainTask}
                                                </span>
                                            </td>
                                            {/* ← หมวดย่อย column ใหม่ */}
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
                                            <td className="px-3 py-2 text-center font-medium text-gray-700">{row.duration || "—"}</td>
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