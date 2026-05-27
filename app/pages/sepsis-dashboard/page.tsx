"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend as RechartLegend,
    AreaChart, Area,
} from "recharts";
import {
    RefreshCw, UploadCloud, CheckCircle2, XCircle, Info,
    Users, AlertTriangle, Activity, TrendingUp, Skull, ShieldAlert,
    Microscope, MapPin, HeartPulse,
} from "lucide-react";
import type { SepsisDashboardData, SepsisSummary, SepsisRow, SepsisByYear } from "@/app/api/sepsis-dashboard/route";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
    green: "#639922", greenL: "#EAF3DE",
    blue: "#378ADD", blueL: "#E6F1FB",
    amber: "#EF9F27", amberL: "#FAEEDA",
    red: "#E24B4A", redL: "#FCEBEB",
    teal: "#1D9E75", tealL: "#E1F5EE",
    coral: "#D85A30", coralL: "#FAECE7",
    purple: "#7F77DD", purpleL: "#EEEDFE",
    gray: "#888780", grayL: "#F1EFE8",
};

const YEAR_COLORS = [C.purple, C.blue, C.teal, C.green, C.amber, C.coral, C.red];
const SITE_COLORS: Record<string, string> = {
    "ระบบทางเดินหายใจ (RS)": C.blue,
    "ระบบทางเดินปัสสาวะ (GU)": C.amber,
    "ทั่วร่างกาย (Systemic)": C.red,
    "ระบบทางเดินอาหาร (GI)": C.teal,
    "ผิวหนัง/กล้ามเนื้อ (MSK)": C.coral,
    "ระบบประสาท (CNS)": C.purple,
    "ไม่ระบุ": C.gray,
};
const PALETTE = [C.blue, C.teal, C.green, C.amber, C.coral, C.purple, C.red, C.gray];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, accentBg, highlight }: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; accent: string; accentBg: string; highlight?: boolean;
}) {
    return (
        <motion.div
            className={`bg-white border rounded-2xl p-5 flex flex-col gap-2 shadow-sm ${highlight ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}
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

function SectionCard({ title, icon: Icon, children, wide }: {
    title: string; icon: React.ElementType; children: React.ReactNode; wide?: boolean;
}) {
    return (
        <div className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm ${wide ? "col-span-2" : ""}`}>
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
                    <span className="w-36 flex-shrink-0 text-right text-gray-500 truncate leading-tight" title={label}>{label}</span>
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

function ChartLegend({ items }: { items: { label: string; color: string; value?: number | string }[] }) {
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

// ─── Year Selector ────────────────────────────────────────────────────────────
function YearTab({ years, selected, onSelect }: { years: string[]; selected: string; onSelect: (y: string) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            <button
                onClick={() => onSelect("all")}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${selected === "all" ? "text-white shadow-sm" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}
                style={selected === "all" ? { backgroundColor: C.green } : {}}
            >
                ทุกปี
            </button>
            {years.map((y, i) => (
                <button key={y} onClick={() => onSelect(y)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${selected === y ? "text-white shadow-sm" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}
                    style={selected === y ? { backgroundColor: YEAR_COLORS[i % YEAR_COLORS.length] } : {}}
                >
                    {y}
                </button>
            ))}
        </div>
    );
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const upload = useCallback(async (file: File) => {
        setUploading(true); setResult(null);
        const form = new FormData(); form.append("file", file);
        try {
            const res = await fetch("/api/sepsis-upload", { method: "POST", body: form, credentials: "include" });
            const json = await res.json();
            setResult({ ok: !!json.success, msg: json.message ?? json.error });
            if (json.success) setTimeout(onSuccess, 600);
        } catch { setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" }); }
        finally { setUploading(false); }
    }, [onSuccess]);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">อัปโหลดข้อมูล Excel (sheet แยกรายปี)</p>
                <span className="text-xs text-gray-400">sepsis.xlsx</span>
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
                            <p className="text-xs text-gray-400">ไฟล์ Excel รายงาน Sepsis (sheet แยกรายปีงบประมาณ)</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// ─── Yearly Trend Chart ───────────────────────────────────────────────────────
function YearlyTrendChart({ data }: { data: { year: string; total: number; dead: number; mortalityRate: number }[] }) {
    return (
        <SectionCard title="แนวโน้มรายปี — จำนวนผู้ป่วยและอัตราเสียชีวิต" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 24, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.red }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v + "%"} />
                    <Tooltip {...tip} formatter={(v: number, name: string) =>
                        name === "อัตราเสียชีวิต (%)" ? [`${v}%`, name] : [v + " ราย", name]} />
                    <Bar yAxisId="left" dataKey="total" name="จำนวนทั้งหมด" fill={C.blue} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="dead" name="เสียชีวิต" fill={C.red} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="mortalityRate" name="อัตราเสียชีวิต (%)"
                        stroke={C.red} strokeWidth={2.5} dot={{ r: 4, fill: C.red }} />
                </BarChart>
            </ResponsiveContainer>
        </SectionCard>
    );
}

// ─── Site of Infection Donut ──────────────────────────────────────────────────
function SiteDonut({ data }: { data: Record<string, number> }) {
    const items = Object.entries(data).filter(([k]) => k !== "ไม่ระบุ").sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value, color: SITE_COLORS[name] ?? C.gray }));
    const total = items.reduce((s, it) => s + it.value, 0);
    return (
        <SectionCard title="Site of Infection" icon={ShieldAlert}>
            <div className="flex justify-center">
                <PieChart width={160} height={160}>
                    <Pie data={items} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {items.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v + " ราย", ""]} {...tip} />
                </PieChart>
            </div>
            <ChartLegend items={items.map((d) => ({ label: d.name.split(" ")[0], color: d.color, value: d.value }))} />
        </SectionCard>
    );
}

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: SepsisRow[] }) {
    const [page, setPage] = useState(1);
    const PAGE = 20;
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const paged = rows.slice((page - 1) * PAGE, page * PAGE);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-600">รายชื่อผู้ป่วย</p>
                </div>
                <span className="text-xs text-gray-400">{rows.length} ราย</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700 sticky top-0">
                            {["ปี", "ชื่อ-สกุล", "HN", "อายุ", "โรคประจำตัว", "วันที่รับบริการ", "แผนก", "Diagnosis", "Site", "Type", "Pathogen", "Status"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr key={`${r.year}-${r.hn}-${i}`}
                                className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${r.definiteStatus === "Dead" ? "bg-red-50/30" : ""} hover:bg-green-50/40 transition-colors`}>
                                <td className="px-3 py-2 text-gray-500">{r.year}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.name}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                                <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={r.comorbidity}>{r.comorbidity || "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.serviceDate || r.dxDate || "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ background: r.department === "ER" ? C.redL : C.blueL, color: r.department === "ER" ? C.red : C.blue }}>
                                        {r.department}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={r.diagnosis}>{r.diagnosis || "-"}</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[10px]">{r.siteOfInfection.split(" ")[0]}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ background: r.typeOfInfection === "Community" ? C.greenL : C.amberL, color: r.typeOfInfection === "Community" ? C.green : C.amber }}>
                                        {r.typeOfInfection === "Community" ? "Comm" : r.typeOfInfection === "Nosocomial" ? "Noso" : r.typeOfInfection}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[10px]">{r.pathogen}</td>
                                <td className="px-3 py-2">
                                    {r.definiteStatus === "Dead"
                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Dead</span>
                                        : r.definiteStatus === "Improve"
                                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Improve</span>
                                            : <span className="text-gray-400 text-[10px]">{r.definiteStatus || "-"}</span>}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SepsisDashboardPage() {
    const [data, setData] = useState<SepsisDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [noFile, setNoFile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState("all");

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null); setNoFile(false);
        try {
            const res = await fetch("/api/sepsis-dashboard", { credentials: "include" });
            if (res.status === 404) { setNoFile(true); setLoading(false); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();
            setData(d);
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const years = useMemo(() => data?.summary.byYear.map((y) => y.year) ?? [], [data]);

    const activeRows = useMemo(() => {
        if (!data) return [];
        if (selectedYear === "all") return data.rows;
        return data.rows.filter((r) => r.year === selectedYear);
    }, [data, selectedYear]);

    const activeYearData = useMemo((): SepsisByYear | null => {
        if (!data) return null;
        if (selectedYear === "all") return null;
        return data.summary.byYear.find((y) => y.year === selectedYear) ?? null;
    }, [data, selectedYear]);

    const s = data?.summary;

    // KPIs (derived from activeRows)
    const kpiTotal = activeRows.length;
    const kpiDead = activeRows.filter((r) => r.definiteStatus === "Dead").length;
    const kpiImprove = activeRows.filter((r) => r.definiteStatus === "Improve").length;
    const kpiShock = activeRows.filter((r) => r.septicShock === true).length;
    const kpiMortality = kpiTotal > 0 ? ((kpiDead / kpiTotal) * 100).toFixed(1) : "0.0";
    const kpiAvgAge = useMemo(() => {
        const ages = activeRows.map((r) => r.age).filter((a): a is number => a != null && a > 0);
        return ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
    }, [activeRows]);

    // Site / pathogen / zone aggregates from activeRows
    const siteData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => { m[r.siteOfInfection] = (m[r.siteOfInfection] || 0) + 1; });
        return m;
    }, [activeRows]);

    const pathogenData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => { if (r.pathogen !== "No Growth" && r.pathogen !== "Contaminate" && r.pathogen !== "ไม่ระบุ") m[r.pathogen] = (m[r.pathogen] || 0) + 1; });
        return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 10) as [string, number][];
    }, [activeRows]);

    const zoneData = useMemo(() =>
        Object.entries(activeRows.reduce((m, r) => { m[r.zone] = (m[r.zone] || 0) + 1; return m; }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a) as [string, number][], [activeRows]);

    const deptData = useMemo(() => {
        const comp = activeRows.filter((r) => r.typeOfInfection === "Community").length;
        const noso = activeRows.filter((r) => r.typeOfInfection === "Nosocomial").length;
        return [
            { name: `Community (${comp})`, value: comp, color: C.green },
            { name: `Nosocomial (${noso})`, value: noso, color: C.amber },
            { name: "ไม่ระบุ", value: kpiTotal - comp - noso, color: C.gray },
        ].filter((d) => d.value > 0);
    }, [activeRows, kpiTotal]);

    const deptCountData = useMemo(() =>
        Object.entries(activeRows.reduce((m, r) => { m[r.department] = (m[r.department] || 0) + 1; return m; }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a) as [string, number][], [activeRows]);

    const comorbData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => {
            const items = r.comorbidity.split(/[,\/;]/).map((s) => {
                const v = s.trim().toUpperCase();
                if (v.includes("DM")) return "DM";
                if (v.includes("HT")) return "HT";
                if (v.includes("CKD") || v.includes("ESRD")) return "CKD/ESRD";
                if (v.includes("CANCER") || v.startsWith("CA")) return "Cancer";
                if (v.includes("COPD")) return "COPD";
                if (v.includes("CVA")) return "CVA";
                return null;
            }).filter((v): v is string => v !== null);
            items.forEach((it) => { m[it] = (m[it] || 0) + 1; });
        });
        return Object.entries(m).sort(([, a], [, b]) => b - a).map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }));
    }, [activeRows]);

    const ageData = useMemo(() => {
        const groups = { "< 15": 0, "15-29": 0, "30-44": 0, "45-59": 0, "60-74": 0, "≥ 75": 0 };
        activeRows.forEach((r) => {
            if (!r.age) return;
            if (r.age < 15) groups["< 15"]++;
            else if (r.age < 30) groups["15-29"]++;
            else if (r.age < 45) groups["30-44"]++;
            else if (r.age < 60) groups["45-59"]++;
            else if (r.age < 75) groups["60-74"]++;
            else groups["≥ 75"]++;
        });
        return Object.entries(groups).map(([name, value]) => ({ name, value }));
    }, [activeRows]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-gray-800">
                        ผู้ป่วยติดเชื้อในกระแสเลือด (Sepsis)
                        {s && <span className="ml-2 text-sm font-normal text-gray-400">· รวม {fmt(s.total)} ราย · {years.length} ปีงบประมาณ</span>}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        รายงาน Septicaemia / Blood stream infection · รพ.พลับพลาชัย
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

            {/* Status */}
            {noFile && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                    <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
                        <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel รายงานผู้ป่วยติดเชื้อในกระแสเลือด</p>
                    </div>
                </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">เกิดข้อผิดพลาด: {error}</div>}

            {/* Year Tabs */}
            {!loading && s && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">เลือกปีงบประมาณ</p>
                    <YearTab years={years} selected={selectedYear} onSelect={setSelectedYear} />
                </div>
            )}

            {/* KPI */}
            {(loading || s) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    )) : (
                        <>
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(kpiTotal)} ราย`}
                                sub={selectedYear === "all" ? `${years.length} ปีงบประมาณ` : `ปี ${selectedYear}`}
                                accent={C.blue} accentBg={C.blueL} />
                            <KpiCard icon={CheckCircle2} label="Improve" value={`${fmt(kpiImprove)} ราย`}
                                sub={kpiTotal > 0 ? `${((kpiImprove / kpiTotal) * 100).toFixed(1)}%` : "0%"}
                                accent={C.green} accentBg={C.greenL} />
                            <KpiCard icon={Skull} label="เสียชีวิต (Dead)" value={`${fmt(kpiDead)} ราย`}
                                sub={`Mortality rate ${kpiMortality}%`} accent={C.red} accentBg={C.redL} highlight={kpiDead > 0} />
                            <KpiCard icon={AlertTriangle} label="Septic Shock" value={`${fmt(kpiShock)} ราย`}
                                sub="ที่มีข้อมูล" accent={C.amber} accentBg={C.amberL} />
                            <KpiCard icon={HeartPulse} label="อายุเฉลี่ย" value={`${kpiAvgAge} ปี`}
                                sub="เฉพาะที่มีข้อมูล" accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={Microscope} label="Pathogen พบ" value={`${pathogenData.length} ชนิด`}
                                sub="ยกเว้น No Growth" accent={C.purple} accentBg={C.purpleL} />
                        </>
                    )}
                </div>
            )}

            {/* Yearly trend (show only when "all") */}
            {!loading && s && selectedYear === "all" && (
                <YearlyTrendChart data={s.yearlyTrend} />
            )}

            {/* Charts grid */}
            {!loading && activeRows.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Site donut */}
                        <SiteDonut data={siteData} />

                        {/* Type of infection donut */}
                        <SectionCard title="Type of Infection" icon={ShieldAlert}>
                            <div className="flex justify-center">
                                <PieChart width={160} height={160}>
                                    <Pie data={deptData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                                        {deptData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                                </PieChart>
                            </div>
                            <ChartLegend items={deptData.map((d) => ({ label: d.name, color: d.color }))} />
                        </SectionCard>

                        {/* Dept bar */}
                        <SectionCard title="แผนกที่วินิจฉัย" icon={Activity}>
                            <HBarList data={deptCountData} colors={[C.red, C.blue, C.amber, C.teal]} />
                        </SectionCard>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pathogen */}
                        <SectionCard title="Pathogen ที่พบ (ยกเว้น No Growth)" icon={Microscope}>
                            {pathogenData.length > 0
                                ? <HBarList data={pathogenData} colors={PALETTE} />
                                : <p className="text-sm text-gray-400 text-center py-4">ไม่พบข้อมูล Pathogen ในช่วงที่เลือก</p>}
                        </SectionCard>

                        {/* Comorbidity */}
                        <SectionCard title="โรคประจำตัว (Comorbidity)" icon={HeartPulse}>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={comorbData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {comorbData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Age distribution */}
                        <SectionCard title={`กลุ่มอายุ (เฉลี่ย ${kpiAvgAge} ปี)`} icon={Users}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v: number) => [v + " ราย"]} {...tip} />
                                    <Bar dataKey="value" fill={C.blue} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>

                        {/* Zone */}
                        <SectionCard title="เขตที่อยู่อาศัย" icon={MapPin}>
                            <HBarList data={zoneData} colors={PALETTE} />
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* Patient Table */}
            {!loading && activeRows.length > 0 && <PatientTable rows={activeRows} />}

            {/* Upload */}
            <UploadDropzone onSuccess={fetchData} />
        </div>
    );
}