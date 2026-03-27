"use client";

import { useEffect, useState, useCallback } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Chart as ChartJS, CategoryScale, LinearScale,
    PointElement, LineElement, BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, UserX, MapPin, Stethoscope, Baby, HeartPulse,
    TrendingUp, TrendingDown, Banknote, RefreshCw,
    ChevronRight, Calendar, BarChart2, Minus,
} from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardSummary {
    totalVisit: number; totalPatient: number; noEndpoint: number;
    ucOutside: number; ucOutsideDental: number; unpaidTotal: number;
}
interface PpaSummary { aging: number; ncd: number; mch01: number; mch02: number; }
interface DailyRow {
    date: string | Date; totalVisit: number; totalPatient: number;
    noEndpoint: number; ucOutside: number;
}
interface LatestRow {
    date: string | Date; name: string; dept?: string;
    hospName?: string; pttype: string; income: number;
}
interface DashboardData {
    summary: DashboardSummary; ppa: PpaSummary; daily: DailyRow[];
    latestNoEndpoint: LatestRow[]; latestUcOutside: LatestRow[];
    start: string | Date; end: string | Date;
}
interface MonthlyRow {
    month: string; label: string;
    totalVisit: number; totalPatient: number;
    noEndpoint: number; ucOutside: number; unpaidTotal: number;
    visitChange: number | null; patientChange: number | null;
    noEndpointChange: number | null; ucOutsideChange: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function thaiShortDate(iso: any) {
    if (!iso) return "";
    const str = iso instanceof Date ? iso.toISOString().slice(0, 10) : String(iso).slice(0, 10);
    const [y, m, d] = str.split("-");
    const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${parseInt(d)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────
function Shimmer({ className = "" }: { className?: string }) {
    return <div className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-xl ${className}`} />;
}

function MomBadge({ value }: { value: number | null }) {
    if (value === null) return <span className="text-gray-300 text-xs">—</span>;
    const up = value > 0; const flat = value === 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md
            ${flat ? "bg-gray-100 text-gray-500" : up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {flat ? <Minus size={11} /> : up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {flat ? "0%" : `${up ? "+" : ""}${value}%`}
        </span>
    );
}

function KpiCard({ title, value, icon, color, textColor, borderColor, loading, suffix, delay = 0 }: {
    title: string; value: number | string; icon: React.ReactNode;
    color: string; textColor: string; borderColor: string;
    loading?: boolean; suffix?: string; delay?: number;
}) {
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
            className={`bg-white rounded-2xl border-l-4 ${borderColor} shadow-sm p-5 flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">{title}</p>
                {loading ? <Shimmer className="h-8 w-24 mt-1" />
                    : <p className={`text-2xl font-extrabold ${textColor} mt-0.5 leading-tight`}>
                        {typeof value === "number" ? value.toLocaleString() : value}
                        {suffix && <span className="text-sm font-medium ml-1 text-gray-500">{suffix}</span>}
                    </p>}
            </div>
        </motion.div>
    );
}

function SectionCard({ title, children, delay = 0 }: { title: React.ReactNode; children: React.ReactNode; delay?: number }) {
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 240, damping: 24 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.06)" }}>
            <div className="mb-4 text-sm font-bold text-gray-700">{title}</div>
            {children}
        </motion.div>
    );
}

