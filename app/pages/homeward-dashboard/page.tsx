"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
    RefreshCw, UploadCloud, CheckCircle2, XCircle, Info,
    Users, AlertTriangle, Building2, MapPin, Activity, TrendingUp,
} from "lucide-react";
import type { HomeWardDashboardData, HomeWardSummary, HomeWardRow } from "@/app/api/homeward-dashboard/route";

// ─── Colors (project theme) ───────────────────────────────────────────────────
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

const PALETTE = [C.blue, C.green, C.amber, C.teal, C.coral, C.purple, C.red, C.gray];
const DRUG_COLOR: Record<string, string> = {
    "ยาบ้า/Amphetamine (F15)": C.red,
    "แอลกอฮอล์ (F10)": C.amber,
    "กัญชา (F12)": C.green,
    "จิตเภท (F20)": C.purple,
    "ไม่ระบุ": C.gray,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, accentBg }: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; accent: string; accentBg: string;
}) {
    return (
        <motion.div
            className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-2 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentBg }}>
                <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </motion.div>
    );
}

function SectionCard({ title, icon: Icon, children }: {
    title: string; icon: React.ElementType; children: React.ReactNode;
}) {
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
                        <motion.div className="h-full rounded"
                            style={{ backgroundColor: colors[i % colors.length] }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(val / max) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.03 }}
                        />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right font-semibold text-gray-700">{val}</span>
                </div>
            ))}
        </div>
    );
}

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

// ─── Filters ──────────────────────────────────────────────────────────────────
interface Filters {
    month: string;
    tambon: string;
    drug: string;
    rpsst: string;
    status: string;
}

