"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell,
    Area, AreaChart,
} from "recharts";
import {
    RefreshCw, Info, Wifi, WifiOff, Clock,
    Users, Activity, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2,
} from "lucide-react";
import type { DrugDashboardSummary, DrugSheetsDashboardData } from "@/app/api/drug-sheets/route";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
    green: "#639922", greenL: "#EAF3DE",
    blue: "#378ADD", blueL: "#E6F1FB",
    amber: "#EF9F27", amberL: "#FAEEDA",
    red: "#E24B4A", redL: "#FCEBEB",
    teal: "#1D9E75", tealL: "#E1F5EE",
    coral: "#D85A30",
    purple: "#7F77DD",
    gray: "#888780", grayL: "#F1EFE8",
};

const COLOR_MAP: Record<string, string> = {
    เขียว: C.green, ส้ม: C.amber, แดง: C.red,
    เหลือง: "#f1c40f", ไม่ระบุ: C.gray,
};
const STATUS_COLORS = [C.blue, C.green, C.red, C.amber, C.purple];
const PROGRAM_COLORS = [C.green, C.blue, C.amber, C.teal, C.coral, C.purple];
const REFERRAL_COLORS = [C.blue, C.green, C.amber, C.coral, C.teal, C.red, C.purple, C.gray];

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff} วินาทีที่แล้ว`;
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
    icon: Icon, label, value, sub, accent, accentBg,
}: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; accent: string; accentBg: string;
}) {
    return (
        <motion.div
            className="rounded-2xl p-5 flex flex-col gap-2"
            style={{ backgroundColor: accentBg }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: accent + "22" }}>
                <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>{label}</p>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
            {sub && <p className="text-[11px]" style={{ color: accent + "99" }}>{sub}</p>}
        </motion.div>
    );
}

function SectionCard({ title, icon: Icon, children }: {
    title: string; icon?: React.ElementType; children: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                {Icon && <Icon size={15} className="text-gray-400" />}
                <p className="text-sm font-bold text-gray-600">{title}</p>
            </div>
            {children}
        </div>
    );
}

function HBarList({ data, colors, total }: {
    data: [string, number][]; colors: string[]; total?: number;
}) {
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div className="space-y-2">
            {data.map(([label, val], i) => {
                const pct = total ? Math.round((val / total) * 100) : 0;
                return (
                    <div key={label} className="flex items-center gap-2 text-xs">
                        <span className="w-28 flex-shrink-0 text-right text-gray-500 truncate leading-tight" title={label}>
                            {label}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <motion.div
                                className="h-full rounded"
                                style={{ backgroundColor: colors[i % colors.length] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${(val / max) * 100}%` }}
                                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.03 }}
                            />
                        </div>
                        <span className="w-14 flex-shrink-0 text-right font-semibold text-gray-700 tabular-nums">
                            {val}{total ? ` (${pct}%)` : ""}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function CustomLegend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {items.map((it) => (
                <div key={it.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                    <span className="text-[10px] text-gray-500">{it.label}</span>
                </div>
            ))}
        </div>
    );
}

