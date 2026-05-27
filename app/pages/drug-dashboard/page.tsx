"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
    Area, AreaChart,
} from "recharts";
import {
    RefreshCw, UploadCloud, CheckCircle2, XCircle, Info,
    Users, Activity, ShieldCheck, TrendingUp, AlertTriangle,
} from "lucide-react";
import type { DrugDashboardData, DrugDashboardSummary } from "@/app/api/drug-dashboard/route";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
    green: "#639922",
    greenL: "#EAF3DE",
    blue: "#378ADD",
    blueL: "#E6F1FB",
    amber: "#EF9F27",
    amberL: "#FAEEDA",
    red: "#E24B4A",
    redL: "#FCEBEB",
    teal: "#1D9E75",
    tealL: "#E1F5EE",
    coral: "#D85A30",
    purple: "#7F77DD",
    gray: "#888780",
    grayL: "#F1EFE8",
};

const COLOR_MAP: Record<string, string> = {
    เขียว: C.green, ส้ม: C.amber, แดง: C.red, เหลือง: "#f1c40f", ไม่ระบุ: C.gray,
};
const STATUS_COLORS = [C.blue, C.green, C.red, C.amber, C.purple];
const PROGRAM_COLORS = [C.green, C.blue, C.amber, C.teal, C.coral, C.purple];
const REFERRAL_COLORS = [C.blue, C.green, C.amber, C.coral, C.teal, C.red, C.purple, C.gray];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const pct = (n: number, t: number) => t > 0 ? `${((n / t) * 100).toFixed(1)}%` : "0%";

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
    icon: Icon, label, value, sub, accent, accentBg,
}: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; accent: string; accentBg: string;
}) {
    return (
        <motion.div
            className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentBg }}>
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

function HBarList({
    data, colors,
}: { data: [string, number][]; colors: string[] }) {
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div className="space-y-2">
            {data.map(([label, val], i) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 flex-shrink-0 text-right text-gray-500 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                        <motion.div
                            className="h-full rounded"
                            style={{ backgroundColor: colors[i % colors.length] }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(val / max) * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                        />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right font-semibold text-gray-700">{val}</span>
                </div>
            ))}
        </div>
    );
}