function FilterBar({
    rows, filters, onChange, onReset,
}: { rows: HomeWardRow[]; filters: Filters; onChange: (f: Filters) => void; onReset: () => void }) {
    const months = [...new Set(rows.map((r) => r.monthTh))];
    const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
    const drugs = [...new Set(rows.map((r) => r.drugType))].sort();
    const rpssts = [...new Set(rows.map((r) => r.rpsst))].sort();

    const sel = (id: keyof Filters, val: string) => onChange({ ...filters, [id]: val });

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-end gap-4">
            {[
                { id: "month" as const, label: "เดือน", opts: months },
                { id: "tambon" as const, label: "ตำบล", opts: tambons },
                { id: "drug" as const, label: "ประเภทสารเสพติด", opts: drugs },
                { id: "rpsst" as const, label: "รพ.สต.", opts: rpssts },
            ].map(({ id, label, opts }) => (
                <div key={id} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                    <select
                        value={filters[id]}
                        onChange={(e) => sel(id, e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-600 min-w-[140px]"
                    >
                        <option value="">ทั้งหมด</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            ))}
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">สถานะชดเชย</label>
                <select
                    value={filters.status}
                    onChange={(e) => sel("status", e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-600 min-w-[140px]"
                >
                    <option value="">ทั้งหมด</option>
                    <option value="pending">ยังไม่ได้ชดเชย</option>
                    <option value="done">ชดเชยแล้ว</option>
                </select>
            </div>
            <button
                onClick={onReset}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
            >
                รีเซ็ต
            </button>
        </div>
    );
}

// ─── Upload Dropzone ──────────────────────────────────────────────────────────
function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const upload = useCallback(async (file: File) => {
        setUploading(true); setResult(null);
        const form = new FormData(); form.append("file", file);
        try {
            const res = await fetch("/api/homeward-upload", { method: "POST", body: form, credentials: "include" });
            const json = await res.json();
            setResult({ ok: !!json.success, msg: json.message ?? json.error });
            if (json.success) setTimeout(onSuccess, 600);
        } catch { setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" }); }
        finally { setUploading(false); }
    }, [onSuccess]);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">อัปโหลดข้อมูล Excel (แยก sheet รายเดือน)</p>
                <span className="text-xs text-gray-400">homeward.xlsx</span>
            </div>
            <motion.div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
                onClick={() => !uploading && inputRef.current?.click()}
                animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa" }}
                className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center gap-2 py-5 select-none"
            >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                <AnimatePresence mode="wait">
                    {uploading ? (
                        <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                <RefreshCw size={24} className="text-green-600" />
                            </motion.div>
                            <p className="text-sm font-semibold text-green-700">กำลังอัปโหลด...</p>
                        </motion.div>
                    ) : result?.ok ? (
                        <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                            <CheckCircle2 size={24} className="text-green-600" />
                            <p className="text-sm font-bold text-green-700">{result.msg}</p>
                            <p className="text-xs text-gray-400 underline cursor-pointer" onClick={(e) => { e.stopPropagation(); setResult(null); }}>อัปโหลดไฟล์ใหม่</p>
                        </motion.div>
                    ) : result ? (
                        <motion.div key="err" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                            <XCircle size={24} className="text-red-500" />
                            <p className="text-sm font-semibold text-red-600">{result.msg}</p>
                            <p className="text-xs text-gray-500 underline cursor-pointer" onClick={(e) => { e.stopPropagation(); setResult(null); }}>ลองใหม่</p>
                        </motion.div>
                    ) : (
                        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1 pointer-events-none">
                            <UploadCloud size={24} style={{ color: dragging ? "#3aa36a" : "#9ca3af" }} />
                            <p className="text-sm font-semibold text-gray-600">{dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเลือก"}</p>
                            <p className="text-xs text-gray-400">ไฟล์ Excel รายชื่อ Home Ward (sheet แยกรายเดือน)</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// ─── Summary Table ────────────────────────────────────────────────────────────
function SummaryByTambon({ rows }: { rows: HomeWardRow[] }) {
    const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
    const totals = { total: 0, done: 0, pending: 0, amount: 0 };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <MapPin size={15} className="text-gray-400" />
                <p className="text-sm font-semibold text-gray-600">สรุปรายตำบล — สถานะ DRG</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700">
                            {["ตำบล", "ผู้ป่วย (ราย)", "ชดเชยแล้ว", "ยังไม่ได้", "เงินชดเชย (บาท)", "% ยังไม่ได้"].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-white font-semibold border-r border-green-600">{h}</th>
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
                            totals.total += recs.length; totals.done += done; totals.pending += pending; totals.amount += amount;
                            return (
                                <tr key={t} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-50/40 transition-colors`}>
                                    <td className="px-4 py-2.5 font-semibold text-gray-800">{t}</td>
                                    <td className="px-4 py-2.5 text-gray-700">{recs.length}</td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">{done}</span>
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
                        <tr className="bg-amber-50 font-bold border-t-2 border-amber-200">
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
function PatientTable({ rows }: { rows: HomeWardRow[] }) {
    const [page, setPage] = useState(1);
    const PAGE = 20;
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const paged = rows.slice((page - 1) * PAGE, page * PAGE);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-600">รายชื่อผู้ป่วยทั้งหมด</p>
                </div>
                <span className="text-xs text-gray-400">{total} ราย</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700 sticky top-0">
                            {["เดือน", "admit date", "d/c date", "วันนอน", "Ward", "สิทธิ", "AN", "ชื่อผู้ป่วย", "Pdx.", "ประเภทสาร", "ตำบล", "อายุ", "รพ.สต.", "ชดเชย", "adj.RW", "สถานะ"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr key={`${r.an}-${i}`} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-50/40 transition-colors`}>
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
                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">ชดเชยแล้ว</span>
                                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">ยังไม่ได้</span>}
                                </td>
                            </tr>
                        ))}
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

// ─── Charts ───────────────────────────────────────────────────────────────────
function DashboardCharts({ rows }: { rows: HomeWardRow[] }) {
    const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

    const byMonth = useMemo(() => {
        const m: Record<string, number> = {};
        rows.forEach((r) => { m[r.monthTh] = (m[r.monthTh] || 0) + 1; });
        const order = ["พฤศจิกายน 2568", "ธันวาคม 2568", "มกราคม 2569", "กุมภาพันธ์ 2569", "มีนาคม 2569", "เมษายน 2569"];
        return order.filter((k) => m[k]).map((k) => ({ month: k.replace(" 256", "\n256"), count: m[k] }));
    }, [rows]);

    const byTambon = useMemo(() =>
        Object.entries(rows.reduce((m, r) => { m[r.tambon] = (m[r.tambon] || 0) + 1; return m; }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a) as [string, number][], [rows]);

    const byDrug = useMemo(() => {
        const m: Record<string, number> = {};
        rows.forEach((r) => { m[r.drugType] = (m[r.drugType] || 0) + 1; });
        return Object.entries(m).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value, color: DRUG_COLOR[name] ?? C.gray }));
    }, [rows]);

    const byRpsst = useMemo(() =>
        Object.entries(rows.reduce((m, r) => { m[r.rpsst] = (m[r.rpsst] || 0) + 1; return m; }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a) as [string, number][], [rows]);

    const statusData = useMemo(() => {
        const comp = rows.filter((r) => r.isCompensated).length;
        return [{ name: `ยังไม่ได้ชดเชย (${rows.length - comp})`, value: rows.length - comp, color: C.amber },
        { name: `ชดเชยแล้ว (${comp})`, value: comp, color: C.green }];
    }, [rows]);

    // Stacked: tambon × drug
    const stackedData = useMemo(() => {
        const tambons = [...new Set(rows.map((r) => r.tambon))].sort();
        const drugs = [...new Set(rows.map((r) => r.drugType))];
        return tambons.map((t) => {
            const obj: Record<string, unknown> = { tambon: t };
            drugs.forEach((d) => { obj[d] = rows.filter((r) => r.tambon === t && r.drugType === d).length; });
            return obj;
        });
    }, [rows]);

    const drugs = [...new Set(rows.map((r) => r.drugType))];

    return (
        <div className="space-y-4">
            <SectionCard title="แนวโน้มผู้ป่วยรายเดือน" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.green} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tip} formatter={(v: number) => [v + " ราย", "จำนวน"]} />
                        <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
                            fill="url(#areaGrad)" dot={{ r: 4, fill: C.green }} activeDot={{ r: 6 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="สถานะการชดเชย DRG" icon={AlertTriangle}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={statusData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={4}>
                                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={statusData.map((d) => ({ label: d.name, color: d.color }))} />
                </SectionCard>

                <SectionCard title="ประเภทสารเสพติด" icon={Activity}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={byDrug} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3}>
                                {byDrug.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                        </PieChart>
                    </div>
                    <Legend items={byDrug.map((d) => ({ label: `${d.name.split(" ")[0]} ${d.value}`, color: d.color }))} />
                </SectionCard>

                <SectionCard title="จำนวนตาม รพ.สต." icon={Building2}>
                    <HBarList data={byRpsst} colors={PALETTE} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="จำนวนผู้ป่วยแยกตำบล" icon={MapPin}>
                    <HBarList data={byTambon} colors={PALETTE} />
                </SectionCard>

                <SectionCard title="ตำบล × ประเภทสารเสพติด (Stacked)" icon={Activity}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={stackedData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="tambon" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip {...tip} />
                            {drugs.map((d, i) => (
                                <Bar key={d} dataKey={d} stackId="a"
                                    fill={DRUG_COLOR[d] ?? PALETTE[i % PALETTE.length]}
                                    radius={i === drugs.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    <Legend items={drugs.map((d, i) => ({ label: d.split(" ")[0], color: DRUG_COLOR[d] ?? PALETTE[i % PALETTE.length] }))} />
                </SectionCard>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const EMPTY_FILTERS: Filters = { month: "", tambon: "", drug: "", rpsst: "", status: "" };

export default function HomeWardDashboardPage() {
    const [data, setData] = useState<HomeWardDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [noFile, setNoFile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null); setNoFile(false);
        try {
            const res = await fetch("/api/homeward-dashboard", { credentials: "include" });
            if (res.status === 404) { setNoFile(true); setLoading(false); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

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

    const s = data?.summary;
    const filtComp = filteredRows.filter((r) => r.isCompensated).length;
    const filtPending = filteredRows.length - filtComp;
    const filtAmount = filteredRows.reduce((sum, r) => sum + r.chodchey, 0);
    const filtRw = filteredRows.reduce((sum, r) => sum + (r.adjRw ?? 0), 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-gray-800">
                        Home Ward ยาเสพติด — แยกรายตำบล
                        {s && <span className="ml-2 text-sm font-normal text-gray-400">· {s.total} ราย · {s.tambonCount} ตำบล</span>}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        สถานะการชดเชย DRG · พ.ย. 2568 – เม.ย. 2569 · รพ.พลับพลาชัย
                        {data && <span className="ml-2">· อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
                    </p>
                </div>
                <button onClick={fetchData} disabled={loading}
                    className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                        transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                        <RefreshCw size={14} />
                    </motion.span>
                    รีเฟรช
                </button>
            </div>

            {/* No file / Error */}
            {noFile && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                    <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
                        <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel รายชื่อ Home Ward แยกรายตำบล</p>
                    </div>
                </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">เกิดข้อผิดพลาด: {error}</div>}

            {/* DRG Warning */}
            {s && s.pending > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <strong>สถานะการชดเชย DRG:</strong> ผู้ป่วย <strong>{s.pending} ราย</strong> ยังไม่ได้รับการชดเชย DRG
                        {s.totalAmount === 0 && " — ยังไม่มีการส่ง Claim / ยังไม่ได้รับเงินชดเชย"}
                    </div>
                </div>
            )}

            {/* KPI */}
            {(loading || s) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    )) : (
                        <>
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(filteredRows.length)} ราย`}
                                sub={`จาก ${s!.total} ราย`} accent={C.blue} accentBg={C.blueL} />
                            <KpiCard icon={CheckCircle2} label="ชดเชยแล้ว" value={`${fmt(filtComp)} ราย`}
                                sub={filteredRows.length ? `${((filtComp / filteredRows.length) * 100).toFixed(1)}%` : "0%"}
                                accent={C.green} accentBg={C.greenL} />
                            <KpiCard icon={AlertTriangle} label="ยังไม่ได้ชดเชย" value={`${fmt(filtPending)} ราย`}
                                sub={filteredRows.length ? `${((filtPending / filteredRows.length) * 100).toFixed(1)}%` : "0%"}
                                accent={C.amber} accentBg={C.amberL} />
                            <KpiCard icon={Activity} label="เงินชดเชยรวม" value={`${fmt(filtAmount)} บาท`}
                                sub="ที่ได้รับ" accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={TrendingUp} label="adj.RW รวม" value={filtRw.toFixed(2)}
                                sub="หน่วย RW" accent={C.purple} accentBg="#EEEDFE" />
                            <KpiCard icon={MapPin} label="จำนวนตำบล" value={`${new Set(filteredRows.map((r) => r.tambon)).size} ตำบล`}
                                sub={`รพ.สต. ${new Set(filteredRows.map((r) => r.rpsst)).size} แห่ง`}
                                accent={C.coral} accentBg="#FAECE7" />
                        </>
                    )}
                </div>
            )}

            {/* Filters */}
            {data && data.rows.length > 0 && (
                <FilterBar rows={data.rows} filters={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />
            )}

            {/* Charts */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />)}
                </div>
            )}
            {!loading && filteredRows.length > 0 && <DashboardCharts rows={filteredRows} />}

            {/* Summary Table */}
            {!loading && filteredRows.length > 0 && <SummaryByTambon rows={filteredRows} />}

            {/* Patient Table */}
            {!loading && filteredRows.length > 0 && <PatientTable rows={filteredRows} />}

            {/* Upload */}
            <UploadDropzone onSuccess={fetchData} />
        </div>
    );
}