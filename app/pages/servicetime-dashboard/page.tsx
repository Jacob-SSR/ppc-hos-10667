"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, BarChart, Cell, LineChart,
} from "recharts";
import {
    Users, Clock, Timer, Target, Stethoscope, Pill, FlaskConical, Scan,
    UserCheck, Hourglass, Gauge, Layers, Download, AlertTriangle, Settings, X,
    Calendar, RotateCcw, Search, ClipboardList, AlarmClockCheck, TrendingUp,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { KpiCard, SectionCard, LiveBadge, ConnectionStatus, RefreshButton } from "@/app/components/dashboard/live";
import { fmtDate, getBangkokToday, toThaiDateLabel, fiscalYearRange, recentFiscalYears, getCurrentFiscalYear, getCurrentCalendarYear } from "@/lib/thaiDate";
import type {
    ServiceTimeData, ServiceScope, VisitType, StageStat, AncillaryStat,
    DepartmentRow, ServiceShift, StageColumn, PersonVisit,
    HourlyStagePoint, WaitBucketRow,
} from "@/lib/servicetime.types";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
    green: "#2f9e6a", greenL: "#e4f4ec",
    blue: "#378ADD", blueL: "#e6f1fb",
    amber: "#ef9f27", amberL: "#faeeda",
    red: "#e24b4a", redL: "#fcebeb",
    teal: "#1d9e75", tealL: "#e1f5ee",
    purple: "#7f77dd", purpleL: "#ecebf9",
    gray: "#888780", grayL: "#f1efe8",
};
const fmt = (n: number) => n.toLocaleString("th-TH");
const mins = (v: number | null) => (v == null ? "-" : `${v} นาที`);
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

// สีตาม “เฉลี่ยเทียบเป้า” (ยิ่งน้อยยิ่งดี)
function timeColor(avg: number | null, target: number | null): { accent: string; bg: string } {
    if (avg == null || target == null) return { accent: C.gray, bg: C.grayL };
    if (avg <= target) return { accent: C.green, bg: C.greenL };
    if (avg <= target * 1.5) return { accent: C.amber, bg: C.amberL };
    return { accent: C.red, bg: C.redL };
}
// สีตาม “%ผ่านเกณฑ์” (ยิ่งมากยิ่งดี) — goal = เป้าหมาย % (ปรับได้)
function pctColor(pct: number | null, goal = 80): { accent: string; bg: string } {
    if (pct == null) return { accent: C.gray, bg: C.grayL };
    if (pct >= goal) return { accent: C.green, bg: C.greenL };
    if (pct >= goal - 20) return { accent: C.amber, bg: C.amberL };
    return { accent: C.red, bg: C.redL };
}

type Preset = "month" | "7d" | "fiscal" | "calendar" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "month", label: "เดือนนี้" },
    { key: "7d", label: "7 วัน" },
    { key: "fiscal", label: "ปีงบ" },
    { key: "calendar", label: "ปีปฏิทิน" },
    { key: "custom", label: "กำหนดเอง" },
];
const FISCAL_YEARS = recentFiscalYears(5); // [2569, 2568, 2567, 2566, 2565]
const CALENDAR_YEARS = Array.from({ length: 5 }, (_, i) => getCurrentCalendarYear() - i);

// ช่วงปีงบ — cap ปลายทางไม่ให้เกินวันนี้ (ปีงบปัจจุบัน = ยอดสะสมถึงปัจจุบัน)
function fiscalRange(beYear: number): { start: Date; end: Date } {
    const { start, end } = fiscalYearRange(beYear);
    const today = getBangkokToday();
    return { start, end: end > today ? today : end };
}
// ช่วงปีปฏิทิน (พ.ศ.) → 1 ม.ค. – 31 ธ.ค. · cap ปลายทางไม่ให้เกินวันนี้
function calendarRange(beYear: number): { start: Date; end: Date } {
    const ce = beYear - 543;
    const today = getBangkokToday();
    const end = new Date(ce, 11, 31);
    return { start: new Date(ce, 0, 1), end: end > today ? today : end };
}
const SCOPES: { key: ServiceScope; label: string }[] = [
    { key: "opd", label: "OPD" },
    { key: "er", label: "ER" },
    { key: "all", label: "OPD+ER" },
];
const VISIT_TYPES: { key: VisitType; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "walkin", label: "Walk-in" },
    { key: "appt", label: "นัด" },
];
const SHIFTS: { key: ServiceShift; label: string; title?: string }[] = [
    { key: "all", label: "ทั้งวัน" },
    { key: "morning", label: "เช้า", title: "08:30–16:30" },
    { key: "evening", label: "บ่าย", title: "16:30–00:30" },
    { key: "night", label: "ดึก", title: "00:30–08:30" },
];

function presetRange(p: Preset): { start: Date; end: Date } {
    const today = getBangkokToday();
    if (p === "7d") { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: s, end: today }; }
    // month
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
}