function CustomLegend({ items }: { items: { label: string; color: string; value?: number }[] }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {items.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs text-gray-500">{item.label}{item.value !== undefined ? `: ${item.value}` : ""}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Upload dropzone ──────────────────────────────────────────────────────────
function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const upload = useCallback(async (file: File) => {
        setUploading(true); setResult(null);
        const form = new FormData(); form.append("file", file);
        try {
            const res = await fetch("/api/drug-upload", { method: "POST", body: form, credentials: "include" });
            const json = await res.json();
            setResult({ ok: !!json.success, msg: json.message ?? json.error });
            if (json.success) setTimeout(onSuccess, 600);
        } catch { setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" }); }
        finally { setUploading(false); }
    }, [onSuccess]);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">อัปโหลดข้อมูล Excel</p>
                <span className="text-xs text-gray-400">drug-patients.xlsx</span>
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
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={24} className="text-green-600" /></motion.div>
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
                            <p className="text-xs text-gray-400">ไฟล์ Excel ผู้ป่วยยาเสพติด</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// ─── Dashboard charts ─────────────────────────────────────────────────────────
function DashboardCharts({ s }: { s: DrugDashboardSummary }) {
    const tooltipStyle = {
        contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" },
    };

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
        .sort(([, a], [, b]) => b - a) as [string, number][];

    const tambonData = Object.entries(s.byTambon)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8) as [string, number][];

    const ageData = Object.entries(s.byAgeGroup).map(([name, value]) => ({ name, value }));

    const v2Data = Object.entries(s.byV2Group).map(([name, value], i) => ({
        name, value, color: [C.green, C.amber, C.coral, C.red][i],
    }));

    const genderData = [
        { name: "ชาย", value: s.male, color: C.blue },
        { name: "หญิง", value: s.female, color: C.teal },
    ];

    return (
        <div className="space-y-4">
            {/* Monthly trend */}
            <SectionCard title="แนวโน้มผู้ป่วยรายเดือน" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={s.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tooltipStyle} formatter={(v: number) => [v + " ราย", "จำนวน"]} />
                        <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
                            fill="url(#monthGrad)" dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gender donut */}
                <SectionCard title="สัดส่วนเพศ" icon={Users}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={genderData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3}>
                                {genderData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
                        </PieChart>
                    </div>
                    <CustomLegend items={genderData.map((d) => ({ label: `${d.name} ${d.value}`, color: d.color }))} />
                </SectionCard>

                {/* Status donut */}
                <SectionCard title="สถานะการรักษา" icon={Activity}>
                    <div className="flex justify-center">
                        <PieChart width={160} height={160}>
                            <Pie data={statusData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={2}>
                                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
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
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
                        </PieChart>
                    </div>
                    <CustomLegend items={colorData.map((d) => ({ label: `${d.name} ${d.value}`, color: d.color }))} />
                </SectionCard>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Program bar */}
                <SectionCard title="ประเภทโปรแกรมบำบัด (HW / IMC / MP)" icon={Activity}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={programData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={60} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {programData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                {/* V2 score bar */}
                <SectionCard title="ระดับการติดยา (คะแนน V2)" icon={AlertTriangle}>
                    <div className="text-xs text-gray-400 mb-3">
                        เฉลี่ย <strong className="text-gray-700">{s.avgV2}</strong> pts · ต่ำสุด {s.minV2} · สูงสุด {s.maxV2}
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={v2Data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {v2Data.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Age bar */}
                <SectionCard title="กลุ่มอายุ" icon={Users}>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: number) => [v + " ราย"]} {...tooltipStyle} />
                            <Bar dataKey="value" fill={C.blue} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                {/* Tambon */}
                <SectionCard title="ตำบลที่พักอาศัย" icon={Activity}>
                    <HBarList data={tambonData} colors={[C.green, C.blue, C.amber, C.teal, C.coral, C.purple, C.gray, C.red]} />
                </SectionCard>

                {/* Referral */}
                <SectionCard title="ช่องทางการนำส่ง" icon={TrendingUp}>
                    <HBarList data={referralData} colors={REFERRAL_COLORS} />
                </SectionCard>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DrugDashboardPage() {
    const [data, setData] = useState<DrugDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [noFile, setNoFile] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null); setNoFile(false);
        try {
            const res = await fetch("/api/drug-dashboard", { credentials: "include" });
            if (res.status === 404) { setNoFile(true); setLoading(false); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const s = data?.summary;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-gray-800">
                        ผู้ป่วยยาเสพติด ปีงบประมาณ 2569
                        {s && <span className="ml-2 text-sm font-normal text-gray-400">· ทั้งหมด {s.total} ราย</span>}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        บ้านส่งเสริมสุขภาพตำบล · อ.พลับพลาชัย จ.บุรีรัมย์
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

            {/* No file notice */}
            {noFile && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
                    <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
                        <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel ข้อมูลผู้ป่วยยาเสพติดด้านล่าง</p>
                    </div>
                </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">เกิดข้อผิดพลาด: {error}</div>}

            {/* KPI Cards */}
            {(loading || s) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {loading ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
                    )) : s && (
                        <>
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(s.total)} ราย`}
                                sub={`ใหม่ ${s.newPatients} · เก่า ${s.oldPatients}`} accent={C.blue} accentBg={C.blueL} />
                            <KpiCard icon={Activity} label="กำลังบำบัด" value={`${fmt(s.inTreatment)} ราย`}
                                sub={`Retention ${s.retentionRate}%`} accent={C.green} accentBg={C.greenL} />
                            <KpiCard icon={CheckCircle2} label="treat ครบ / ติดตาม" value={`${fmt(s.treatComplete + s.followUp)} ราย`}
                                sub={`จำหน่าย ${s.discharged} · Dropout ${s.dropout}`} accent={C.amber} accentBg={C.amberL} />
                            <KpiCard icon={ShieldCheck} label="V2 เฉลี่ย" value={`${s.avgV2} pts`}
                                sub={`min ${s.minV2} · max ${s.maxV2}`} accent={C.teal} accentBg={C.tealL} />
                            <KpiCard icon={TrendingUp} label="อายุเฉลี่ย" value={`${s.avgAge} ปี`}
                                sub={`ชาย ${s.male} · หญิง ${s.female} ราย`} accent={C.purple} accentBg="#EEEDFE" />
                        </>
                    )}
                </div>
            )}

            {/* Charts */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}
            {!loading && s && <DashboardCharts s={s} />}

            {/* Upload */}
            <UploadDropzone onSuccess={fetchData} />
        </div>
    );
}