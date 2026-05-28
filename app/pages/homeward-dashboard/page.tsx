"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
    RefreshCw, Info, Wifi, WifiOff,
    Users, AlertTriangle, Building2, MapPin, Activity, TrendingUp,
    CheckCircle2,
} from "lucide-react";
import type { HomeWardSheetsData, HomeWardSheetRow, HomeWardSummary } from "@/app/api/homeward-sheets/route";

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000;

// ─── Colors (mint green theme) ────────────────────────────────────────────────
const C = {
    green: "#3aa36a", greenL: "#d6f0e0",
    dark: "#1a5233", darkL: "#f0faf4",
    mid: "#236b43", midL: "#c2e8d4",
    light: "#7ec8a0", lightL: "#e8f5ee",
    amber: "#EF9F27", amberL: "#FAEEDA",
    red: "#E24B4A", redL: "#FCEBEB",
    teal: "#2d8a56", tealL: "#d0eedd",
    purple: "#7F77DD",
    gray: "#888780", grayL: "#F1EFE8",
};

const PALETTE = [C.dark, C.green, C.amber, C.teal, C.light, C.purple, C.red, C.gray];

const DRUG_COLOR: Record<string, string> = {
    "ยาบ้า/Amphetamine (F15)": C.red,
    "แอลกอฮอล์ (F10)": C.amber,
    "กัญชา (F12)": C.green,
    "จิตเภท (F20)": C.purple,
    "ไม่ระบุ": C.gray,
};

const TT_STYLE = {
    fontSize: 11, borderRadius: 8,
    border: "0.5px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");

// ─── Countdown Ring ───────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
    const r = 10, circ = 2 * Math.PI * r;
    const prog = circ * (1 - secondsLeft / total);
    return (
        <svg width={28} height={28} viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={r} fill="none" stroke="#d6f0e0" strokeWidth={2.5} />
            <circle cx={12} cy={12} r={r} fill="none" stroke="#7ec8a0" strokeWidth={2.5}
                strokeDasharray={circ} strokeDashoffset={prog}
                strokeLinecap="round" transform="rotate(-90 12 12)"
                style={{ transition: "stroke-dashoffset 1s linear" }} />
            <text x={12} y={16} textAnchor="middle" fontSize={8} fill="#1a5233" fontWeight={700}>
                {secondsLeft}
            </text>
        </svg>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, accentBg }: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; accent: string; accentBg: string;
}) {
    return (
        <motion.div
            className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-2 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: accentBg }}>
                <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </motion.div>
    );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({ title, icon: Icon, children }: {
    title: string; icon: React.ElementType; children: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Icon size={15} style={{ color: C.green }} />
                <p className="text-sm font-semibold" style={{ color: C.dark }}>{title}</p>
            </div>
            {children}
        </div>
    );
}

