"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Line,
} from "recharts";
import {
    RefreshCw, CheckCircle2,
    Users, Skull, TrendingUp, Activity, ShieldCheck, Microscope,
    AlertTriangle, HeartPulse, MapPin, Stethoscope,
} from "lucide-react";
import type { TBDashboardData, TBRow, TBByYear } from "@/app/api/tb-dashboard/route";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
    green: "#639922", greenL: "#EAF3DE",
    teal: "#1D9E75", tealL: "#E1F5EE",
    blue: "#378ADD", blueL: "#E6F1FB",
    amber: "#EF9F27", amberL: "#FAEEDA",
    red: "#E24B4A", redL: "#FCEBEB",
    purple: "#7F77DD", purpleL: "#EEEDFE",
    coral: "#D85A30", coralL: "#FAECE7",
    cyan: "#0891B2", cyanL: "#E0F2FE",
    gray: "#888780", grayL: "#F1EFE8",
};

const OUTCOME_COLOR: Record<string, string> = {
    "Cured": C.teal, "Completed": C.cyan, "On treatment": C.amber,
    "Died": C.red, "LTFU": C.purple, "Transferred out": C.blue,
    "Failed": C.coral, "เสียชีวิต (อุบัติเหตุ)": C.gray, "ไม่ระบุ": C.gray, "อื่นๆ": C.gray,
};

const PALETTE = [C.teal, C.blue, C.amber, C.coral, C.purple, C.green, C.cyan, C.red, C.gray];

// ─── WHO Targets ──────────────────────────────────────────────────────────────
const WHO_INDICATORS = [
    { key: "success", label: "Treatment Success Rate", desc: "Cured+Completed (เฉพาะ Q1 ต.ค.-ธ.ค.)", target: 88, dir: "up" as const },
    { key: "cure", label: "Cure Rate", desc: "Cured / Total", target: 85, dir: "up" as const },
    { key: "death", label: "Death Rate", desc: "เสียชีวิต (เฉพาะ Q1)", target: 7, dir: "down" as const },
    { key: "ltfu", label: "LTFU Rate", desc: "ขาดการรักษา", target: 5, dir: "down" as const },
    { key: "failure", label: "Failure Rate", desc: "รักษาล้มเหลว/MDR", target: 3, dir: "down" as const },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const pct = (n: number, t: number) => t > 0 ? ((n / t) * 100).toFixed(1) + "%" : "0%";
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, accentBg, highlight }: {
    icon: React.ElementType; label: string; value: string; sub?: string;
    accent: string; accentBg: string; highlight?: boolean;
}) {
    return (
        <motion.div className={`bg-white border rounded-2xl p-5 flex flex-col gap-2 shadow-sm ${highlight ? "border-red-200 bg-red-50/20" : "border-gray-200"}`}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentBg }}>
                <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </motion.div>
    );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Icon size={15} className="text-gray-400" />
                <p className="text-sm font-semibold text-gray-600">{title}</p>
            </div>
            {children}
        </div>
    );
}