// ─── Segmented control ────────────────────────────────────────────────────────
function Segmented<T extends string>({
    value, options, onChange,
}: { value: T; options: { key: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {options.map((o) => (
                <button
                    key={o.key}
                    onClick={() => onChange(o.key)}
                    title={o.title}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${value === o.key ? "bg-green-700 text-white font-semibold" : "text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// ─── ป้ายกำกับกลุ่มตัวกรอง (label เล็ก + control) ───────────────────────────────
function Field({
    label, icon: Icon, children,
}: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {Icon && <Icon size={11} />}
                {label}
            </span>
            {children}
        </div>
    );
}

// ─── แถวขั้นตอน (stage) ───────────────────────────────────────────────────────
function StageRow({ s }: { s: StageStat }) {
    const { accent } = timeColor(s.stat.avg, s.target);
    const target = s.target;
    // ความยาวแท่ง = avg เทียบกับ max(target*2, avg)
    const scale = target ? Math.max(target * 2, s.stat.avg ?? 0) : (s.stat.max ?? s.stat.avg ?? 1);
    const barPct = s.stat.avg != null && scale ? Math.min((s.stat.avg / scale) * 100, 100) : 0;
    const targetPct = target && scale ? Math.min((target / scale) * 100, 100) : null;

    return (
        <div className="py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-700">{s.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
                    {mins(s.stat.avg)}
                    <span className="text-[11px] font-normal text-gray-400"> (มัธยฐาน {mins(s.stat.median)})</span>
                </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: accent }} />
                {targetPct != null && (
                    <div
                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-gray-500"
                        style={{ left: `${targetPct}%` }}
                        title={`เป้า ≤ ${target} นาที`}
                    />
                )}
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                <span>P90 {mins(s.stat.p90)} · n={fmt(s.stat.count)}</span>
                {s.withinTargetPct != null && (
                    <span style={{ color: accent }}>ผ่านเกณฑ์ {s.withinTargetPct}%</span>
                )}
            </div>
        </div>
    );
}

// ─── การ์ด Lab / X-ray ───────────────────────────────────────────────────────
function AncillaryCard({
    title, icon, data,
}: { title: string; icon: React.ElementType; data: AncillaryStat }) {
    const { accent } = pctColor(data.withinTargetPct);
    return (
        <SectionCard title={title} icon={icon} titleColor="#1a5233">
            <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                    { label: "รอ (สั่ง→รับ/ตรวจ)", v: data.wait.avg },
                    { label: "ดำเนินการ", v: data.process.avg },
                    { label: "รวม (สั่ง→ผล)", v: data.total.avg },
                ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-lg font-extrabold text-gray-800 tabular-nums">{mins(x.v)}</p>
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{x.label}</p>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">visit ที่มีรายการ: {fmt(data.itemVisits)}</span>
                {data.withinTargetPct != null && (
                    <span className="font-bold" style={{ color: accent }}>
                        ≤ {data.target} นาที = {data.withinTargetPct}%
                    </span>
                )}
            </div>
        </SectionCard>
    );
}

// ─── metadata ราย stage (สี + ป้ายสั้น) — คีย์ตรงกับ STAGE_DEFS ฝั่ง server ──────
const STAGE_META: Record<string, { short: string; color: string }> = {
    wait_screening: { short: "รอคัดกรอง", color: "#3b82f6" },
    screening: { short: "คัดกรอง", color: "#6366f1" },
    wait_doctor: { short: "รอตรวจ", color: "#8b5cf6" },
    consult: { short: "ตรวจ", color: "#a855f7" },
    lab_wait: { short: "รอแลป", color: "#059669" },
    lab_process: { short: "LAB", color: "#10b981" },
    xray_wait: { short: "รอ X-ray", color: "#0d9488" },
    xray_process: { short: "X-ray", color: "#2dd4bf" },
    wait_pharmacy: { short: "รอรับยา", color: "#f59e0b" },
};
const stageColor = (key: string) => STAGE_META[key]?.color ?? C.gray;
const stageShort = (key: string, fallback: string) => STAGE_META[key]?.short ?? fallback;
// นาทีของวัน → "HH:MM"
const toHM = (m: number | null) =>
    m == null ? "-" : `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ─── ตารางแยกรายคลินิก × รายขั้นตอน ───────────────────────────────────────────
function ClinicStageTable({
    rows, stages, totalTarget, pctGoal, selected, onSelect,
}: {
    rows: DepartmentRow[]; stages: StageColumn[]; totalTarget: number | null;
    pctGoal: number; selected: string; onSelect: (clinic: string) => void;
}) {
    const cellOf = (r: DepartmentRow, key: string) =>
        r.stages.find((s) => s.key === key)?.avg ?? null;

    return (
        <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white">
                    <tr className="text-gray-400 border-b-2 border-gray-100 text-left whitespace-nowrap">
                        <th className="py-2 pr-2 font-medium sticky left-0 bg-white">คลินิก</th>
                        <th className="py-2 px-2 font-medium text-right">visit</th>
                        {stages.map((s) => (
                            <th key={s.key} className="py-2 px-2 font-medium text-right" title={s.label}>
                                <span
                                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                                    style={{ backgroundColor: stageColor(s.key) }}
                                />
                                {stageShort(s.key, s.label)}
                            </th>
                        ))}
                        <th className="py-2 px-2 font-medium text-right">รวม (มัธยฐาน)</th>
                        <th className="py-2 px-2 font-medium text-right">≤ {totalTarget} นาที</th>
                        <th className="py-2 pl-2 font-medium">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const st = pctColor(r.withinTargetPct, pctGoal);
                        const label =
                            r.withinTargetPct == null ? "-"
                                : r.withinTargetPct >= pctGoal ? "ปกติ"
                                    : r.withinTargetPct >= pctGoal - 20 ? "เฝ้าระวัง"
                                        : "รอนาน";
                        const isSel = selected === r.department;
                        return (
                            <tr
                                key={r.department}
                                onClick={() => onSelect(isSel ? "all" : r.department)}
                                className={`border-b border-gray-50 cursor-pointer ${isSel ? "bg-green-50" : "hover:bg-gray-50/60"}`}
                                title={isSel ? "คลิกเพื่อยกเลิกตัวกรองคลินิก" : "คลิกเพื่อกรองเฉพาะคลินิกนี้"}
                            >
                                <td className={`py-1.5 pr-2 truncate max-w-[150px] sticky left-0 ${isSel ? "bg-green-50 font-semibold text-green-800" : "bg-white text-gray-700"}`} title={r.department}>
                                    {r.department}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{fmt(r.visits)}</td>
                                {stages.map((s) => {
                                    const v = cellOf(r, s.key);
                                    const isBottleneck = r.bottleneckKey === s.key;
                                    const { accent } = timeColor(v, s.target);
                                    return (
                                        <td
                                            key={s.key}
                                            className="py-1.5 px-2 text-right tabular-nums font-medium"
                                            style={{
                                                color: accent,
                                                backgroundColor: isBottleneck ? "#fdecec" : undefined,
                                                borderRadius: isBottleneck ? 6 : undefined,
                                            }}
                                            title={isBottleneck ? "จุดคอขวดของคลินิกนี้" : undefined}
                                        >
                                            {v == null ? "-" : v}
                                        </td>
                                    );
                                })}
                                <td className="py-1.5 px-2 text-right tabular-nums font-bold text-gray-800">{mins(r.medianTotal)}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums font-semibold" style={{ color: st.accent }}>
                                    {r.withinTargetPct == null ? "-" : `${r.withinTargetPct}%`}
                                </td>
                                <td className="py-1.5 pl-2">
                                    <span
                                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                        style={{ backgroundColor: st.accent }}
                                    >
                                        {label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── กราฟองค์ประกอบเวลา แยกรายขั้นตอน (stacked) ต่อคลินิก ─────────────────────
function ClinicStackChart({ rows, stages }: { rows: DepartmentRow[]; stages: StageStat[] }) {
    const top = rows.slice(0, 12);
    const data = top.map((r) => {
        const o: Record<string, string | number> = { department: r.department };
        for (const s of stages) o[s.key] = r.stages.find((x) => x.key === s.key)?.avg ?? 0;
        return o;
    });
    const h = Math.max(220, top.length * 30 + 60);
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit=" นาที" />
                <YAxis
                    type="category" dataKey="department" width={110}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
                />
                <Tooltip
                    formatter={(v, n) => [`${v} นาที`, stageShort(String(n), String(n))]}
                    {...tip}
                />
                {stages.map((s) => (
                    <Bar key={s.key} dataKey={s.key} stackId="a" fill={stageColor(s.key)} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── กราฟเวลาเฉลี่ยแต่ละขั้นตอน (แนวนอน) ──────────────────────────────────────
function StageAvgBarChart({ stages }: { stages: StageStat[] }) {
    const data = stages.map((s, i) => ({
        idx: i + 1,
        name: `${i + 1}.${stageShort(s.key, s.label)}`,
        key: s.key,
        avg: s.stat.avg ?? 0,
    }));
    const h = Math.max(220, data.length * 34 + 40);
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} นาที`, "เฉลี่ย"]} {...tip} />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {data.map((d) => <Cell key={d.key} fill={stageColor(d.key)} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── กราฟจำนวนผู้ป่วยรายชั่วโมง แยกตามขั้นตอน (เส้น + toggle) ───────────────────
function HourlyStageLineChart({ data, stages }: { data: HourlyStagePoint[]; stages: StageColumn[] }) {
    const [visible, setVisible] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(stages.map((s) => [s.key, true])),
    );
    const allOn = stages.every((s) => visible[s.key]);
    const allOff = stages.every((s) => !visible[s.key]);
    const setAll = (v: boolean) => setVisible(Object.fromEntries(stages.map((s) => [s.key, v])));
    const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));

    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2 text-[11px]">
                <button
                    onClick={() => setAll(true)}
                    className={`inline-flex items-center gap-1 font-semibold ${allOn ? "text-green-700" : "text-gray-400 hover:text-gray-600"}`}
                >
                    ✓ ทั้งหมด
                </button>
                <button
                    onClick={() => setAll(false)}
                    className={`inline-flex items-center gap-1 font-semibold ${allOff ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}
                >
                    ✕ ซ่อนทั้งหมด
                </button>
                {stages.map((s, i) => (
                    <button
                        key={s.key}
                        onClick={() => toggle(s.key)}
                        className={`inline-flex items-center gap-1.5 ${visible[s.key] ? "text-gray-600" : "text-gray-300"}`}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: visible[s.key] ? stageColor(s.key) : "#e5e7eb" }}
                        />
                        {i + 1}.{s.short}
                    </button>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(h) => `${h}:00 นาที`} {...tip} />
                    {stages.filter((s) => visible[s.key]).map((s) => (
                        <Line
                            key={s.key} type="monotone" dataKey={s.key} name={s.short}
                            stroke={stageColor(s.key)} strokeWidth={2} dot={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── กราฟจำนวนคนตามช่วงเวลารอของแต่ละขั้นตอน (แท่งซ้อนแนวนอน) ───────────────────
const BUCKET_COLORS = ["#2f9e6a", "#84cc16", "#ef9f27", "#f2711c", "#e24b4a"];
function WaitBucketChart({ rows }: { rows: WaitBucketRow[] }) {
    const [visible, setVisible] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(rows.map((r) => [r.key, true])),
    );
    const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));
    const shown = rows.filter((r) => visible[r.key]);
    const bucketLabels = rows[0]?.buckets.map((b) => b.label) ?? [];
    const data = shown.map((r) => {
        const o: Record<string, string | number> = { name: `${rows.findIndex((x) => x.key === r.key) + 1}.${stageShort(r.key, r.label)}` };
        r.buckets.forEach((b) => { o[b.label] = b.count; });
        return o;
    });
    const h = Math.max(220, data.length * 34 + 50);
    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2 text-[11px]">
                {rows.map((r, i) => (
                    <button
                        key={r.key}
                        onClick={() => toggle(r.key)}
                        className={`inline-flex items-center gap-1.5 ${visible[r.key] ? "text-gray-600 font-medium" : "text-gray-300"}`}
                        title="คลิกเพื่อเปิด/ปิดแถวนี้"
                    >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: visible[r.key] ? stageColor(r.key) : "#e5e7eb" }} />
                        {i + 1}.{stageShort(r.key, r.label)}
                    </button>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={h}>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [`${fmt(v as number)} คน`, n]} {...tip} />
                    {bucketLabels.map((label, i) => (
                        <Bar key={label} dataKey={label} stackId="wait" fill={BUCKET_COLORS[i] ?? C.gray} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
                {bucketLabels.map((label, i) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[i] ?? C.gray }} />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── ตารางข้อมูลรายบุคคล (ตามตัวกรอง) ─────────────────────────────────────────
function PersonTable({
    visits, columns, total, truncated,
}: { visits: PersonVisit[]; columns: StageColumn[]; total: number; truncated: boolean }) {
    const [q, setQ] = useState("");

    const toDMY = (iso: string) => {
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${Number(y) + 543}`; // พ.ศ. — เช่น 05/07/2569
    };
    const filtered = useMemo(() => {
        const s = q.trim();
        if (!s) return visits;
        return visits.filter((v) => v.vn.includes(s) || v.hn.includes(s));
    }, [visits, q]);

    const exportPersons = () => {
        const data = filtered.map((v) => {
            const o: Record<string, unknown> = {
                VN: v.vn, HN: v.hn, วันที่: toDMY(v.date), คลินิก: v.department, มาถึง: toHM(v.arrivalMinute),
            };
            for (const c of columns) o[`${c.short} (นาที)`] = v.values[c.key] ?? "";
            o["รวม (นาที)"] = v.total ?? "";
            return o;
        });
        exportToExcel(data, {
            sheetName: "รายบุคคล",
            filePrefix: "servicetime_รายบุคคล",
            dateKeys: [],
        });
    };

    return (
        <SectionCard
            title="ข้อมูลรายบุคคล (ตามตัวกรอง วันที่ / เวร / คลินิก)"
            icon={ClipboardList} titleColor="#1a5233" className="mb-4"
        >
            <div className="flex flex-wrap items-center gap-2 -mt-1 mb-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="ค้นหา VN / HN"
                        className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                    />
                </div>
                <button
                    onClick={exportPersons}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors"
                >
                    <Download size={13} /> Excel
                </button>
                <span className="text-xs text-gray-500">
                    {fmt(filtered.length)}{q ? ` / ${fmt(visits.length)}` : ""} ราย
                    {truncated && <span className="text-amber-600"> · แสดง {fmt(visits.length)} จาก {fmt(total)} (ปรับตัวกรองให้แคบลงเพื่อดูครบ)</span>}
                </span>
            </div>

            <div className="overflow-auto max-h-[520px]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr className="text-gray-400 border-b-2 border-gray-100 text-left whitespace-nowrap">
                            <th className="py-2 pr-2 font-medium sticky left-0 bg-white z-20">VN</th>
                            <th className="py-2 px-2 font-medium">HN</th>
                            <th className="py-2 px-2 font-medium">วันที่</th>
                            <th className="py-2 px-2 font-medium">คลินิก</th>
                            <th className="py-2 px-2 font-medium text-right">มาถึง</th>
                            {columns.map((c) => (
                                <th key={c.key} className="py-2 px-2 font-medium text-right" title={c.label}>
                                    <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: stageColor(c.key) }} />
                                    {c.short}
                                </th>
                            ))}
                            <th className="py-2 pl-2 pr-3 font-medium text-right sticky right-0 bg-green-50 text-green-800 z-20 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((v) => (
                            <tr key={v.vn} className="border-b border-gray-50 hover:bg-gray-50/60">
                                <td className="py-1.5 pr-2 tabular-nums text-gray-700 sticky left-0 bg-white z-10">{v.vn}</td>
                                <td className="py-1.5 px-2 tabular-nums text-gray-500">{v.hn || "-"}</td>
                                <td className="py-1.5 px-2 tabular-nums text-gray-600">{toDMY(v.date)}</td>
                                <td className="py-1.5 px-2 text-gray-600 truncate max-w-[130px]" title={v.department}>{v.department}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-gray-500">{toHM(v.arrivalMinute)}</td>
                                {columns.map((c) => (
                                    <td key={c.key} className="py-1.5 px-2 text-right tabular-nums text-gray-700">
                                        {v.values[c.key] == null ? "–" : Math.round(v.values[c.key]!)}
                                    </td>
                                ))}
                                <td className="py-1.5 pl-2 pr-3 text-right tabular-nums font-bold text-green-800 sticky right-0 bg-green-50 z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                                    {v.total == null ? "–" : Math.round(v.total)}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={columns.length + 6} className="py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}

export default function ServiceTimeDashboardPage() {
    const [preset, setPreset] = useState<Preset>("month");
    const [fiscalYear, setFiscalYear] = useState<number>(() => getCurrentFiscalYear());
    const [calendarYear, setCalendarYear] = useState<number>(() => getCurrentCalendarYear());
    const [customStart, setCustomStart] = useState<Date>(() => presetRange("month").start);
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());
    const [scope, setScope] = useState<ServiceScope>("opd");
    const [visitType, setVisitType] = useState<VisitType>("all");
    const [shift, setShift] = useState<ServiceShift>("all");
    const [clinic, setClinic] = useState<string>("all");

    // เป้าหมาย (เก็บใน localStorage) — targetTotal ส่งไป server, pctGoal ใช้ฝั่ง client (สี/สถานะ)
    const DEFAULT_TARGETS = { total: 90, pct: 80 };
    const [targetTotal, setTargetTotal] = useState<number>(DEFAULT_TARGETS.total);
    const [pctGoal, setPctGoal] = useState<number>(DEFAULT_TARGETS.pct);
    const [showSettings, setShowSettings] = useState(false);
    const [draftTotal, setDraftTotal] = useState<string>(String(DEFAULT_TARGETS.total));
    const [draftPct, setDraftPct] = useState<string>(String(DEFAULT_TARGETS.pct));

    useEffect(() => {
        try {
            const raw = localStorage.getItem("servicetimeTargets");
            if (raw) {
                const v = JSON.parse(raw);
                if (v?.total) setTargetTotal(v.total);
                if (v?.pct) setPctGoal(v.pct);
            }
        } catch { /* ignore */ }
    }, []);

    const openSettings = () => {
        setDraftTotal(String(targetTotal));
        setDraftPct(String(pctGoal));
        setShowSettings(true);
    };
    const saveSettings = () => {
        const t = Math.min(720, Math.max(10, Number(draftTotal) || DEFAULT_TARGETS.total));
        const p = Math.min(100, Math.max(1, Number(draftPct) || DEFAULT_TARGETS.pct));
        setTargetTotal(t);
        setPctGoal(p);
        try { localStorage.setItem("servicetimeTargets", JSON.stringify({ total: t, pct: p })); } catch { /* ignore */ }
        setShowSettings(false);
    };

    const [data, setData] = useState<ServiceTimeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { start, end } =
            preset === "custom" ? { start: customStart, end: customEnd }
                : preset === "fiscal" ? fiscalRange(fiscalYear)
                    : preset === "calendar" ? calendarRange(calendarYear)
                        : presetRange(preset);
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({
                start: fmtDate(start), end: fmtDate(end), scope, visitType,
                shift, clinic, target: String(targetTotal),
            });
            const res = await fetch(`/api/servicetime?${qs}`, { credentials: "include" });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            setData((await res.json()) as ServiceTimeData);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [preset, customStart, customEnd, fiscalYear, calendarYear, scope, visitType, shift, clinic, targetTotal]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const summary = data?.summary;
    const total = summary?.total;

    const kpis = useMemo(() => {
        if (!data || !summary || !total) return [];
        const waitDoc = data.stages.find((s) => s.key === "wait_doctor");
        const waitPh = data.stages.find((s) => s.key === "wait_pharmacy");
        return [
            { icon: Users, label: "จำนวน Visit", value: fmt(summary.totalVisits), sub: `ครบ flow ${fmt(summary.completeFlowVisits)}`, ...({ accent: C.blue, bg: C.blueL }) },
            { icon: Clock, label: "ระยะเวลารวมเฉลี่ย", value: mins(total.stat.avg), sub: `มัธยฐาน ${mins(total.stat.median)} · P90 ${mins(total.stat.p90)}`, ...timeColor(total.stat.avg, total.target) },
            { icon: Target, label: `ผ่านเกณฑ์ ≤ ${total.target} นาที`, value: total.withinTargetPct != null ? `${total.withinTargetPct}%` : "-", sub: `เป้า ≥ ${pctGoal}% ของ visit ครบ flow`, ...pctColor(total.withinTargetPct, pctGoal) },
            { icon: Stethoscope, label: "รอตรวจเฉลี่ย", value: mins(waitDoc?.stat.avg ?? null), sub: `เป้า ≤ ${waitDoc?.target} นาที`, ...timeColor(waitDoc?.stat.avg ?? null, waitDoc?.target ?? null) },
            { icon: Pill, label: "รอรับยาเฉลี่ย", value: mins(waitPh?.stat.avg ?? null), sub: `เป้า ≤ ${waitPh?.target} นาที`, ...timeColor(waitPh?.stat.avg ?? null, waitPh?.target ?? null) },
            { icon: FlaskConical, label: "Lab TAT เฉลี่ย", value: mins(data.lab.total.avg), sub: `≤ ${data.lab.target} นาที = ${data.lab.withinTargetPct ?? "-"}%`, ...timeColor(data.lab.total.avg, data.lab.target) },
        ];
    }, [data, summary, total, pctGoal]);

    // การ์ดสรุปหัวเรื่อง (ผู้ป่วย OPD / เวลารวมมัธยฐาน / %เสร็จภายใน 120 นาที / จุดคอขวด)
    const headlineKpis = useMemo(() => {
        if (!data || !summary || !total) return [];
        const within120 = pctColor(summary.within120Pct, 80);
        return [
            {
                icon: scope === "opd" ? Users : UserCheck,
                label: scope === "er" ? "ผู้ป่วย ER" : scope === "all" ? "ผู้ป่วย OPD+ER" : "ผู้ป่วย OPD",
                value: fmt(summary.totalVisits),
                sub: "ราย",
                accent: C.blue, bg: C.blueL,
            },
            {
                icon: Clock,
                label: "เวลารวมทั้ง flow (มัธยฐาน)",
                value: total.stat.median != null ? String(total.stat.median) : "-",
                sub: "นาที (ยื่นบัตร → การเงิน)",
                ...timeColor(total.stat.median, total.target),
            },
            {
                icon: AlarmClockCheck,
                label: "เสร็จภายใน 120 นาที",
                value: summary.within120Pct != null ? `${summary.within120Pct}%` : "-",
                sub: "เป้าหมาย ≥ 80%",
                ...within120,
            },
            {
                icon: AlertTriangle,
                label: "จุดคอขวด (รอนานสุด)",
                value: summary.bottleneckLabel ?? "-",
                sub: `เฉพาะขั้นตอน "รอ"`,
                accent: C.red, bg: C.redL,
            },
        ];
    }, [data, summary, total, scope]);

    const rangeLabel = data ? toThaiDateLabel(data.start, data.end) : "";

    const exportClinics = useCallback(() => {
        if (!data) return;
        const rows = data.byDepartment.map((r) => {
            const o: Record<string, unknown> = {
                คลินิก: r.department,
                visit: r.visits,
                ครบflow: r.completeFlowVisits,
            };
            for (const s of data.stageColumns) {
                o[`${stageShort(s.key, s.label)} (นาที)`] =
                    r.stages.find((x) => x.key === s.key)?.avg ?? "";
            }
            o["รวมเฉลี่ย (นาที)"] = r.avgTotal ?? "";
            o["รวมมัธยฐาน (นาที)"] = r.medianTotal ?? "";
            o["%ผ่านเกณฑ์"] = r.withinTargetPct ?? "";
            o["จุดคอขวด"] = r.bottleneckKey
                ? stageShort(r.bottleneckKey, r.bottleneckKey)
                : "";
            return o;
        });
        exportToExcel(rows, {
            sheetName: "แยกรายคลินิก",
            filePrefix: `servicetime_รายคลินิก_${data.start}_${data.end}`,
            dateKeys: [],
        });
    }, [data]);

    const filtersActive =
        clinic !== "all" || shift !== "all" || scope !== "opd" || visitType !== "all";
    const resetFilters = () => {
        setClinic("all"); setShift("all"); setScope("opd"); setVisitType("all");
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Gauge size={22} className="text-green-700" />
                        <h1 className="text-xl md:text-2xl font-extrabold text-gray-800">
                            ระยะเวลารอคอย / ให้บริการ OPD
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        ตัวชี้วัด Service Time (R9) · {rangeLabel || "—"}
                        {clinic !== "all" && <span className="text-green-700 font-semibold"> · คลินิก: {clinic}</span>}
                        {shift !== "all" && <span className="text-gray-500"> · {SHIFTS.find((s) => s.key === shift)?.label}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ConnectionStatus error={!!error} connected={!error && !!data} />
                    <RefreshButton loading={loading} onClick={fetchData} />
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3.5 mb-5">
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                    <Field label="ช่วงวันที่" icon={Calendar}>
                        <div className="flex items-center gap-2">
                            <Segmented value={preset} options={PRESETS} onChange={setPreset} />
                            {preset === "fiscal" && (
                                <select
                                    value={fiscalYear}
                                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                    title="เลือกปีงบประมาณ"
                                >
                                    {FISCAL_YEARS.map((y) => (
                                        <option key={y} value={y}>ปีงบ {y}</option>
                                    ))}
                                </select>
                            )}
                            {preset === "calendar" && (
                                <select
                                    value={calendarYear}
                                    onChange={(e) => setCalendarYear(Number(e.target.value))}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                                    title="เลือกปีปฏิทิน"
                                >
                                    {CALENDAR_YEARS.map((y) => (
                                        <option key={y} value={y}>ปี {y}</option>
                                    ))}
                                </select>
                            )}
                            {preset === "custom" && (
                                <div className="flex items-center gap-2">
                                    <DatePicker
                                        selected={customStart}
                                        onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        customInput={<ThaiDateInput />}
                                    />
                                    <span className="text-gray-400">–</span>
                                    <DatePicker
                                        selected={customEnd}
                                        onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        customInput={<ThaiDateInput />}
                                    />
                                </div>
                            )}
                        </div>
                    </Field>

                    <Field label="คลินิก" icon={Stethoscope}>
                        <select
                            value={clinic}
                            onChange={(e) => setClinic(e.target.value)}
                            disabled={!data || data.clinics.length === 0}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed min-w-[140px]"
                            title="เลือกคลินิก"
                        >
                            <option value="all">ทุกคลินิก</option>
                            {data?.clinics.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="เวร" icon={Clock}>
                        <Segmented value={shift} options={SHIFTS} onChange={setShift} />
                    </Field>

                    <Field label="กลุ่มบริการ">
                        <Segmented value={scope} options={SCOPES} onChange={setScope} />
                    </Field>

                    <Field label="ประเภทการมา">
                        <Segmented value={visitType} options={VISIT_TYPES} onChange={setVisitType} />
                    </Field>

                    <div className="ml-auto flex items-center gap-2 self-end">
                        {filtersActive && (
                            <button
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                title="ล้างตัวกรองทั้งหมด"
                            >
                                <RotateCcw size={13} /> ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            onClick={openSettings}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                            title="ตั้งค่าเป้าหมาย"
                        >
                            <Settings size={15} /> เป้าหมาย
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm p-4 mb-4">
                    โหลดข้อมูลไม่สำเร็จ: {error}
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : data ? (
                <>
                    {/* การ์ดสรุปหัวเรื่อง */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        {headlineKpis.map((k, i) => (
                            <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} bg={k.bg} />
                        ))}
                    </div>

                    {/* KPI */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        {kpis.map((k, i) => (
                            <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} bg={k.bg} />
                        ))}
                    </div>

                    {/* visit type breakdown chips */}
                    <div className="flex flex-wrap gap-2 mb-5 text-xs">
                        {[
                            { icon: UserCheck, label: "นัด", v: summary!.appointmentVisits, color: C.teal },
                            { icon: Users, label: "Walk-in", v: summary!.walkinVisits, color: C.blue },
                        ].map((c) => (
                            <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1">
                                <c.icon size={13} style={{ color: c.color }} />
                                <span className="text-gray-500">{c.label}</span>
                                <span className="font-bold tabular-nums text-gray-800">{fmt(c.v)}</span>
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* เวลาเฉลี่ยแต่ละขั้นตอน (แนวนอน) */}
                        <SectionCard
                            title={`เวลาเฉลี่ยแต่ละขั้นตอน 1-${data.stageColumns.length} (นาที)`}
                            icon={Hourglass} titleColor="#1a5233"
                        >
                            <StageAvgBarChart stages={data.allStages} />
                        </SectionCard>

                        {/* จำนวนผู้ป่วยรายชั่วโมง แยกตามขั้นตอน */}
                        <SectionCard title="จำนวนผู้ป่วยรายชั่วโมง แยกตามขั้นตอน" icon={TrendingUp} titleColor="#1a5233">
                            <HourlyStageLineChart data={data.hourlyStages} stages={data.stageColumns} />
                        </SectionCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* จำนวนคนตามช่วงเวลารอของแต่ละขั้นตอน */}
                        <SectionCard
                            title="จำนวนคนตามช่วงเวลารอของแต่ละขั้นตอน"
                            icon={Layers} titleColor="#1a5233"
                        >
                            <p className="text-[11px] text-gray-400 -mt-1 mb-2">
                                เขียว = รอสั้น → แดง = รอนาน · คลิกชื่อขั้นตอนด้านบนเพื่อเปิด/ปิดแถว
                            </p>
                            <WaitBucketChart rows={data.waitBuckets} />
                        </SectionCard>

                        {/* ภาพรวมรายชั่วโมง: ผู้ป่วยมาถึง และเวลารวมเฉลี่ย */}
                        <SectionCard title="ภาพรวมรายชั่วโมง: ผู้ป่วยมาถึง และเวลารวมเฉลี่ย" icon={Clock} titleColor="#1a5233">
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={data.hourlyOverview} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}:00`} />
                                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip
                                        labelFormatter={(h) => `${h}:00 นาที`}
                                        formatter={(v, n) => [n === "visits" ? `${fmt(v as number)} ราย` : `${v} นาที`, n === "visits" ? "ผู้ป่วยมาถึง" : "เวลารวมเฉลี่ย"]}
                                        {...tip}
                                    />
                                    <Bar yAxisId="l" dataKey="visits" fill={C.blueL} radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="r" type="monotone" dataKey="avgTotal" stroke={C.red} strokeWidth={2.5} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </SectionCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* Stage breakdown */}
                        <SectionCard title="ระยะเวลาแต่ละขั้นตอน (เฉลี่ย · เส้น = เป้าหมาย)" icon={Hourglass} titleColor="#1a5233">
                            <div>
                                {data.stages.map((s) => <StageRow key={s.key} s={s} />)}
                                <div className="mt-2 pt-2 border-t-2 border-gray-200">
                                    {total && <StageRow s={total} />}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Distribution */}
                        <SectionCard title="การกระจายระยะเวลารวม (นาที)" icon={Timer} titleColor="#1a5233">
                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart data={data.distribution} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip formatter={(v) => [`${fmt(v as number)} visit`, ""]} {...tip} />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                        {data.distribution.map((b, i) => {
                                            const good = ["≤30", "31-60", "61-90"].includes(b.label);
                                            return <Cell key={i} fill={good ? C.green : i === 3 ? C.amber : C.red} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="text-[11px] text-gray-400 mt-1">เขียว = ≤ เป้า {data.targetTotal} นาที · ส้ม/แดง = เกินเป้า</p>
                        </SectionCard>
                    </div>

                    {/* Trend */}
                    <SectionCard title="แนวโน้มรายวัน — จำนวน visit และเวลารวมเฉลี่ย" icon={Clock} titleColor="#1a5233" className="mb-4">
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip
                                    formatter={(v, n) => [n === "visits" ? `${fmt(v as number)} visit` : `${v} นาที`, n === "visits" ? "จำนวน" : "เวลารวมเฉลี่ย"]}
                                    {...tip}
                                />
                                <Bar yAxisId="l" dataKey="visits" fill={C.blueL} radius={[4, 4, 0, 0]} />
                                <Line yAxisId="r" type="monotone" dataKey="avgTotal" stroke={C.green} strokeWidth={2.5} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </SectionCard>

                    {/* แยกรายคลินิก × รายขั้นตอน */}
                    <SectionCard
                        title="สรุปแยกรายคลินิก — เวลาเฉลี่ยรายขั้นตอน (นาที) · เรียงจากรอนานสุด · จุดคอขวดไฮไลต์แดง"
                        icon={Layers} titleColor="#1a5233" className="mb-4"
                    >
                        <div className="flex items-center justify-between gap-2 -mt-1 mb-2">
                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                <AlertTriangle size={12} className="text-red-400" />
                                ช่องพื้นแดง = ขั้นตอน &ldquo;รอ&rdquo; ที่นานสุดของคลินิกนั้น · คลิกแถวเพื่อกรองแผงอื่น (ตารางนี้แสดงทุกคลินิกตามเวรที่เลือก)
                            </p>
                            <button
                                onClick={exportClinics}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors shrink-0"
                            >
                                <Download size={13} /> Excel
                            </button>
                        </div>
                        <ClinicStageTable
                            rows={data.byDepartment}
                            stages={data.stageColumns}
                            totalTarget={data.targetTotal}
                            pctGoal={pctGoal}
                            selected={clinic}
                            onSelect={setClinic}
                        />
                    </SectionCard>

                    {/* องค์ประกอบเวลา แยกรายขั้นตอน (stacked) */}
                    <SectionCard
                        title="องค์ประกอบเวลาแยกรายขั้นตอน — 12 คลินิกที่รอนานสุด"
                        icon={Timer} titleColor="#1a5233" className="mb-4"
                    >
                        <ClinicStackChart rows={data.byDepartment} stages={data.stages} />
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[11px] text-gray-500">
                            {data.stages.map((s) => (
                                <span key={s.key} className="inline-flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: stageColor(s.key) }} />
                                    {stageShort(s.key, s.label)}
                                </span>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Hourly */}
                    <SectionCard title="ปริมาณผู้รับบริการตามชั่วโมง (เข้าจุดคัดกรอง)" icon={Users} titleColor="#1a5233" className="mb-4">
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={data.hourly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}`} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip formatter={(v) => [`${fmt(v as number)} visit`, ""]} labelFormatter={(h) => `${h}:00 นาที`} {...tip} />
                                <Bar dataKey="visits" fill={C.teal} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </SectionCard>

                    {/* Lab / Xray */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        <AncillaryCard title="ระยะเวลา Lab (TAT)" icon={FlaskConical} data={data.lab} />
                        <AncillaryCard title="ระยะเวลา X-ray" icon={Scan} data={data.xray} />
                    </div>

                    {/* ข้อมูลรายบุคคล */}
                    <PersonTable
                        visits={data.visits}
                        columns={data.stageColumns}
                        total={data.visitsTotal}
                        truncated={data.visitsTruncated}
                    />

                    <p className="text-[11px] text-gray-400 mt-5">
                        * เป้าหมายเวลารวม (ปัจจุบัน ≤ {data.targetTotal} นาที) และ % ผ่านเกณฑ์ (≥ {pctGoal}%) ปรับได้ที่ปุ่ม{" "}
                        <span className="inline-flex items-center gap-0.5"><Settings size={11} /> เป้าหมาย</span> ·
                        เป้าหมายรายขั้นตอน (รอตรวจ ≤ 30 นาที, รอรับยา ≤ 15 นาที, Lab/X-ray ≤ 60 นาที) ตั้งที่{" "}
                        <code>ST_TARGETS</code> ใน <code>lib/servicetime.queries.ts</code> · ตัดค่าติดลบและเกิน 12 ชม. ออกจากการคำนวณ
                    </p>
                </>
            ) : null}

            {/* Modal ตั้งค่าเป้าหมาย */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                                <Settings size={17} className="text-green-700" /> ตั้งค่าเป้าหมาย
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="block text-sm text-gray-500 mb-1">เป้าหมายเวลารวมทั้ง flow (นาที)</label>
                        <input
                            type="number" min={10} max={720} step={5} value={draftTotal}
                            onChange={(e) => setDraftTotal(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        />

                        <label className="block text-sm text-gray-500 mb-1">เป้าหมาย % ผู้ป่วยที่เสร็จภายในเวลา</label>
                        <input
                            type="number" min={1} max={100} step={1} value={draftPct}
                            onChange={(e) => setDraftPct(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                        />
                        <p className="text-[11px] text-gray-400 mb-5">
                            เวลารวมมีผลกับการคำนวณ %ผ่านเกณฑ์ (ดึงข้อมูลใหม่) · %เป้าหมายใช้กำหนดสี/สถานะ
                        </p>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveSettings}
                                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}