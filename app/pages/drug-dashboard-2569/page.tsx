"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Area,
    AreaChart,
} from "recharts";
import {
    Info,
    Clock,
    Users,
    Activity,
    ShieldCheck,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    HeartPulse,
    CalendarCheck,
    Route as RouteIcon,
    ListChecks,
} from "lucide-react";
import {
    useAutoRefresh,
    timeAgo,
    CountdownRing,
    KpiCard,
    HBarList,
    SectionCard,
    MiniPagination,
    LiveBadge,
    ConnectionStatus,
    RefreshButton,
} from "@/app/components/dashboard/live";
import { usePagination } from "@/hooks/usePagination";
import type {
    Drug2569DashboardData,
    Drug2569Summary,
    Drug2569Row,
    ColorKey,
    PipelineStage,
    KpiDimension,
} from "@/app/api/drug-2569/route";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── Palette (ตรงกับ drug-dashboard เดิม) ──────────────────────────────────────
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
    ink: "#1a5233",
};
// สีไตรอาจ — ใช้เฉพาะกราฟความรุนแรงเท่านั้น
const TRIAGE: Record<ColorKey, string> = {
    green: C.green,
    yellow: "#E6B82C",
    orange: C.amber,
    red: C.red,
    none: C.gray,
};
const TRIAGE_TH: Record<ColorKey, string> = {
    green: "เขียว",
    yellow: "เหลือง",
    orange: "ส้ม",
    red: "แดง",
    none: "ไม่ระบุ",
};
const REFERRAL_COLORS = [
    C.blue,
    C.green,
    C.amber,
    C.coral,
    C.teal,
    C.red,
    C.purple,
    C.gray,
];
const METHOD_COLORS = [C.green, C.blue, C.amber, C.teal, C.coral, C.purple];
const TAMBON_COLORS = [C.ink, C.teal, C.green, C.blue, C.amber, C.gray];

const REFRESH_INTERVAL_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("th-TH");
const tip = {
    contentStyle: {
        fontSize: 12,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
    },
};

// ─── FY month helper (ต.ค.→ก.ย.) — สร้าง trend จาก rows.regMonth ────────────────
const FY = [
    { m: "10", label: "ต.ค." },
    { m: "11", label: "พ.ย." },
    { m: "12", label: "ธ.ค." },
    { m: "01", label: "ม.ค." },
    { m: "02", label: "ก.พ." },
    { m: "03", label: "มี.ค." },
    { m: "04", label: "เม.ย." },
    { m: "05", label: "พ.ค." },
    { m: "06", label: "มิ.ย." },
    { m: "07", label: "ก.ค." },
    { m: "08", label: "ส.ค." },
    { m: "09", label: "ก.ย." },
];
function monthlyTrend(rows: Drug2569Row[]) {
    return FY.map(({ m, label }) => ({
        month: label,
        count: rows.filter((r) => r.regMonth.slice(5, 7) === m).length,
    }));
}