function MiniTable({ rows, cols }: {
    rows: any[];
    cols: { key: string; label: string; render?: (v: any, row: any) => React.ReactNode }[];
}) {
    if (!rows.length) return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
            <span className="text-2xl">🗂️</span><p className="text-xs">ไม่มีข้อมูล</p>
        </div>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100">
                    {cols.map(c => <th key={c.key} className="text-left py-2 px-3 font-semibold text-gray-500 whitespace-nowrap">{c.label}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={`border-b border-gray-50 hover:bg-green-50/50 transition-colors ${i % 2 ? "bg-gray-50/50" : ""}`}>
                            {cols.map(c => (
                                <td key={c.key} className="py-2 px-3 text-gray-700 whitespace-nowrap">
                                    {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? "")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Chart config ──────────────────────────────────────────────────────────────
const chartFont = { family: "Prompt, sans-serif", size: 11 };
const baseScales = {
    x: { ticks: { color: "#94a3b8", font: chartFont, maxRotation: 45 }, grid: { color: "#f1f5f9" } },
    y: { ticks: { color: "#94a3b8", font: chartFont }, grid: { color: "#f1f5f9" }, beginAtZero: true },
};
const baseLegend = { labels: { color: "#475569", font: chartFont, boxWidth: 12, padding: 12 } };

// ── Monthly Table ─────────────────────────────────────────────────────────────
function MonthlyTable({ rows, loading }: { rows: MonthlyRow[]; loading: boolean }) {
    if (loading) return <Shimmer className="h-48 w-full" />;
    if (!rows.length) return (
        <div className="flex flex-col items-center py-16 gap-2 text-gray-400">
            <p className="text-sm">ไม่มีข้อมูล</p>
        </div>
    );

    type Col = { key: string; label: string; render?: (v: any, row: MonthlyRow) => React.ReactNode };

    const cols: Col[] = [
        {
            key: "label",
            label: "เดือน",
            render: (v: string) => (
                <span className="font-bold text-gray-900">{v}</span>
            )
        },
        {
            key: "totalVisit",
            label: "Visit",
            render: (v: number, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                        {v.toLocaleString()}
                    </span>
                    <MomBadge value={row.visitChange} />
                </div>
            )
        },
        {
            key: "totalPatient",
            label: "คน (HN)",
            render: (v: number, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                        {v.toLocaleString()}
                    </span>
                    <MomBadge value={row.patientChange} />
                </div>
            )
        },
        {
            key: "noEndpoint",
            label: "No Endpoint",
            render: (v: number, row) => (
                <div className="flex items-center gap-2">
                    <span className={`font-semibold ${v > 0 ? "text-red-600" : "text-gray-900"}`}>
                        {v.toLocaleString()}
                    </span>
                    <MomBadge value={row.noEndpointChange} />
                </div>
            )
        },
        {
            key: "ucOutside",
            label: "UC ต่างจังหวัด",
            render: (v: number, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-orange-600">
                        {v.toLocaleString()}
                    </span>
                    <MomBadge value={row.ucOutsideChange} />
                </div>
            )
        },
        {
            key: "unpaidTotal",
            label: "ค้างชำระ (บาท)",
            render: (v: number) => (
                <span className="font-semibold text-amber-700">
                    {Math.round(v).toLocaleString()}
                </span>
            )
        },
    ];

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr>
                        {cols.map(c => (
                            <th
                                key={c.key}
                                className="sticky top-0 bg-green-800 text-white px-4 py-3 text-left whitespace-nowrap border-r border-green-700 text-xs font-semibold"
                            >
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, i) => (
                        <motion.tr
                            key={row.month}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`
                                border-b border-gray-200
                                ${i % 2 ? "bg-gray-50" : "bg-white"}
                                hover:bg-green-100
                                transition-colors
                            `}
                        >
                            {cols.map(c => (
                                <td
                                    key={c.key}
                                    className="px-4 py-3 whitespace-nowrap border-r border-gray-100 text-gray-800"
                                >
                                    {c.render
                                        ? c.render((row as any)[c.key], row)
                                        : String((row as any)[c.key] ?? "")}
                                </td>
                            ))}
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const [tab, setTab] = useState<"daily" | "monthly">("daily");

    // daily
    const [start, setStart] = useState<Date | null>(firstDay);
    const [end, setEnd] = useState<Date | null>(now);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loadingDaily, setLoadingDaily] = useState(false);
    const [activeChart, setActiveChart] = useState<"visit" | "noEndpoint" | "ucOutside">("visit");

    // monthly
    const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [monthsBack, setMonthsBack] = useState(6);

    const fetchDaily = useCallback(async () => {
        if (!start || !end) return;
        setLoadingDaily(true);
        try {
            const res = await fetch(`/api/dashboard?start=${formatDate(start)}&end=${formatDate(end)}`, { credentials: "include" });
            setData(await res.json());
        } catch { /* ignore */ } finally { setLoadingDaily(false); }
    }, [start, end]);

    const fetchMonthly = useCallback(async (n = monthsBack) => {
        setLoadingMonthly(true);
        try {
            const res = await fetch(`/api/dashboard/monthly?months=${n}`, { credentials: "include" });
            const json = await res.json();
            setMonthlyRows(json.months ?? []);
        } catch { /* ignore */ } finally { setLoadingMonthly(false); }
    }, [monthsBack]);

    useEffect(() => { fetchDaily(); }, []);
    useEffect(() => { if (tab === "monthly" && !monthlyRows.length) fetchMonthly(); }, [tab]);

    // chart
    const labels = data?.daily.map(d => {
        const s = d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10);
        const [, m, day] = s.split("-");
        return `${parseInt(day)}/${parseInt(m)}`;
    }) ?? [];

    const chartSets = {
        visit: [
            { label: "Visit", data: data?.daily.map(d => d.totalVisit) ?? [], borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.12)", fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#2563eb" },
            { label: "คน (HN)", data: data?.daily.map(d => d.totalPatient) ?? [], borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.08)", fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#16a34a" },
        ],
        noEndpoint: [{ label: "No Endpoint", data: data?.daily.map(d => d.noEndpoint) ?? [], backgroundColor: "rgba(239,68,68,0.75)", borderRadius: 6, borderSkipped: false as const }],
        ucOutside: [{ label: "UC ต่างจังหวัด", data: data?.daily.map(d => d.ucOutside) ?? [], backgroundColor: "rgba(234,88,12,0.75)", borderRadius: 6, borderSkipped: false as const }],
    };
    const isBar = activeChart !== "visit";

    return (
        <div className="space-y-5">

            {/* Tab switcher */}
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm w-fit"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.06)" }}>
                {([{ key: "daily", label: "รายวัน", icon: <Calendar size={15} /> }, { key: "monthly", label: "รายเดือน", icon: <BarChart2 size={15} /> }] as const).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold transition-all
                            ${tab === t.key ? "bg-green-800 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">

                {/* ══ DAILY ══ */}
                {tab === "daily" && (
                    <motion.div key="daily" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

                        {/* Filter */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4" style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.06)" }}>
                            <div className="flex flex-wrap items-end gap-5">
                                <div>
                                    <h1 className="text-xl font-extrabold text-gray-800">Dashboard ภาพรวม</h1>
                                    {data && <p className="text-xs text-gray-400 mt-0.5">ข้อมูล {thaiShortDate(data.start)} – {thaiShortDate(data.end)}</p>}
                                </div>
                                <div className="flex flex-wrap items-end gap-4 ml-auto">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">วันที่เริ่ม</label>
                                        <DatePicker selected={start} onChange={(d: Date | null) => setStart(d)} dateFormat="dd/MM/yyyy" locale={th} showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20} customInput={<ThaiDateInput />} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">วันที่สิ้นสุด</label>
                                        <DatePicker selected={end} onChange={(d: Date | null) => setEnd(d)} dateFormat="dd/MM/yyyy" locale={th} showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20} customInput={<ThaiDateInput />} />
                                    </div>
                                    <motion.button onClick={fetchDaily} disabled={loadingDaily}
                                        className="flex items-center gap-2 bg-green-800 text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md disabled:opacity-50"
                                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                                        <motion.span animate={loadingDaily ? { rotate: 360 } : {}} transition={loadingDaily ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                                            <RefreshCw size={15} />
                                        </motion.span>
                                        {loadingDaily ? "กำลังโหลด..." : "โหลดข้อมูล"}
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {/* KPI rows */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="Visit ทั้งหมด" value={data?.summary.totalVisit ?? 0} icon={<TrendingUp size={22} className="text-blue-600" />} color="bg-blue-50" textColor="text-blue-700" borderColor="border-blue-500" loading={loadingDaily} delay={0} />
                            <KpiCard title="ผู้รับบริการ (HN)" value={data?.summary.totalPatient ?? 0} icon={<Users size={22} className="text-green-700" />} color="bg-green-50" textColor="text-green-800" borderColor="border-green-600" loading={loadingDaily} delay={0.05} />
                            <KpiCard title="No Endpoint" value={data?.summary.noEndpoint ?? 0} icon={<UserX size={22} className="text-red-500" />} color="bg-red-50" textColor="text-red-600" borderColor="border-red-500" loading={loadingDaily} delay={0.1} />
                            <KpiCard title="ค้างชำระ (บาท)" value={data ? Math.round(data.summary.unpaidTotal).toLocaleString() : "0"} icon={<Banknote size={22} className="text-amber-600" />} color="bg-amber-50" textColor="text-amber-700" borderColor="border-amber-500" loading={loadingDaily} delay={0.15} />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="UC ต่างจังหวัด OPD" value={data?.summary.ucOutside ?? 0} icon={<MapPin size={22} className="text-orange-600" />} color="bg-orange-50" textColor="text-orange-700" borderColor="border-orange-500" loading={loadingDaily} delay={0.2} />
                            <KpiCard title="UC ต่างจังหวัด ทันตกรรม" value={data?.summary.ucOutsideDental ?? 0} icon={<MapPin size={22} className="text-pink-500" />} color="bg-pink-50" textColor="text-pink-600" borderColor="border-pink-400" loading={loadingDaily} delay={0.25} />
                            <KpiCard title="PPA Aging" value={data?.ppa.aging ?? 0} icon={<Users size={22} className="text-violet-600" />} color="bg-violet-50" textColor="text-violet-700" borderColor="border-violet-500" loading={loadingDaily} delay={0.3} suffix="ราย" />
                            <KpiCard title="PPA NCD" value={data?.ppa.ncd ?? 0} icon={<HeartPulse size={22} className="text-rose-500" />} color="bg-rose-50" textColor="text-rose-600" borderColor="border-rose-400" loading={loadingDaily} delay={0.35} suffix="ราย" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <KpiCard title="PPA MCH01 (ANC)" value={data?.ppa.mch01 ?? 0} icon={<Baby size={22} className="text-cyan-600" />} color="bg-cyan-50" textColor="text-cyan-700" borderColor="border-cyan-500" loading={loadingDaily} delay={0.4} suffix="ราย" />
                            <KpiCard title="PPA MCH02 (คลอด)" value={data?.ppa.mch02 ?? 0} icon={<Stethoscope size={22} className="text-teal-600" />} color="bg-teal-50" textColor="text-teal-700" borderColor="border-teal-500" loading={loadingDaily} delay={0.45} suffix="ราย" />
                        </div>

                        {/* Chart */}
                        <SectionCard delay={0.5} title={
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span>แนวโน้มรายวัน</span>
                                <div className="flex gap-2">
                                    {(["visit", "noEndpoint", "ucOutside"] as const).map(k => (
                                        <button key={k} onClick={() => setActiveChart(k)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeChart === k ? "bg-green-800 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                            {k === "visit" ? "Visit" : k === "noEndpoint" ? "No Endpoint" : "UC ต่างจังหวัด"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        }>
                            {loadingDaily ? <Shimmer className="h-64 w-full" />
                                : data && data.daily.length > 0 ? (
                                    <AnimatePresence mode="wait">
                                        <motion.div key={activeChart} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                                            {isBar
                                                ? <Bar data={{ labels, datasets: chartSets[activeChart] }} options={{ responsive: true, plugins: { legend: baseLegend, tooltip: { mode: "index" as const, intersect: false } }, scales: baseScales } as any} />
                                                : <Line data={{ labels, datasets: chartSets[activeChart] }} options={{ responsive: true, interaction: { mode: "index" as const, intersect: false }, plugins: { legend: baseLegend }, scales: baseScales } as any} />
                                            }
                                        </motion.div>
                                    </AnimatePresence>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                                        <span className="text-3xl">📊</span>
                                        <p className="text-sm">เลือกช่วงวันที่แล้วกดโหลดข้อมูล</p>
                                    </div>
                                )}
                        </SectionCard>

                        {/* Latest tables */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <SectionCard delay={0.55} title={
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><UserX size={16} className="text-red-500" />No Endpoint ล่าสุด</span>
                                    <a href="/pages/no-endpoint" className="flex items-center gap-1 text-xs text-green-700 font-semibold hover:underline">ดูทั้งหมด <ChevronRight size={12} /></a>
                                </div>
                            }>
                                {loadingDaily ? <Shimmer className="h-32 w-full" />
                                    : <MiniTable rows={data?.latestNoEndpoint ?? []} cols={[
                                        { key: "date", label: "วันที่", render: (v) => thaiShortDate(v) },
                                        { key: "name", label: "ชื่อ" },
                                        { key: "dept", label: "แผนก" },
                                        { key: "income", label: "มูลค่า", render: (v) => <span className="font-semibold text-red-500">{Number(v).toLocaleString()}</span> },
                                    ]} />}
                            </SectionCard>
                            <SectionCard delay={0.6} title={
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><MapPin size={16} className="text-orange-500" />UC ต่างจังหวัด ล่าสุด</span>
                                    <a href="/pages/uc-outside" className="flex items-center gap-1 text-xs text-green-700 font-semibold hover:underline">ดูทั้งหมด <ChevronRight size={12} /></a>
                                </div>
                            }>
                                {loadingDaily ? <Shimmer className="h-32 w-full" />
                                    : <MiniTable rows={data?.latestUcOutside ?? []} cols={[
                                        { key: "date", label: "วันที่", render: (v) => thaiShortDate(v) },
                                        { key: "name", label: "ชื่อ" },
                                        { key: "hospName", label: "ต้นสังกัด" },
                                        { key: "income", label: "มูลค่า", render: (v) => <span className="font-semibold text-orange-600">{Number(v).toLocaleString()}</span> },
                                    ]} />}
                            </SectionCard>
                        </div>

                    </motion.div>
                )}

                {/* ══ MONTHLY ══ */}
                {tab === "monthly" && (
                    <motion.div key="monthly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

                        {/* Filter */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4" style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.06)" }}>
                            <div className="flex flex-wrap items-end gap-5">
                                <div>
                                    <h1 className="text-xl font-extrabold text-gray-800">Dashboard รายเดือน</h1>
                                    <p className="text-xs text-gray-400 mt-0.5">เปรียบเทียบ month-over-month</p>
                                </div>
                                <div className="flex items-end gap-4 ml-auto">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">ย้อนหลัง</label>
                                        <select value={monthsBack} onChange={e => setMonthsBack(Number(e.target.value))}
                                            className="border-2 border-gray-200 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:border-green-700">
                                            {[3, 6, 9, 12].map(n => <option key={n} value={n}>{n} เดือน</option>)}
                                        </select>
                                    </div>
                                    <motion.button onClick={() => fetchMonthly(monthsBack)} disabled={loadingMonthly}
                                        className="flex items-center gap-2 bg-green-800 text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md disabled:opacity-50"
                                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                                        <motion.span animate={loadingMonthly ? { rotate: 360 } : {}} transition={loadingMonthly ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                                            <RefreshCw size={15} />
                                        </motion.span>
                                        {loadingMonthly ? "กำลังโหลด..." : "โหลดข้อมูล"}
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {/* Charts */}
                        {loadingMonthly ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Shimmer className="h-56" /><Shimmer className="h-56" /></div>
                        ) : monthlyRows.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Visit & ผู้รับบริการ รายเดือน</p>
                                    <Bar data={{
                                        labels: monthlyRows.map(r => r.label), datasets: [
                                            { label: "Visit", data: monthlyRows.map(r => r.totalVisit), backgroundColor: "rgba(37,99,235,0.75)", borderRadius: 5 },
                                            { label: "คน (HN)", data: monthlyRows.map(r => r.totalPatient), backgroundColor: "rgba(22,163,74,0.7)", borderRadius: 5 },
                                        ]
                                    }} options={{ responsive: true, plugins: { legend: baseLegend }, scales: baseScales } as any} />
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">No Endpoint & UC ต่างจังหวัด รายเดือน</p>
                                    <Bar data={{
                                        labels: monthlyRows.map(r => r.label), datasets: [
                                            { label: "No Endpoint", data: monthlyRows.map(r => r.noEndpoint), backgroundColor: "rgba(239,68,68,0.75)", borderRadius: 5 },
                                            { label: "UC ต่างจังหวัด", data: monthlyRows.map(r => r.ucOutside), backgroundColor: "rgba(234,88,12,0.7)", borderRadius: 5 },
                                        ]
                                    }} options={{ responsive: true, plugins: { legend: baseLegend }, scales: baseScales } as any} />
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        <SectionCard delay={0.2} title="ตารางเปรียบเทียบรายเดือน">
                            <div className="text-xs text-gray-400 mb-3 flex items-center gap-4">
                                <span className="flex items-center gap-1"><TrendingUp size={11} className="text-green-600" />เพิ่มขึ้น</span>
                                <span className="flex items-center gap-1"><TrendingDown size={11} className="text-red-500" />ลดลง</span>
                                <span className="flex items-center gap-1"><Minus size={11} className="text-gray-400" />ไม่มีข้อมูลเปรียบเทียบ</span>
                            </div>
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                                <MonthlyTable rows={monthlyRows} loading={loadingMonthly} />
                            </div>
                        </SectionCard>

                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}