function HBarList({ data, colors }: { data: [string, number][]; colors: string[] }) {
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div className="space-y-2">
            {data.map(([label, val], i) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 flex-shrink-0 text-right text-gray-500 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                        <motion.div className="h-full rounded" style={{ backgroundColor: colors[i % colors.length] }}
                            initial={{ width: 0 }} animate={{ width: `${(val / max) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.03 }} />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right font-semibold text-gray-700">{val}</span>
                </div>
            ))}
        </div>
    );
}

function Legend({ items }: { items: { label: string; color: string; value?: number | string }[] }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {items.map((it) => (
                <div key={it.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                    <span className="text-xs text-gray-500">{it.label}{it.value != null ? `: ${it.value}` : ""}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Year Tabs ────────────────────────────────────────────────────────────────
function YearTab({ years, selected, onSelect }: { years: string[]; selected: string; onSelect: (y: string) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {["all", ...years].map((y, i) => (
                <button key={y} onClick={() => onSelect(y)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${selected === y ? "text-white shadow-sm" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}
                    style={selected === y ? { backgroundColor: i === 0 ? C.teal : PALETTE[(i - 1) % PALETTE.length] } : {}}>
                    {y === "all" ? "ทุกปี" : `ปีงบ ${y}`}
                </button>
            ))}
        </div>
    );
}

// ─── WHO Indicator Cards ──────────────────────────────────────────────────────
function WhoCards({ yd }: { yd: TBByYear }) {
    const vals: Record<string, number> = {
        success: yd.successRateQ1,
        cure: yd.total > 0 ? Math.round((yd.cured / yd.total) * 1000) / 10 : 0,
        death: yd.mortalityRateQ1,
        ltfu: yd.total > 0 ? Math.round((yd.ltfu / yd.total) * 1000) / 10 : 0,
        failure: yd.total > 0 ? Math.round((yd.failed / yd.total) * 1000) / 10 : 0,
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {WHO_INDICATORS.map((ind) => {
                const val = vals[ind.key] ?? 0;
                const ok = ind.dir === "up" ? val >= ind.target : val <= ind.target;
                const warn = ind.dir === "up" ? val >= ind.target * 0.8 : val <= ind.target * 2;
                const status = ok ? "ok" : warn ? "warn" : "bad";
                const color = ok ? C.teal : warn ? C.amber : C.red;
                const bgColor = ok ? C.tealL : warn ? C.amberL : C.redL;
                const pctFill = ind.dir === "up" ? Math.min(100, val) : Math.min(100, val * (100 / (ind.target * 2 + 1)));

                return (
                    <div key={ind.key} className="bg-white border rounded-2xl p-4 shadow-sm" style={{ borderColor: color + "40" }}>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{ind.label}</p>
                        <p className="text-xs text-gray-400 mb-2">{ind.desc}</p>
                        <div className="flex items-end justify-between mb-2">
                            <p className="text-2xl font-bold" style={{ color }}>{val}%</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: bgColor, color }}>
                                {status === "ok" ? "บรรลุเป้า" : status === "warn" ? "ใกล้เป้า" : "ต่ำกว่าเป้า"}
                            </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pctFill}%`, background: color }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">เป้า {ind.dir === "up" ? "≥" : "≤"} {ind.target}%</p>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: TBRow[] }) {
    const [page, setPage] = useState(1);
    const PAGE = 20;
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const paged = rows.slice((page - 1) * PAGE, page * PAGE);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-600">รายชื่อผู้ป่วย TB</p>
                </div>
                <span className="text-xs text-gray-400">{rows.length} ราย</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr style={{ background: "linear-gradient(135deg, #134e4a, #0f766e)" }}>
                            {["ปีงบ", "HN", "ชื่อ-สกุล", "อายุ", "ตำบล", "ประเภท", "สูตรยา", "AFB", "HIV", "Gene Xpert", "เริ่มรักษา", "ผลการรักษา", "หมายเหตุ"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-teal-700 whitespace-nowrap text-[11px]">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => {
                            const isDead = r.outcome === "Died";
                            const isCured = r.outcome === "Cured";
                            return (
                                <tr key={`${r.year}-${r.hn}-${i}`}
                                    className={`border-b border-gray-100 transition-colors hover:bg-teal-50/30 ${isDead ? "bg-red-50/20" : isCured ? "bg-teal-50/10" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                    <td className="px-3 py-2 text-gray-500">{r.year}</td>
                                    <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                    <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.name}</td>
                                    <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.tambon || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">{r.regType || "-"}</span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={r.regimen}>{r.regimen?.split(/\s/)[0] || "-"}</td>
                                    <td className="px-3 py-2 text-center">
                                        {r.afb && r.afb !== "ไม่ระบุ" ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                style={{ background: r.afb.includes("+") ? C.amberL : C.tealL, color: r.afb.includes("+") ? C.amber : C.teal }}>
                                                {r.afb}
                                            </span>
                                        ) : "-"}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {r.hiv === "Positive" ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Pos</span>
                                            : r.hiv === "Negative" ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Neg</span>
                                                : <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {r.geneExpert === "MTB Detected" ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">MTB+</span>
                                            : r.geneExpert === "Not Detected" ? <span className="text-gray-400 text-[10px]">Neg</span>
                                                : <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.startDate ? r.startDate.slice(0, 10) : "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                            style={{ background: (OUTCOME_COLOR[r.outcome] ?? C.gray) + "20", color: OUTCOME_COLOR[r.outcome] ?? C.gray }}>
                                            {r.outcome || "-"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate" title={r.note}>{r.note || "-"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">หน้า {page} / {pages}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">← ก่อนหน้า</button>
                        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">ถัดไป →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Cohort Table ─────────────────────────────────────────────────────────────
function CohortTable({ yd }: { yd: TBByYear }) {
    const monthSortKey = (label: string): number => {
        const parts = label.split(" ");
        if (parts.length < 2) return 0;
        const IDX: Record<string, number> = {
            "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
            "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
        };
        const y = parseInt(parts[1]) || 0;
        return y * 100 + (IDX[parts[0]] || 0);
    };
    const months = Object.keys(yd.byCohort).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    if (!months.length) return <p className="text-sm text-gray-400 text-center py-6">ไม่มีข้อมูล cohort</p>;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr style={{ background: "linear-gradient(135deg, #134e4a, #0f766e)" }}>
                        {["เดือน Cohort", "เริ่มรักษา", "Cured", "Completed", "On Treatment", "Died", "LTFU", "Transferred", "Success Rate"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-white font-semibold text-center border-r border-teal-700 whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {months.map((m, i) => {
                        const g = yd.byCohort[m];
                        const total = Object.values(g).reduce((s, v) => s + v, 0);
                        const cured = (g["Cured"] || 0) + (g["Completed"] || 0);
                        const rate = total > 0 ? ((cured / total) * 100).toFixed(1) : "0.0";
                        const rateNum = parseFloat(rate);
                        return (
                            <tr key={m} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                <td className="px-3 py-2 font-semibold text-gray-700">{m}</td>
                                <td className="px-3 py-2 text-center font-semibold text-gray-800">{total}</td>
                                <td className="px-3 py-2 text-center">
                                    {(g["Cured"] || 0) > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-700">{g["Cured"] || 0}</span> : <span className="text-gray-300">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-600">{g["Completed"] || 0}</td>
                                <td className="px-3 py-2 text-center">
                                    {(g["On treatment"] || 0) > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{g["On treatment"]}</span> : <span className="text-gray-300">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {(g["Died"] || 0) > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">{g["Died"]}</span> : <span className="text-gray-300">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {(g["LTFU"] || 0) > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">{g["LTFU"]}</span> : <span className="text-gray-300">0</span>}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-600">{g["Transferred out"] || 0}</td>
                                <td className="px-3 py-2 text-center">
                                    <span className={`font-bold text-sm ${rateNum >= 85 ? "text-teal-600" : rateNum >= 70 ? "text-amber-600" : "text-red-600"}`}>{rate}%</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Main Dashboard Charts ────────────────────────────────────────────────────
function DashboardCharts({ rows, yd }: { rows: TBRow[]; yd: TBByYear }) {
    const outcomeData = useMemo(() => {
        const m: Record<string, number> = {};
        rows.forEach((r) => { m[r.outcome || "ไม่ระบุ"] = (m[r.outcome || "ไม่ระบุ"] || 0) + 1; });
        return Object.entries(m).sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value, color: OUTCOME_COLOR[name] ?? C.gray }));
    }, [rows]);

    const regTypeData = useMemo(() =>
        Object.entries(yd.byRegType).sort(([, a], [, b]) => b - a) as [string, number][], [yd]);

    const tambonData = useMemo(() =>
        Object.entries(yd.byTambon).filter(([k]) => k !== "ไม่ระบุ").sort(([, a], [, b]) => b - a) as [string, number][], [yd]);

    const afbData = useMemo(() =>
        Object.entries(yd.byAFB).filter(([k]) => k !== "ไม่ระบุ").sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value, color: name === "Negative" ? C.teal : name === "1+" ? C.cyan : name === "2+" ? C.amber : C.red })), [yd]);

    const hivData = useMemo(() =>
        Object.entries(yd.byHIV).filter(([k]) => k !== "ไม่ระบุ")
            .map(([name, value]) => ({ name, value, color: name === "Positive" ? C.red : C.teal })), [yd]);

    const udData = useMemo(() =>
        Object.entries(yd.byUD).sort(([, a], [, b]) => b - a) as [string, number][], [yd]);

    const gxData = useMemo(() =>
        Object.entries(yd.byGeneXpert).filter(([k]) => k !== "ไม่ระบุ")
            .map(([name, value]) => ({ name, value, color: name === "MTB Detected" ? C.red : C.teal })), [yd]);

    const regimenData = useMemo(() =>
        Object.entries(yd.byRegimen).sort(([, a], [, b]) => b - a).slice(0, 6) as [string, number][], [yd]);

    const ageData = useMemo(() => {
        const groups: Record<string, number> = { "0–19": 0, "20–29": 0, "30–39": 0, "40–49": 0, "50–59": 0, "60–69": 0, "70–79": 0, "80+": 0 };
        rows.forEach((r) => {
            if (r.age == null) return;
            const a = r.age;
            if (a < 20) groups["0–19"]++;
            else if (a < 30) groups["20–29"]++;
            else if (a < 40) groups["30–39"]++;
            else if (a < 50) groups["40–49"]++;
            else if (a < 60) groups["50–59"]++;
            else if (a < 70) groups["60–69"]++;
            else if (a < 80) groups["70–79"]++;
            else groups["80+"]++;
        });
        return Object.entries(groups).map(([name, value]) => ({ name, value }));
    }, [rows]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="ผลการรักษา (Treatment Outcomes)" icon={Activity}>
                    <div className="flex justify-center">
                        <PieChart width={180} height={180}>
                            <Pie data={outcomeData} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                                {outcomeData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={outcomeData.map((d) => ({ label: `${d.name} (${d.value})`, color: d.color }))} />
                </SectionCard>

                <SectionCard title="แนวโน้มการขึ้นทะเบียนรายเดือน" icon={TrendingUp}>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={yd.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="tbGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.teal} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`, "จำนวน"]} {...tip} />
                            <Area type="monotone" dataKey="count" stroke={C.teal} strokeWidth={2.5}
                                fill="url(#tbGrad)" dot={{ r: 4, fill: C.teal }} activeDot={{ r: 6 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="ประเภทการขึ้นทะเบียน" icon={Stethoscope}>
                    <HBarList data={regTypeData} colors={PALETTE} />
                </SectionCard>

                <SectionCard title="ตำบลที่อยู่อาศัย" icon={MapPin}>
                    {tambonData.length > 0
                        ? <HBarList data={tambonData} colors={PALETTE} />
                        : <p className="text-sm text-gray-400 text-center py-6">ไม่มีข้อมูลตำบลในช่วงที่เลือก</p>}
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="ผล AFB Smear" icon={Microscope}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={afbData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                                {afbData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={afbData.map((d) => ({ label: `${d.name} (${d.value})`, color: d.color }))} />
                </SectionCard>

                <SectionCard title="HIV Status" icon={ShieldCheck}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={hivData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                                {hivData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={hivData.map((d) => ({ label: `${d.name} (${d.value})`, color: d.color }))} />
                </SectionCard>

                <SectionCard title="Gene Xpert MTB" icon={Microscope}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={gxData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                                {gxData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={gxData.map((d) => ({ label: d.name, color: d.color, value: d.value }))} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="โรคประจำตัว (Comorbidity)" icon={HeartPulse}>
                    <HBarList data={udData} colors={PALETTE} />
                </SectionCard>

                <SectionCard title="สูตรยา (Regimen)" icon={Activity}>
                    <HBarList data={regimenData} colors={PALETTE} />
                </SectionCard>

                <SectionCard title={`กลุ่มอายุ (เฉลี่ย ${yd.avgAge} ปี)`} icon={Users}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                            <Bar dataKey="value" fill={C.teal} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Activity size={15} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-600">Cohort Analysis — ผลรักษาแยกตามเดือนเริ่มรักษา</p>
                </div>
                <div className="p-4">
                    <CohortTable yd={yd} />
                </div>
            </div>
        </div>
    );
}

// ─── Yearly Comparison ────────────────────────────────────────────────────────
function YearCompareChart({ data }: { data: { year: string; total: number; cured: number; died: number; successRate: number }[] }) {
    return (
        <SectionCard title="เปรียบเทียบผลรักษารายปีงบประมาณ" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 24, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `ปีงบ ${v}`} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.green }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                    <Tooltip {...tip} formatter={(v, name) => typeof name === "string" && name.includes("%") ? [`${v ?? 0}%`, name] : [`${v ?? 0} ราย`, name]} />
                    <Bar yAxisId="left" dataKey="total" name="ทั้งหมด" fill={C.blue} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="cured" name="Cured" fill={C.teal} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="died" name="Died" fill={C.red} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="successRate" name="Success Rate (%)"
                        stroke={C.green} strokeWidth={2.5} dot={{ r: 4, fill: C.green }} />
                </BarChart>
            </ResponsiveContainer>
        </SectionCard>
    );
}

// ─── Live badge ───────────────────────────────────────────────────────────────
function LiveBadge() {
    return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
            style={{ backgroundColor: C.tealL, borderColor: C.teal + "66", color: "#0f766e" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block" />
            LIVE
        </span>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const REFRESH_MS = 60_000;

export default function TBDashboardPage() {
    const [data, setData] = useState<TBDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState("all");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // silent = ดึงเบื้องหลัง (auto-refresh) ไม่ล้างหน้าจอ/ไม่โชว์ spinner เต็ม
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/tb-dashboard", { credentials: "include" });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            const d = await res.json();
            setData(d);
        } catch (e) {
            if (!silent) setError((e as Error).message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        timerRef.current = setInterval(() => fetchData(true), REFRESH_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [fetchData]);

    const years = useMemo(() => data?.summary.byYear.map((y) => y.year) ?? [], [data]);

    const activeRows = useMemo(() => {
        if (!data) return [];
        return selectedYear === "all" ? data.rows : data.rows.filter((r) => r.year === selectedYear);
    }, [data, selectedYear]);

    const activeYD = useMemo((): TBByYear | null => {
        if (!data) return null;
        if (selectedYear === "all") {
            const all = data.summary.byYear;
            if (!all.length) return null;
            const total = activeRows.length;
            const merge = (key: keyof TBByYear) => {
                const m: Record<string, number> = {};
                all.forEach((y) => { const v = y[key] as Record<string, number>; if (v && typeof v === "object") Object.entries(v).forEach(([k, n]) => { m[k] = (m[k] || 0) + n; }); });
                return m;
            };
            const cured = all.reduce((s, y) => s + y.cured, 0);
            const completed = all.reduce((s, y) => s + y.completed, 0);
            const died = all.reduce((s, y) => s + y.died, 0);
            const ltfu = all.reduce((s, y) => s + y.ltfu, 0);
            const failed = all.reduce((s, y) => s + y.failed, 0);
            const q1Total = all.reduce((s, y) => s + y.q1Total, 0);
            const q1Cured = all.reduce((s, y) => s + y.q1Cured, 0);
            const q1Completed = all.reduce((s, y) => s + y.q1Completed, 0);
            const q1Died = all.reduce((s, y) => s + y.q1Died, 0);
            const ages = activeRows.map((r) => r.age).filter((a): a is number => a != null && a > 0);
            const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;

            const monthMap: Record<string, number> = {};
            all.forEach((y) => y.byMonth.forEach(({ month, count }) => { monthMap[month] = (monthMap[month] || 0) + count; }));

            const cohortMap: Record<string, Record<string, number>> = {};
            all.forEach((y) => {
                Object.entries(y.byCohort).forEach(([m, oc]) => {
                    if (!cohortMap[m]) cohortMap[m] = {};
                    Object.entries(oc).forEach(([o, n]) => { cohortMap[m][o] = (cohortMap[m][o] || 0) + n; });
                });
            });

            return {
                year: "all", total,
                cured, completed,
                onTreatment: all.reduce((s, y) => s + y.onTreatment, 0),
                died, ltfu, transferred: all.reduce((s, y) => s + y.transferred, 0),
                failed, other: Math.max(0, total - cured - completed - all.reduce((s, y) => s + y.onTreatment, 0) - died - ltfu - all.reduce((s, y) => s + y.transferred, 0) - failed),
                successRate: total > 0 ? Math.round(((cured + completed) / total) * 1000) / 10 : 0,
                mortalityRate: total > 0 ? Math.round((died / total) * 1000) / 10 : 0,
                q1Total, q1Cured, q1Completed,
                successRateQ1: q1Total > 0 ? Math.round(((q1Cured + q1Completed) / q1Total) * 1000) / 10 : 0,
                q1Died,
                mortalityRateQ1: q1Total > 0 ? Math.round((q1Died / q1Total) * 1000) / 10 : 0,
                avgAge,
                byRegType: merge("byRegType"), byTambon: merge("byTambon"), byAFB: merge("byAFB"),
                byHIV: merge("byHIV"), byCXR: merge("byCXR"), byGeneXpert: merge("byGeneXpert"),
                byUD: merge("byUD"), byRegimen: merge("byRegimen"),
                byMonth: Object.entries(monthMap).map(([month, count]) => ({ month, count })),
                byCohort: cohortMap,
            };
        }
        return data.summary.byYear.find((y) => y.year === selectedYear) ?? null;
    }, [data, selectedYear, activeRows]);

    const s = data?.summary;

    // สรุปสำหรับ AI — ใช้สถิติรวมตามปีที่เลือก (ไม่ส่งรายชื่อ/HN ผู้ป่วย)
    const aiSummary = useMemo(() => {
        if (!activeYD) return null;
        const topN = (obj: Record<string, number>, n = 8) =>
            Object.fromEntries(
                Object.entries(obj).filter(([k]) => k !== "ไม่ระบุ").sort(([, a], [, b]) => b - a).slice(0, n),
            );
        return {
            ปีงบที่เลือก: selectedYear === "all" ? "ทุกปีงบ" : `ปีงบ ${selectedYear}`,
            ผู้ป่วยทั้งหมด: activeYD.total,
            อายุเฉลี่ย: activeYD.avgAge,
            ผลการรักษา: {
                Cured: activeYD.cured,
                Completed: activeYD.completed,
                กำลังรักษา: activeYD.onTreatment,
                เสียชีวิต: activeYD.died,
                ขาดการรักษา_LTFU: activeYD.ltfu,
                ส่งต่อ: activeYD.transferred,
                ล้มเหลว: activeYD.failed,
            },
            ตัวชี้วัด_WHO: {
                SuccessRate_ร้อยละ: activeYD.successRateQ1,
                SuccessRate_เฉพาะQ1: `${activeYD.q1Cured + activeYD.q1Completed}/${activeYD.q1Total} ราย (รายใหม่ปอด ขึ้นทะเบียน ต.ค.-ธ.ค. ไม่รวม Relapse/นอกปอด/ดื้อยา)`,
                เป้าหมาย_SuccessRate: "≥ 88%",
                MortalityRate_ร้อยละ: activeYD.mortalityRateQ1,
                Death_เฉพาะQ1: `${activeYD.q1Died}/${activeYD.q1Total} ราย (ไม่รวมตายจากอุบัติเหตุ)`,
                เป้าหมาย_Death: "≤ 7%",
                LTFU_ร้อยละ: activeYD.total > 0 ? Math.round((activeYD.ltfu / activeYD.total) * 1000) / 10 : 0,
                เป้าหมาย_LTFU: "≤ 5%",
            },
            ประเภทการขึ้นทะเบียน: activeYD.byRegType,
            ผลAFB: activeYD.byAFB,
            HIVstatus: activeYD.byHIV,
            GeneXpert: activeYD.byGeneXpert,
            โรคประจำตัว: topN(activeYD.byUD),
            สูตรยาที่ใช้บ่อย: topN(activeYD.byRegimen, 6),
            ตำบลที่พบมาก: topN(activeYD.byTambon),
        };
    }, [activeYD, selectedYear]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                        🫁 แดชบอร์ดผู้ป่วยวัณโรค (TB Dashboard)
                        <LiveBadge />
                        {s && <span className="text-sm font-normal text-gray-400">· {fmt(s.total)} ราย · {years.length} ปีงบ</span>}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        ตามมาตรฐาน WHO / กรมควบคุมโรค · รพ.พลับพลาชัย จ.บุรีรัมย์
                        {data && <span className="ml-2">· อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
                    </p>
                </div>
                <button onClick={() => fetchData()} disabled={loading}
                    className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                        transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                        <RefreshCw size={14} />
                    </motion.span>
                    รีเฟรช
                </button>
            </div>

            {/* Error */}
            {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">เกิดข้อผิดพลาด: {error}</div>}

            {/* Year Tabs */}
            {!loading && s && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">เลือกปีงบประมาณ</p>
                    <YearTab years={years} selected={selectedYear} onSelect={setSelectedYear} />
                </div>
            )}

            {/* KPI */}
            {(loading || activeYD) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    )) : activeYD && (
                        <>
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(activeYD.total)} ราย`}
                                sub={selectedYear === "all" ? "ทุกปีงบ" : `ปีงบ ${selectedYear}`} accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={CheckCircle2} label="รักษาหาย (Cured)" value={`${fmt(activeYD.cured)} ราย`}
                                sub={pct(activeYD.cured, activeYD.total)} accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={CheckCircle2} label="Success Rate" value={`${activeYD.successRateQ1}%`}
                                sub={`Q1 ต.ค.-ธ.ค. · รายใหม่ปอด ${fmt(activeYD.q1Cured + activeYD.q1Completed)}/${fmt(activeYD.q1Total)} ราย (เป้า ≥ 88%)`}
                                accent={activeYD.successRateQ1 >= 88 ? C.teal : C.amber}
                                accentBg={activeYD.successRateQ1 >= 88 ? C.tealL : C.amberL} />
                            <KpiCard icon={Skull} label="เสียชีวิต" value={`${fmt(activeYD.q1Died)} ราย`}
                                sub={`Q1 · ${activeYD.mortalityRateQ1}% (เป้า ≤ 7%)`} accent={C.red} accentBg={C.redL} highlight={activeYD.q1Died > 0} />
                            <KpiCard icon={AlertTriangle} label="ขาดการรักษา (LTFU)" value={`${fmt(activeYD.ltfu)} ราย`}
                                sub={pct(activeYD.ltfu, activeYD.total)} accent={C.purple} accentBg={C.purpleL} />
                            <KpiCard icon={HeartPulse} label="อายุเฉลี่ย" value={`${activeYD.avgAge} ปี`}
                                sub="เฉพาะที่มีข้อมูล" accent={C.blue} accentBg={C.blueL} />
                        </>
                    )}
                </div>
            )}

            {/* WHO Indicators */}
            {!loading && activeYD && (
                <div className="space-y-3">
                    <div className="px-1">
                        <p className="text-sm font-semibold text-gray-600">🎯 ตัวชี้วัดมาตรฐาน WHO / กรมควบคุมโรค</p>
                    </div>
                    <WhoCards yd={activeYD} />
                </div>
            )}

            {/* Year compare (all years only) */}
            {!loading && s && selectedYear === "all" && s.byYear.length > 1 && (
                <YearCompareChart data={s.yearlyTrend} />
            )}

            {/* Main charts */}
            {!loading && activeYD && <DashboardCharts rows={activeRows} yd={activeYD} />}

            {/* Patient table */}
            {!loading && activeRows.length > 0 && <PatientTable rows={activeRows} />}

            {/* ── AI สรุป + แชท (ปุ่มลอยมุมขวาล่าง + modal กลางจอ) ── */}
            <AiSummaryCard
                summary={aiSummary}
                context="แดชบอร์ดผู้ป่วยวัณโรค (TB) รพ.พลับพลาชัย จ.บุรีรัมย์ — วิเคราะห์ผลการรักษาตามมาตรฐาน WHO/กรมควบคุมโรค (Success Rate ≥ 88%, Death ≤ 7% เฉพาะผู้ป่วยขึ้นทะเบียน Q1 ต.ค.-ธ.ค., LTFU ≤ 5%) ครอบคลุมผลการรักษา ตัวชี้วัด การคัดกรอง AFB/HIV/Gene Xpert โรคประจำตัว และสูตรยา"
                disabled={!aiSummary}
            />
        </div>
    );
}