// ─── Care Pipeline (signature) ─────────────────────────────────────────────────
const CarePipeline = memo(function CarePipeline({
    stages,
}: {
    stages: PipelineStage[];
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <RouteIcon size={15} className="text-emerald-700" />
                    <p className="text-sm font-bold text-emerald-800">
                        เส้นทางการดูแลผู้ป่วย · Care Pipeline
                    </p>
                </div>
                <span className="text-[11px] text-gray-400">
                    นับตามรายที่อยู่ในมุมมองปัจจุบัน
                </span>
            </div>
            <div className="flex flex-wrap items-stretch">
                {stages.map((s, i) => (
                    <div
                        key={s.key}
                        className="relative flex-1 min-w-[135px] pr-5 py-1"
                    >
                        {i < stages.length - 1 && (
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 rotate-45 w-3.5 h-3.5 border-r-2 border-t-2 border-gray-200" />
                        )}
                        <p className="text-[11px] font-semibold text-gray-500">
                            {s.label}
                        </p>
                        <p
                            className="text-3xl font-extrabold tabular-nums mt-0.5"
                            style={{ color: s.accent ? C.ink : "#1f2937" }}
                        >
                            {s.value}
                            {s.suffix ?? ""}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                        <div className="h-1.5 rounded bg-gray-100 mt-2 overflow-hidden">
                            <motion.div
                                className="h-full rounded"
                                style={{
                                    background: s.accent
                                        ? `linear-gradient(90deg, ${C.teal}, ${C.green})`
                                        : C.teal,
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(4, s.pct)}%` }}
                                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.06 }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// ─── KPI 4 มิติ ────────────────────────────────────────────────────────────────
const DIM_ICON = [ShieldCheck, HeartPulse, CalendarCheck, ListChecks];

const KpiDimensions = memo(function KpiDimensions({
    dims,
}: {
    dims: KpiDimension[];
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dims.map((d, di) => {
                const Icon = DIM_ICON[di % DIM_ICON.length];
                return (
                    <div
                        key={d.n}
                        className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5"
                    >
                        <div className="flex items-center gap-2.5 mb-1">
                            <span className="w-7 h-7 rounded-lg bg-emerald-900 text-white text-xs font-bold grid place-items-center shrink-0">
                                {d.n}
                            </span>
                            <Icon size={15} className="text-emerald-700" />
                            <p className="text-sm font-bold text-gray-700">{d.title}</p>
                        </div>
                        <p className="text-[11px] text-gray-400 ml-9 mb-3">{d.en}</p>
                        <div className="divide-y divide-gray-100">
                            {d.indicators.map((ind, ii) => (
                                <div
                                    key={ii}
                                    className="flex items-center gap-3 py-2.5"
                                >
                                    <div className="flex-1">
                                        <p className="text-[13px] text-gray-700 leading-tight">
                                            {ind.label}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {ind.formula}
                                        </p>
                                    </div>
                                    {ind.value !== null ? (
                                        <p className="text-xl font-extrabold tabular-nums text-gray-800 whitespace-nowrap">
                                            {ind.value}
                                            <span className="text-xs font-bold text-gray-400">
                                                {ind.suffix ?? ""}
                                            </span>
                                        </p>
                                    ) : (
                                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-md whitespace-nowrap">
                                            {ind.pending}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

// ─── Donut ─────────────────────────────────────────────────────────────────────
function Donut({
    data,
}: {
    data: { name: string; value: number; color: string }[];
}) {
    return (
        <>
            <div className="flex justify-center">
                <PieChart width={160} height={160}>
                    <Pie
                        data={data}
                        cx={75}
                        cy={75}
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={3}
                        isAnimationActive={false}
                    >
                        {data.map((d, i) => (
                            <Cell key={i} fill={d.color} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                </PieChart>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                {data.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                        <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ background: d.color }}
                        />
                        <span className="text-[10px] text-gray-500">
                            {d.name} {d.value}
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

// ─── Charts ────────────────────────────────────────────────────────────────────
const DashboardCharts = memo(function DashboardCharts({
    s,
    rows,
}: {
    s: Drug2569Summary;
    rows: Drug2569Row[];
}) {
    const statusData = [
        { name: "กำลังบำบัด", value: s.byStatus["บำบัด"] ?? 0, color: C.teal },
        { name: "ติดตาม", value: s.byStatus["ติดตาม"] ?? 0, color: "#7FB6B4" },
        { name: "จำหน่าย", value: s.byStatus["จำหน่าย"] ?? 0, color: "#C4D3D1" },
    ];
    const colorOrder: ColorKey[] = ["green", "yellow", "orange", "red"];
    const colorData = colorOrder.map((k) => ({
        name: TRIAGE_TH[k],
        value: s.byColor[k] ?? 0,
        color: TRIAGE[k],
    }));
    const ageData = Object.entries(s.byAgeGroup).map(([name, value]) => ({
        name,
        value,
    }));
    const trend = monthlyTrend(rows);
    const referralData = Object.entries(s.byReferral).sort(
        ([, a], [, b]) => b - a,
    ) as [string, number][];
    const tambonData = Object.entries(s.byTambon).sort(
        ([, a], [, b]) => b - a,
    ) as [string, number][];
    const methodData = Object.entries(s.byMethod).sort(
        ([, a], [, b]) => b - a,
    ) as [string, number][];
    const sessData = s.sessionsHist.map((x) => ({
        name: String(x.sessions),
        value: x.count,
    }));

    return (
        <div className="space-y-4">
            {/* Row 1: status / severity / age */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="สถานะการดูแล" icon={Activity}>
                    <Donut data={statusData} />
                </SectionCard>
                <SectionCard title="ระดับความรุนแรง (สีไตรอาจ)" icon={ShieldCheck}>
                    <ResponsiveContainer width="100%" height={170}>
                        <BarChart
                            data={colorData}
                            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                            barCategoryGap="25%"
                        >
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                {colorData.map((d, i) => (
                                    <Cell key={i} fill={d.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
                <SectionCard title="ช่วงอายุ (ปี)" icon={Users}>
                    <ResponsiveContainer width="100%" height={170}>
                        <BarChart
                            data={ageData}
                            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                            barCategoryGap="20%"
                        >
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                            <Bar
                                dataKey="value"
                                fill={C.teal}
                                radius={[4, 4, 0, 0]}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* Row 2: monthly trend + method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard
                    title="แนวโน้มการรับเข้ารายเดือน (วันลงทะเบียน บสต.)"
                    icon={TrendingUp}
                >
                    <ResponsiveContainer width="100%" height={190}>
                        <AreaChart
                            data={trend}
                            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="dg2569" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.teal} stopOpacity={0.22} />
                                    <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`, "รับเข้า"]} {...tip} />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke={C.teal}
                                strokeWidth={2.5}
                                fill="url(#dg2569)"
                                dot={{ r: 3, fill: C.teal }}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="รูปแบบการเข้าสู่การบำบัด" icon={Activity}>
                    <HBarList
                        data={methodData}
                        colors={METHOD_COLORS}
                        total={s.total}
                        labelWidth={120}
                    />
                </SectionCard>
            </div>

            {/* Row 3: referral + tambon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="ช่องทางการนำส่ง" icon={TrendingUp}>
                    <HBarList
                        data={referralData}
                        colors={REFERRAL_COLORS}
                        total={s.total}
                        labelWidth={120}
                    />
                </SectionCard>
                <SectionCard title="ตำบล (เขตรับผิดชอบ)" icon={Activity}>
                    <HBarList
                        data={tambonData}
                        colorMap={{ "นอกเขต/อื่นๆ": C.gray }}
                        colors={TAMBON_COLORS}
                        total={s.total}
                        labelWidth={120}
                    />
                </SectionCard>
            </div>

            {/* Row 4: sessions + follow-up funnel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard
                    title="จำนวนครั้งที่เข้าบำบัด (Matrix สูงสุด 16 ครั้ง)"
                    icon={Activity}
                >
                    <ResponsiveContainer width="100%" height={190}>
                        <BarChart
                            data={sessData}
                            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                            barCategoryGap="12%"
                        >
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#6b7280" }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                formatter={(v) => [`${v ?? 0} ราย`]}
                                labelFormatter={(l) => `${l} ครั้ง`}
                                {...tip}
                            />
                            <Bar
                                dataKey="value"
                                fill={C.green}
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard
                    title="การติดตามหลังบำบัด (รายที่ติดตามถึงแต่ละช่วง)"
                    icon={CalendarCheck}
                >
                    <HBarList
                        data={s.followupFunnel.map((f) => [f.label, f.count] as [string, number])}
                        colors={[C.teal]}
                        labelWidth={84}
                    />
                    <p className="text-[11px] text-gray-400 mt-3">
                        ครอบคลุมการติดตาม {s.followupCoverage}% ของรายที่อยู่สถานะติดตาม
                    </p>
                </SectionCard>
            </div>
        </div>
    );
});

// ─── Patient table ─────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: Drug2569Row[] }) {
    const [search, setSearch] = useState("");
    const filtered = rows.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            r.hn.includes(q) ||
            r.tambonRaw.toLowerCase().includes(q)
        );
    });
    const { page, setPage, totalPages, paged, pageSize } = usePagination(
        filtered,
        20,
    );

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
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-emerald-400"
                />
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-emerald-800 sticky top-0">
                            {[
                                "#",
                                "HN",
                                "ชื่อ-สกุล",
                                "อายุ",
                                "ตำบล",
                                "สถานะ",
                                "ปัจจุบัน",
                                "สี",
                                "V2",
                                "ครั้งบำบัด",
                                "ติดตาม",
                            ].map((h) => (
                                <th
                                    key={h}
                                    className="px-3 py-2.5 text-left text-white font-semibold border-r border-emerald-700 whitespace-nowrap"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr
                                key={`${r.hn}-${i}`}
                                className={`border-b border-gray-100 hover:bg-emerald-50/40 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    }`}
                            >
                                <td className="px-3 py-2 text-gray-400">
                                    {(page - 1) * pageSize + i + 1}
                                </td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                                    {r.prefix}
                                    {r.firstName} {r.lastName}
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center">
                                    {r.age || "-"}
                                </td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                    {r.tambonRaw || "-"}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background:
                                                r.treatStatus === "บำบัด"
                                                    ? C.tealL
                                                    : r.treatStatus === "จำหน่าย"
                                                        ? C.blueL
                                                        : C.amberL,
                                            color:
                                                r.treatStatus === "บำบัด"
                                                    ? C.teal
                                                    : r.treatStatus === "จำหน่าย"
                                                        ? "#185FA5"
                                                        : "#BA7517",
                                        }}
                                    >
                                        {r.treatStatus || "-"}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[10px]">
                                    {r.detailStatus || "-"}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: TRIAGE[r.color] + "22",
                                            color: TRIAGE[r.color],
                                        }}
                                    >
                                        {TRIAGE_TH[r.color]}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-700 text-center font-semibold tabular-nums">
                                    {r.v2 || "-"}
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center tabular-nums">
                                    {r.sessions}
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center tabular-nums">
                                    {r.followups}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <MiniPagination
                page={page}
                totalPages={totalPages}
                onChange={setPage}
                count={filtered.length}
            />
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Drug2569DashboardPage() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<Drug2569DashboardData>("/api/drug-2569", REFRESH_INTERVAL_MS);
    const s = data?.summary;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold text-gray-800">
                            Dashboard ผู้ป่วยยาเสพติด · ปีงบ 2569
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>งานจิตเวชและยาเสพติด · ดึงจาก Google Sheets เรียลไทม์</span>
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
                        <CountdownRing
                            secondsLeft={secondsLeft}
                            total={REFRESH_INTERVAL_MS / 1000}
                        />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={refetch} />
                    <ConnectionStatus error={!!error} connected={connected && !!data} />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">
                            ไม่สามารถดึงข้อมูลได้
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และ
                            DRUG_2569_SPREADSHEET_ID ใน .env (และแชร์ชีตให้ service account)
                        </p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-[130px] rounded-2xl bg-gray-100 animate-pulse"
                        />
                    ))}
                </div>
            )}

            {/* KPI cards */}
            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <KpiCard
                        icon={Users}
                        label="ผู้ป่วยทั้งหมด"
                        value={`${fmt(s.total)} ราย`}
                        sub={`ชาย ${s.male} · หญิง ${s.female}`}
                        accent={C.blue}
                        bg={C.blueL}
                    />
                    <KpiCard
                        icon={TrendingUp}
                        label="รายใหม่ปีงบนี้"
                        value={`${fmt(s.newPatients)} ราย`}
                        sub={`${Math.round((s.newPatients / Math.max(1, s.total)) * 100)}% ของทั้งหมด`}
                        accent={C.green}
                        bg={C.greenL}
                    />
                    <KpiCard
                        icon={CheckCircle2}
                        label="อัตราคงอยู่ (Retention)"
                        value={`${s.retentionRate}%`}
                        sub={`ครบ ${s.treatComplete} · หลุด ${s.dropout}`}
                        accent={C.teal}
                        bg={C.tealL}
                    />
                    <KpiCard
                        icon={ShieldCheck}
                        label="คะแนน V2 เฉลี่ย"
                        value={`${s.avgV2} pts`}
                        sub={`min ${s.minV2} · max ${s.maxV2}`}
                        accent={C.amber}
                        bg={C.amberL}
                    />
                    <KpiCard
                        icon={CalendarCheck}
                        label="ความครอบคลุมการติดตาม"
                        value={`${s.followupCoverage}%`}
                        sub={`คัดกรอง V2 ${s.screeningRate}%`}
                        accent={C.purple}
                        bg="#EEEDFE"
                    />
                </div>
            )}

            {/* Care Pipeline (signature) */}
            {s && <CarePipeline stages={s.pipeline} />}

            {/* KPI 4 dimensions */}
            {s && (
                <>
                    <div className="flex items-center gap-2 px-1 pt-1">
                        <AlertTriangle size={14} className="text-emerald-700" />
                        <h2 className="text-sm font-bold text-gray-700">
                            ตัวชี้วัดตาม 4 มิติงานยาเสพติด
                        </h2>
                        <span className="text-[11px] text-gray-400">
                            ค่าที่คำนวณได้แสดงเป็นตัวเลข · ตัวที่ต้องเก็บข้อมูลเพิ่มมีป้ายกำกับ
                        </span>
                    </div>
                    <KpiDimensions dims={s.dimensions} />
                </>
            )}

            {/* Charts */}
            {s && s.total > 0 && <DashboardCharts s={s} rows={data!.rows} />}

            {/* Patient table */}
            {data && data.rows.length > 0 && <PatientTable rows={data.rows} />}

            {/* Empty */}
            {!loading && !error && data && s?.total === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <Info size={32} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">
                        ยังไม่มีข้อมูลใน Spreadsheet
                    </p>
                    <p className="text-xs text-amber-700">
                        เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30
                        วินาที
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">
                        Sheet: {data.sheetName}
                    </p>
                </div>
            )}

            {/* AI summary */}
            <AiSummaryCard
                summary={s}
                context="Dashboard ผู้ป่วยยาเสพติด ปีงบ 2569 งานจิตเวชและยาเสพติด (Care Pipeline, อัตราคงอยู่/Retention, ตัวชี้วัด 4 มิติ, ระดับความรุนแรงสีไตรอาจ, คะแนน V2, ครั้งบำบัด Matrix, การติดตามหลังบำบัด, ตำบล, ช่องทางนำส่ง)"
                disabled={!s}
            />
        </div>
    );
}