// ─── Horizontal Bar List ──────────────────────────────────────────────────────
function HBarList({ data, colors }: { data: [string, number][]; colors: string[] }) {
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div className="space-y-2">
            {data.map(([label, val], i) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 flex-shrink-0 text-right text-gray-500 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                        <motion.div className="h-full rounded"
                            style={{ backgroundColor: colors[i % colors.length] }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(val / max) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.03 }} />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right font-semibold text-gray-700">{val}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ items }: { items: { label: string; color: string; value?: number }[] }) {
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

// ─── Filters ─────────────────────────────────────────────────────────────────
interface Filters {
    month: string; tambon: string; drug: string; rpsst: string; status: string;
}
const EMPTY_FILTERS: Filters = { month: "", tambon: "", drug: "", rpsst: "", status: "" };

function FilterBar({ rows, filters, onChange, onReset }: {
    rows: HomeWardSheetRow[]; filters: Filters;
    onChange: (f: Filters) => void; onReset: () => void;
}) {
    const months = [...new Set(rows.map((r) => r.monthTh))];
    const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
    const drugs = [...new Set(rows.map((r) => r.drugType))].sort();
    const rpssts = [...new Set(rows.map((r) => r.rpsst))].sort();
    const sel = (id: keyof Filters, val: string) => onChange({ ...filters, [id]: val });

    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-end gap-4">
            {[
                { id: "month" as const, label: "เดือน", opts: months },
                { id: "tambon" as const, label: "ตำบล", opts: tambons },
                { id: "drug" as const, label: "ประเภทสารเสพติด", opts: drugs },
                { id: "rpsst" as const, label: "รพ.สต.", opts: rpssts },
            ].map(({ id, label, opts }) => (
                <div key={id} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                    <select value={filters[id]} onChange={(e) => sel(id, e.target.value)}
                        className="border border-[#a8d5ba] rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
              focus:outline-none focus:border-[#3aa36a] min-w-[140px]">
                        <option value="">ทั้งหมด</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            ))}
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">สถานะชดเชย</label>
                <select value={filters.status} onChange={(e) => sel("status", e.target.value)}
                    className="border border-[#a8d5ba] rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
            focus:outline-none focus:border-[#3aa36a] min-w-[140px]">
                    <option value="">ทั้งหมด</option>
                    <option value="pending">ยังไม่ได้ชดเชย</option>
                    <option value="done">ชดเชยแล้ว</option>
                </select>
            </div>
            <button onClick={onReset}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
                รีเซ็ต
            </button>
        </div>
    );
}

// ─── Summary Table by Tambon ──────────────────────────────────────────────────
function SummaryByTambon({ rows }: { rows: HomeWardSheetRow[] }) {
    const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
    const totals = { total: 0, done: 0, pending: 0, amount: 0 };

    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e8f5ee] flex items-center gap-2">
                <MapPin size={15} style={{ color: C.green }} />
                <p className="text-sm font-semibold" style={{ color: C.dark }}>สรุปรายตำบล — สถานะ DRG</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr style={{ backgroundColor: C.dark }}>
                            {["ตำบล", "ผู้ป่วย (ราย)", "ชดเชยแล้ว", "ยังไม่ได้", "เงินชดเชย (บาท)", "% ยังไม่ได้"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-white font-semibold border-r border-[#236b43]">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tambons.map((t, i) => {
                            const recs = rows.filter((r) => r.tambon === t);
                            const done = recs.filter((r) => r.isCompensated).length;
                            const pending = recs.length - done;
                            const amount = recs.reduce((s, r) => s + r.chodchey, 0);
                            const pct = recs.length ? ((pending / recs.length) * 100).toFixed(1) : "0.0";
                            totals.total += recs.length; totals.done += done;
                            totals.pending += pending; totals.amount += amount;
                            return (
                                <tr key={t} className={`border-b border-[#e8f5ee] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#f0faf4]"} hover:bg-[#e8f5ee]`}>
                                    <td className="px-4 py-2.5 font-semibold text-gray-800">{t}</td>
                                    <td className="px-4 py-2.5 text-gray-700">{recs.length}</td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#d6f0e0] text-[#1a5233]">{done}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">{pending}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700">{fmt(amount)}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`font-semibold ${parseFloat(pct) > 50 ? "text-red-600" : "text-gray-600"}`}>{pct}%</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#f0faf4] font-bold border-t-2 border-[#a8d5ba]">
                            <td className="px-4 py-2.5 text-gray-800">รวม</td>
                            <td className="px-4 py-2.5">{totals.total}</td>
                            <td className="px-4 py-2.5">{totals.done}</td>
                            <td className="px-4 py-2.5">{totals.pending}</td>
                            <td className="px-4 py-2.5">{fmt(totals.amount)}</td>
                            <td className="px-4 py-2.5">{totals.total ? ((totals.pending / totals.total) * 100).toFixed(1) : "0.0"}%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: HomeWardSheetRow[] }) {
    const [page, setPage] = useState(1);
    const PAGE = 20;
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const paged = rows.slice((page - 1) * PAGE, page * PAGE);

    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e8f5ee] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={15} style={{ color: C.green }} />
                    <p className="text-sm font-semibold" style={{ color: C.dark }}>รายชื่อผู้ป่วยทั้งหมด</p>
                </div>
                <span className="text-xs text-gray-400">{total} ราย</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="sticky top-0" style={{ backgroundColor: C.dark }}>
                            {["เดือน", "Admit date", "D/C date", "วันนอน", "Ward", "สิทธิ", "AN", "ชื่อผู้ป่วย",
                                "Pdx.", "ประเภทสาร", "ตำบล", "อายุ", "รพ.สต.", "ชดเชย", "adj.RW", "สถานะ"].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-[#236b43] whitespace-nowrap">{h}</th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr key={`${r.an}-${i}`} className={`border-b border-[#e8f5ee] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#f0faf4]"} hover:bg-[#e8f5ee]`}>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.monthTh}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.admitDate || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.dcDate || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.daysStay ?? "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.ward || "-"}</td>
                                <td className="px-3 py-2 text-gray-600">{r.sitthi || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.an || "-"}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.name}</td>
                                <td className="px-3 py-2 text-gray-600 font-mono">{r.pdx || "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ background: (DRUG_COLOR[r.drugType] ?? C.gray) + "20", color: DRUG_COLOR[r.drugType] ?? C.gray }}>
                                        {r.drugType}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.tambon}</td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.rpsst}</td>
                                <td className="px-3 py-2 text-gray-600 text-right">{r.chodchey > 0 ? fmt(r.chodchey) : "-"}</td>
                                <td className="px-3 py-2 text-gray-600 text-right">{r.adjRw?.toFixed(2) ?? "-"}</td>
                                <td className="px-3 py-2">
                                    {r.isCompensated
                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#d6f0e0] text-[#1a5233]">ชดเชยแล้ว</span>
                                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">ยังไม่ได้</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#e8f5ee]">
                    <p className="text-xs text-gray-400">หน้า {page} / {pages}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 border border-[#a8d5ba] rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-[#f0faf4]">← ก่อนหน้า</button>
                        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                            className="px-3 py-1.5 border border-[#a8d5ba] rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-[#f0faf4]">ถัดไป →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function DashboardCharts({ rows, summary }: { rows: HomeWardSheetRow[]; summary: HomeWardSummary }) {
    const drugs = useMemo(() => [...new Set(rows.map((r) => r.drugType))], [rows]);

    const byMonth = useMemo(() => summary.byMonth, [summary]);

    const byTambon = useMemo(() =>
        Object.entries(summary.byTambon).sort(([, a], [, b]) => b - a) as [string, number][], [summary]);

    const byDrug = useMemo(() =>
        Object.entries(summary.byDrug).sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value, color: DRUG_COLOR[name] ?? C.gray })), [summary]);

    const byRpsst = useMemo(() =>
        Object.entries(summary.byRpsst).sort(([, a], [, b]) => b - a) as [string, number][], [summary]);

    const statusData = useMemo(() => [
        { name: `ยังไม่ได้ชดเชย (${summary.pending})`, value: summary.pending, color: C.amber },
        { name: `ชดเชยแล้ว (${summary.compensated})`, value: summary.compensated, color: C.green },
    ], [summary]);

    const stackedData = useMemo(() => {
        const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
        return tambons.map((t) => {
            const obj: Record<string, unknown> = { tambon: t };
            drugs.forEach((d) => { obj[d] = rows.filter((r) => r.tambon === t && r.drugType === d).length; });
            return obj;
        });
    }, [rows, drugs]);

    return (
        <div className="space-y-4">
            <ChartCard title="แนวโน้มผู้ป่วยรายเดือน" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#e8f5ee" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [v + " ราย", "จำนวน"]} />
                        <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
                            fill="url(#areaGrad)" dot={{ r: 4, fill: C.green }} activeDot={{ r: 6 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChartCard title="สถานะการชดเชย DRG" icon={AlertTriangle}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={statusData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={4}>
                                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [v + " ราย"]} />
                        </PieChart>
                    </div>
                    <Legend items={statusData.map((d) => ({ label: d.name, color: d.color }))} />
                </ChartCard>

                <ChartCard title="ประเภทสารเสพติด" icon={Activity}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={byDrug} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3}>
                                {byDrug.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [v + " ราย"]} />
                        </PieChart>
                    </div>
                    <Legend items={byDrug.map((d) => ({ label: `${d.name.split(" ")[0]} ${d.value}`, color: d.color }))} />
                </ChartCard>

                <ChartCard title="จำนวนตาม รพ.สต." icon={Building2}>
                    <HBarList data={byRpsst} colors={PALETTE} />
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="จำนวนผู้ป่วยแยกตำบล" icon={MapPin}>
                    <HBarList data={byTambon} colors={PALETTE} />
                </ChartCard>

                <ChartCard title="ตำบล × ประเภทสารเสพติด (Stacked)" icon={Activity}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={stackedData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#e8f5ee" />
                            <XAxis dataKey="tambon" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={TT_STYLE} />
                            {drugs.map((d, i) => (
                                <Bar key={d} dataKey={d} stackId="a"
                                    fill={DRUG_COLOR[d] ?? PALETTE[i % PALETTE.length]}
                                    radius={i === drugs.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    <Legend items={drugs.map((d, i) => ({ label: d.split(" ")[0], color: DRUG_COLOR[d] ?? PALETTE[i % PALETTE.length] }))} />
                </ChartCard>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomeWardDashboardPage() {
    const [data, setData] = useState<HomeWardSheetsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(true);
    const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL_MS / 1000);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/homeward-sheets", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json: HomeWardSheetsData = await res.json();
            setData(json);
            setConnected(true);
        } catch (e) {
            setConnected(false);
            if (!silent) setError((e as Error).message);
        } finally {
            if (!silent) setLoading(false);
            setSecondsLeft(REFRESH_INTERVAL_MS / 1000);
        }
    }, []);

    // auto-refresh
    useEffect(() => {
        fetchData();
        timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
        countRef.current = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : REFRESH_INTERVAL_MS / 1000)), 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countRef.current) clearInterval(countRef.current);
        };
    }, [fetchData]);

    const filteredRows = useMemo(() => {
        if (!data) return [];
        return data.rows.filter((r) => {
            if (filters.month && r.monthTh !== filters.month) return false;
            if (filters.tambon && r.tambon !== filters.tambon) return false;
            if (filters.drug && r.drugType !== filters.drug) return false;
            if (filters.rpsst && r.rpsst !== filters.rpsst) return false;
            if (filters.status === "pending" && r.isCompensated) return false;
            if (filters.status === "done" && !r.isCompensated) return false;
            return true;
        });
    }, [data, filters]);

    // derived KPIs from filtered rows
    const filtComp = filteredRows.filter((r) => r.isCompensated).length;
    const filtPending = filteredRows.length - filtComp;
    const filtAmount = filteredRows.reduce((s, r) => s + r.chodchey, 0);
    const filtRw = filteredRows.reduce((s, r) => s + (r.adjRw ?? 0), 0);

    // build filtered summary for charts
    const filteredSummary = useMemo((): HomeWardSummary | null => {
        if (!filteredRows.length) return data?.summary ?? null;
        const compensated = filteredRows.filter((r) => r.isCompensated).length;
        const monthMap: Record<string, number> = {};
        const byTambon: Record<string, number> = {};
        const byDrug: Record<string, number> = {};
        const byRpsst: Record<string, number> = {};
        const amountByTambon: Record<string, number> = {};
        const tambonDrug: Record<string, Record<string, number>> = {};
        const THAI_M: Record<string, string> = {
            "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.", "05": "พ.ค.", "06": "มิ.ย.",
            "07": "ก.ค.", "08": "ส.ค.", "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
        };
        filteredRows.forEach((r) => {
            monthMap[r.month] = (monthMap[r.month] || 0) + 1;
            byTambon[r.tambon] = (byTambon[r.tambon] || 0) + 1;
            byDrug[r.drugType] = (byDrug[r.drugType] || 0) + 1;
            byRpsst[r.rpsst] = (byRpsst[r.rpsst] || 0) + 1;
            amountByTambon[r.tambon] = (amountByTambon[r.tambon] || 0) + r.chodchey;
            if (!tambonDrug[r.tambon]) tambonDrug[r.tambon] = {};
            tambonDrug[r.tambon][r.drugType] = (tambonDrug[r.tambon][r.drugType] || 0) + 1;
        });
        const byMonth = Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ym, count]) => {
                const [y, m] = ym.split("-");
                return { month: `${THAI_M[m] ?? m} ${String(parseInt(y) + 543).slice(2)}`, count };
            });
        return {
            total: filteredRows.length, compensated, pending: filteredRows.length - compensated,
            totalAmount: filtAmount, totalAdjRw: filtRw,
            tambonCount: new Set(filteredRows.map((r) => r.tambon)).size,
            byMonth, byTambon, byDrug, byRpsst, amountByTambon, tambonDrug,
        };
    }, [filteredRows, filtAmount, filtRw, data]);

    const s = data?.summary;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="rounded-2xl shadow-sm overflow-hidden">
                <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 100%)` }}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-white">Home Ward ยาเสพติด — แยกรายตำบล</h1>
                            <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
                                LIVE
                            </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: C.lightL }}>
                            รพ.พลับพลาชัย · อัปเดตทุก 30 วินาที
                            {data && <span className="ml-2">· อัปเดตล่าสุด {new Date(data.updatedAt).toLocaleTimeString("th-TH")}</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {connected
                            ? <Wifi size={16} className="text-green-200" />
                            : <WifiOff size={16} className="text-red-300" />}
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                        <button onClick={() => fetchData()} disabled={loading}
                            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-40">
                            <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                                transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                                <RefreshCw size={14} />
                            </motion.span>
                            รีเฟรช
                        </button>
                    </div>
                </div>

                {/* Sheets pills */}
                {data?.sheets && data.sheets.length > 0 && (
                    <div className="px-6 py-2 bg-[#f0faf4] border-t border-[#d6f0e0] flex flex-wrap gap-2">
                        {data.sheets.map((sh) => (
                            <span key={sh} className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                                style={{ background: C.greenL, color: C.dark }}>{sh}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">เกิดข้อผิดพลาด: {error}</p>
                </div>
            )}

            {/* ── DRG Warning ── */}
            {s && s.pending > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <strong>สถานะการชดเชย DRG:</strong> ผู้ป่วย <strong>{s.pending} ราย</strong> ยังไม่ได้รับการชดเชย DRG
                    </div>
                </div>
            )}

            {/* ── KPI Cards ── */}
            {(loading || s) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    )) : (
                        <>
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(filteredRows.length)} ราย`}
                                sub={`จาก ${s!.total} ราย`} accent={C.dark} accentBg={C.darkL} />
                            <KpiCard icon={CheckCircle2} label="ชดเชยแล้ว" value={`${fmt(filtComp)} ราย`}
                                sub={filteredRows.length ? `${((filtComp / filteredRows.length) * 100).toFixed(1)}%` : "0%"}
                                accent={C.green} accentBg={C.greenL} />
                            <KpiCard icon={AlertTriangle} label="ยังไม่ได้ชดเชย" value={`${fmt(filtPending)} ราย`}
                                sub={filteredRows.length ? `${((filtPending / filteredRows.length) * 100).toFixed(1)}%` : "0%"}
                                accent={C.amber} accentBg={C.amberL} />
                            <KpiCard icon={Activity} label="เงินชดเชยรวม" value={`${fmt(filtAmount)} บาท`}
                                sub="ที่ได้รับ" accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={TrendingUp} label="adj.RW รวม" value={filtRw.toFixed(2)}
                                sub="หน่วย RW" accent={C.mid} accentBg={C.midL} />
                            <KpiCard icon={MapPin} label="จำนวนตำบล" value={`${new Set(filteredRows.map((r) => r.tambon)).size} ตำบล`}
                                sub={`รพ.สต. ${new Set(filteredRows.map((r) => r.rpsst)).size} แห่ง`}
                                accent={C.green} accentBg={C.greenL} />
                        </>
                    )}
                </div>
            )}

            {/* ── Filters ── */}
            {data && data.rows.length > 0 && (
                <FilterBar rows={data.rows} filters={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />
            )}

            {/* ── Charts ── */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />)}
                </div>
            )}
            {!loading && filteredRows.length > 0 && filteredSummary && (
                <DashboardCharts rows={filteredRows} summary={filteredSummary} />
            )}

            {/* ── Summary Table ── */}
            {!loading && filteredRows.length > 0 && <SummaryByTambon rows={filteredRows} />}

            {/* ── Patient Table ── */}
            {!loading && filteredRows.length > 0 && <PatientTable rows={filteredRows} />}

            {/* ── Empty ── */}
            {!loading && !error && data?.rows.length === 0 && (
                <div className="bg-[#f0faf4] border border-[#d6f0e0] rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
                    <Info size={24} style={{ color: C.green }} />
                    <p className="text-sm font-semibold" style={{ color: C.dark }}>ยังไม่มีข้อมูล</p>
                    <p className="text-xs text-gray-500">ตรวจสอบว่า Google Sheet มีข้อมูลและ Service Account มีสิทธิ์เข้าถึง</p>
                </div>
            )}
        </div>
    );
}