function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
    const pct = secondsLeft / total;
    const r = 10, circ = 2 * Math.PI * r;
    return (
        <svg width={28} height={28} viewBox="0 0 28 28" className="-rotate-90">
            <circle cx={14} cy={14} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
            <circle cx={14} cy={14} r={r} fill="none" stroke="#3aa36a" strokeWidth={3}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
    );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function DashboardCharts({ s }: { s: DrugDashboardSummary }) {
    const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

    const colorData = Object.entries(s.byColor)
        .filter(([k]) => k !== "ไม่ระบุ")
        .map(([name, value]) => ({ name, value, color: COLOR_MAP[name] ?? C.gray }));

    const statusData = Object.entries(s.byDetailStatus)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value], i) => ({ name, value, color: STATUS_COLORS[i % STATUS_COLORS.length] }));

    const programData = Object.entries(s.byProgram)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value], i) => ({ name, value, color: PROGRAM_COLORS[i % PROGRAM_COLORS.length] }));

    const referralData = Object.entries(s.byReferral)
        .sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];

    const tambonData = Object.entries(s.byTambon)
        .sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];

    const ageData = Object.entries(s.byAgeGroup).map(([name, value]) => ({ name, value }));

    const v2Data = Object.entries(s.byV2Group).map(([name, value], i) => ({
        name, value, color: [C.green, C.amber, C.coral, C.red][i],
    }));

    const genderData = [
        { name: `ชาย ${s.male}`, value: s.male, color: C.blue },
        { name: `หญิง ${s.female}`, value: s.female, color: C.teal },
    ];

    return (
        <div className="space-y-4">
            {/* Monthly trend */}
            <SectionCard title="แนวโน้มผู้ป่วยรายเดือน (วันที่รับเข้าบำบัด)" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={s.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="drugGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tip} formatter={(v: number) => [v + " ราย", "จำนวน"]} />
                        <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
                            fill="url(#drugGrad)" dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Row 2: Gender / Status / Color */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gender donut */}
                <SectionCard title="สัดส่วนเพศ" icon={Users}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={genderData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3}>
                                {genderData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                        </PieChart>
                    </div>
                    <CustomLegend items={genderData.map((d) => ({ label: d.name, color: d.color }))} />
                </SectionCard>

                {/* Status donut */}
                <SectionCard title="สถานะการรักษา" icon={Activity}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={statusData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={2}>
                                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                        </PieChart>
                    </div>
                    <CustomLegend items={statusData.map((d) => ({ label: `${d.name} ${d.value}`, color: d.color }))} />
                </SectionCard>

                {/* Color severity donut */}
                <SectionCard title="ระดับความรุนแรง (สี)" icon={ShieldCheck}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={colorData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3}>
                                {colorData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                        </PieChart>
                    </div>
                    <CustomLegend items={colorData.map((d) => ({ label: `${d.name} ${d.value}`, color: d.color }))} />
                </SectionCard>
            </div>

            {/* Row 3: Program / V2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="ประเภทโปรแกรมบำบัด" icon={Activity}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={programData} layout="vertical"
                            margin={{ top: 0, right: 20, left: 60, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false} tickLine={false} width={60} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {programData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="ระดับการติดยา (คะแนน V2)" icon={AlertTriangle}>
                    <p className="text-xs text-gray-400 mb-3">
                        เฉลี่ย <strong className="text-gray-700">{s.avgV2}</strong> pts
                        · ต่ำสุด {s.minV2} · สูงสุด {s.maxV2}
                    </p>
                    <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={v2Data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {v2Data.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* Row 4: Age / Tambon / Referral */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="กลุ่มอายุ" icon={Users}>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                            <Bar dataKey="value" fill={C.blue} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="ตำบลที่พักอาศัย" icon={Activity}>
                    <HBarList data={tambonData} colors={PROGRAM_COLORS} total={s.total} />
                </SectionCard>

                <SectionCard title="ช่องทางการนำส่ง" icon={TrendingUp}>
                    <HBarList data={referralData} colors={REFERRAL_COLORS} total={s.total} />
                </SectionCard>
            </div>
        </div>
    );
}

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: DrugSheetsDashboardData["rows"] }) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const PAGE = 20;

    const filtered = rows.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            r.hn.includes(q) ||
            r.tambon.toLowerCase().includes(q)
        );
    });

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
    const paged = filtered.slice((page - 1) * PAGE, page * PAGE);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <p className="text-sm font-bold text-gray-600">รายชื่อผู้ป่วย</p>
                    <span className="text-xs text-gray-400">{rows.length} ราย</span>
                </div>
                <input
                    type="text"
                    placeholder="ค้นหาชื่อ / HN / ตำบล..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-green-400"
                />
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700 sticky top-0">
                            {["#", "HN", "ชื่อ-สกุล", "อายุ", "ตำบล", "โปรแกรม",
                                "สถานะ", "รายละเอียด", "สี", "V2", "วันเริ่มบำบัด"].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr key={`${r.hn}-${i}`}
                                className={`border-b border-gray-100 hover:bg-green-50/40 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    }`}>
                                <td className="px-3 py-2 text-gray-400">{(page - 1) * PAGE + i + 1}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                                    {r.prefix}{r.firstName} {r.lastName}
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.age || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.tambon || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.program || "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: r.treatStatus === "บำบัด" ? "#EAF3DE"
                                                : r.treatStatus === "จำหน่าย" ? "#E6F1FB" : "#FAEEDA",
                                            color: r.treatStatus === "บำบัด" ? "#639922"
                                                : r.treatStatus === "จำหน่าย" ? "#185FA5" : "#BA7517",
                                        }}>
                                        {r.treatStatus || "-"}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[10px]">{r.detailStatus || "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: (COLOR_MAP[r.colorSeverity] ?? C.gray) + "22",
                                            color: COLOR_MAP[r.colorSeverity] ?? C.gray,
                                        }}>
                                        {r.colorSeverity}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-700 text-center font-semibold tabular-nums">
                                    {r.v2Score || "-"}
                                </td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.startDate || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">หน้า {page} / {pages} · {filtered.length} รายการ</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">
                            ← ก่อนหน้า
                        </button>
                        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">
                            ถัดไป →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DrugDashboardPage() {
    const [data, setData] = useState<DrugSheetsDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL_MS / 1000);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/drug-sheets", { credentials: "include" });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            setData(await res.json());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            if (!silent) setLoading(false);
        }
        setSecondsLeft(REFRESH_INTERVAL_MS / 1000);
    }, []);

    useEffect(() => {
        fetchData();
        timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
        countdownRef.current = setInterval(
            () => setSecondsLeft((s) => (s <= 1 ? REFRESH_INTERVAL_MS / 1000 : s - 1)),
            1000
        );
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [fetchData]);

    const s = data?.summary;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold text-gray-800">Dashboard ผู้ป่วยยาเสพติด</h1>
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                            style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            LIVE
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
                        {data && (
                            <>
                                <span>·</span>
                                <Clock size={11} />
                                <span>อัปเดต {timeAgo(data.updatedAt)}</span>
                                <span>·</span>
                                <span>Sheet: {data.sheetName}</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <button onClick={() => fetchData()} disabled={loading}
                        className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                        <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                            transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                            <RefreshCw size={14} />
                        </motion.span>
                        รีเฟรช
                    </button>
                    {error
                        ? <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><WifiOff size={13} />ไม่เชื่อมต่อ</span>
                        : data
                            ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Wifi size={13} />เชื่อมต่อแล้ว</span>
                            : null}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และ DRUG_SPREADSHEET_ID ใน .env
                        </p>
                    </div>
                </div>
            )}

            {/* ── Loading shimmer ── */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── KPI Cards ── */}
            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(s.total)} ราย`}
                        sub={`ใหม่ ${s.newPatients} · เก่า ${s.oldPatients}`}
                        accent={C.blue} accentBg={C.blueL} />
                    <KpiCard icon={Activity} label="กำลังบำบัด" value={`${fmt(s.inTreatment)} ราย`}
                        sub={`Retention ${s.retentionRate}%`}
                        accent={C.green} accentBg={C.greenL} />
                    <KpiCard icon={CheckCircle2} label="treat ครบ / ติดตาม" value={`${fmt(s.treatComplete + s.followUp)} ราย`}
                        sub={`จำหน่าย ${s.discharged} · Dropout ${s.dropout}`}
                        accent={C.amber} accentBg={C.amberL} />
                    <KpiCard icon={ShieldCheck} label="V2 เฉลี่ย" value={`${s.avgV2} pts`}
                        sub={`min ${s.minV2} · max ${s.maxV2}`}
                        accent={C.teal} accentBg={C.tealL} />
                    <KpiCard icon={TrendingUp} label="อายุเฉลี่ย" value={`${s.avgAge} ปี`}
                        sub={`ชาย ${s.male} · หญิง ${s.female} ราย`}
                        accent={C.purple} accentBg="#EEEDFE" />
                </div>
            )}

            {/* ── Charts ── */}
            {loading && !data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}
            {s && s.total > 0 && <DashboardCharts s={s} />}

            {/* ── Patient Table ── */}
            {data && data.rows.length > 0 && <PatientTable rows={data.rows} />}

            {/* ── Empty state ── */}
            {!loading && !error && data && s?.total === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <Info size={32} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
                    <p className="text-xs text-amber-700">
                        เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">
                        Sheet: {data.sheetName}
                    </p>
                </div>
            )}
        </div>
    );
}