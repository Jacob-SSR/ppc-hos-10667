"use client";

import { useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, PieChart, Pie, Cell, Line,
} from "recharts";
import {
    Info, Clock, Timer, Syringe, ChevronDown,
    Users, AlertTriangle, Activity, TrendingUp, Skull,
    ShieldAlert, Microscope, MapPin, HeartPulse, CheckCircle2,
} from "lucide-react";
import {
    useAutoRefresh, timeAgo, CountdownRing, KpiCard, HBarList,
    SectionCard, MiniPagination, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { usePagination } from "@/hooks/usePagination";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SepsisYearSummary {
    year: string;
    total: number;
    dead: number;
    improve: number;
    admit: number;
    septicShock: number;
    mortalityRate: number;
    community: number;
    nosocomial: number;
    avgAge: number;
    bySite: Record<string, number>;
    byDept: Record<string, number>;
    byPathogen: Record<string, number>;
    byZone: Record<string, number>;
    byComorbidity: Record<string, number>;
}

interface SepsisSummary {
    total: number;
    dead: number;
    mortalityRate: number;
    byYear: SepsisYearSummary[];
    yearlyTrend: { year: string; total: number; dead: number; mortalityRate: number }[];
    allPathogen: Record<string, number>;
    allSite: Record<string, number>;
    allZone: Record<string, number>;
    allDept: Record<string, number>;
    allComorbidity: Record<string, number>;
}

interface SepsisRow {
    no: number;
    year: string;
    name: string;
    hn: string;
    age: number | null;
    comorbidity: string;
    serviceDate: string;
    dxDate: string;
    department: string;
    diagnosis: string;
    septicShock: boolean | null;
    pathogen: string;
    patientStatus: string;
    siteOfInfection: string;
    typeOfInfection: string;
    definiteStatus: string;
    zone: string;
    doorToDxMin: number | null;
    dxToAtbMin: number | null;
}

interface DashboardData {
    updatedAt: string;
    rows: SepsisRow[];
    summary: SepsisSummary;
    sheetNames: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000;

const SITE_COLORS: Record<string, string> = {
    "ระบบทางเดินหายใจ (RS)": "#378ADD",
    "ระบบทางเดินปัสสาวะ (GU)": "#EF9F27",
    "ทั่วร่างกาย (Systemic)": "#E24B4A",
    "ระบบทางเดินอาหาร (GI)": "#1D9E75",
    "ผิวหนัง/กล้ามเนื้อ (MSK)": "#D85A30",
    "ระบบประสาท (CNS)": "#7F77DD",
    "ไม่ระบุ": "#888780",
};

const PALETTE = [
    "#378ADD", "#1D9E75", "#639922", "#EF9F27",
    "#D85A30", "#7F77DD", "#E24B4A", "#888780",
];

const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ─── Year Dropdown ────────────────────────────────────────────────────────────
function YearTab({ years, selected, onSelect }: {
    years: string[]; selected: string; onSelect: (y: string) => void;
}) {
    return (
        <div className="relative inline-block">
            <select
                value={selected}
                onChange={(e) => onSelect(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 rounded-xl border-2 border-[#a8d5ba] bg-[#f0faf4] text-sm font-semibold text-[#1a5233] cursor-pointer focus:outline-none focus:border-[#3aa36a] transition-colors min-w-[180px]"
            >
                <option value="all">ทุกปี</option>
                {years.map((y) => (
                    <option key={y} value={y}>ปีงบประมาณ {y}</option>
                ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#3aa36a]">
                <ChevronDown size={16} />
            </span>
        </div>
    );
}

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: SepsisRow[] }) {
    const { page, setPage, totalPages, paged } = usePagination(rows, 20);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <p className="text-sm font-bold text-gray-600">รายชื่อผู้ป่วย</p>
                </div>
                <span className="text-xs text-gray-400">{rows.length} ราย</span>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700 sticky top-0">
                            {["ปี", "ชื่อ-สกุล", "HN", "อายุ", "แผนก", "วันรับบริการ",
                                "Site", "ประเภทการติดเชื้อ", "Pathogen", "สถานะ"].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr
                                key={`${r.year}-${r.hn}-${i}`}
                                className={`border-b border-gray-100 hover:bg-green-50/40 transition-colors ${r.definiteStatus === "Dead" ? "bg-red-50/30" : i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    }`}
                            >
                                <td className="px-3 py-2 text-gray-500">{r.year}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.name}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: r.department === "ER" ? "#FCEBEB" : "#E6F1FB",
                                            color: r.department === "ER" ? "#E24B4A" : "#378ADD",
                                        }}>
                                        {r.department}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.serviceDate || "-"}</td>
                                <td className="px-3 py-2 text-gray-500 text-[10px] whitespace-nowrap">
                                    {r.siteOfInfection.split(" ")[0]}
                                </td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: r.typeOfInfection === "Community" ? "#EAF3DE" : "#FAEEDA",
                                            color: r.typeOfInfection === "Community" ? "#639922" : "#EF9F27",
                                        }}>
                                        {r.typeOfInfection === "Community" ? "Comm" : r.typeOfInfection === "Nosocomial" ? "Noso" : r.typeOfInfection}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[10px] whitespace-nowrap">{r.pathogen}</td>
                                <td className="px-3 py-2">
                                    {r.definiteStatus === "Dead"
                                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Dead</span>
                                        : r.definiteStatus === "Improve"
                                            ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Improve</span>
                                            : <span className="text-gray-400 text-[10px]">{r.definiteStatus || "-"}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <MiniPagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
    );
}

// ─── Comorbidity normalization ──────────────────────────────────────────────────
type Comorbidity = "DM" | "HT" | "CKD/ESRD" | "Cancer" | "COPD" | "CVA";

function normComorbidity(raw: string): Comorbidity[] {
    if (!raw) return [];
    return raw.split(/[,\/;]/).map((s): Comorbidity | null => {
        const v = s.trim().toUpperCase();
        if (v.includes("DM")) return "DM";
        if (v.includes("HT")) return "HT";
        if (v.includes("CKD")) return "CKD/ESRD";
        if (v.includes("CANCER") || v.startsWith("CA")) return "Cancer";
        if (v.includes("COPD")) return "COPD";
        if (v.includes("CVA")) return "CVA";
        return null;
    }).filter((v): v is Comorbidity => v !== null);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SepsisDashboardPage() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<DashboardData>("/api/sepsis-sheets", REFRESH_INTERVAL_MS);

    const [selectedYear, setSelectedYear] = useState("2569");

    const years = useMemo(() => data?.summary.byYear.map((y) => y.year) ?? [], [data]);

    // Filter rows by selected year
    const activeRows = useMemo(() => {
        if (!data) return [];
        return selectedYear === "all" ? data.rows : data.rows.filter((r) => r.year === selectedYear);
    }, [data, selectedYear]);

    // KPIs from filtered rows
    const kpiTotal = activeRows.length;
    const kpiDead = activeRows.filter((r) => r.definiteStatus === "Dead").length;
    const kpiImprove = activeRows.filter((r) => r.definiteStatus === "Improve").length;
    const kpiShock = activeRows.filter((r) => r.septicShock === true).length;
    const kpiMortality = kpiTotal > 0 ? ((kpiDead / kpiTotal) * 100).toFixed(1) : "0.0";
    const kpiAvgAge = useMemo(() => {
        const ages = activeRows.map((r) => r.age).filter((a): a is number => a != null && a > 0);
        return ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
    }, [activeRows]);

    // ── KPI เวลา: เฉพาะ Admit / Refer (ไม่นับ Refer Back) ──
    const timeKpis = useMemo(() => {
        const isReferBack = (s: string) => /refer\s*back/i.test(s || "");
        const elig = activeRows.filter((r) => !isReferBack(r.patientStatus));
        const calc = (vals: (number | null)[], th: number) => {
            const v = vals.filter((n): n is number => n != null && n >= 0);
            const n = v.length;
            const within = v.filter((x) => x <= th).length;
            const avg = n ? Math.round(v.reduce((s, x) => s + x, 0) / n) : 0;
            const pct = n ? Math.round((within / n) * 1000) / 10 : 0;
            return { n, within, avg, pct };
        };
        const doorAtb = elig.map((r) =>
            r.doorToDxMin != null && r.dxToAtbMin != null ? r.doorToDxMin + r.dxToAtbMin : null);
        return {
            door30: calc(elig.map((r) => r.doorToDxMin), 30),
            door60: calc(elig.map((r) => r.doorToDxMin), 60),
            atb60: calc(elig.map((r) => r.dxToAtbMin), 60),
            doorToAtb: calc(doorAtb, 60),
        };
    }, [activeRows]);

    // Chart data computed from activeRows
    const siteData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => { m[r.siteOfInfection] = (m[r.siteOfInfection] || 0) + 1; });
        return Object.entries(m)
            .filter(([k]) => k !== "ไม่ระบุ")
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value, color: SITE_COLORS[name] ?? "#888780" }));
    }, [activeRows]);

    const pathogenData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => {
            if (!["No Growth", "Contaminate", "ไม่ระบุ"].includes(r.pathogen))
                m[r.pathogen] = (m[r.pathogen] || 0) + 1;
        });
        return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 10) as [string, number][];
    }, [activeRows]);

    const zoneData = useMemo(() =>
        Object.entries(
            activeRows.reduce((m, r) => {
                const zone = r.zone?.trim();
                if (!zone || zone === "-" || zone === "ไม่ระบุ") return m;
                m[zone] = (m[zone] || 0) + 1;
                return m;
            }, {} as Record<string, number>)
        ).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][], [activeRows]);

    const typeData = useMemo(() => {
        const community = activeRows.filter((r) => r.typeOfInfection === "Community").length;
        const nosocomial = activeRows.filter((r) => r.typeOfInfection === "Nosocomial").length;
        const other = kpiTotal - community - nosocomial;
        return [
            { name: "Community", value: community, color: "#639922" },
            { name: "Nosocomial", value: nosocomial, color: "#EF9F27" },
            ...(other > 0 ? [{ name: "ไม่ระบุ", value: other, color: "#888780" }] : []),
        ].filter((d) => d.value > 0);
    }, [activeRows, kpiTotal]);

    // กรอง dept ที่ไม่ใช่ชื่อแผนกจริง (วันที่, ตัวเลข, เครื่องหมาย, ข้อความสั้นแปลกๆ)
    const VALID_DEPTS = new Set(["ER", "OPD", "IPD", "ICU", "Ward", "ไม่ระบุ", "อื่นๆ"]);
    function isValidDept(d: string): boolean {
        if (!d || d === "-" || d === "") return false;
        // เป็นวันที่รูปแบบต่างๆ: 22/2/2023, 4/8/2565, 2023-01-01
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(d)) return false;
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(d)) return false;
        // เป็นตัวเลขล้วน
        if (/^\d+$/.test(d)) return false;
        // ขึ้นต้นด้วยตัวเลข (น่าจะเป็นวันที่)
        if (/^\d/.test(d) && !VALID_DEPTS.has(d)) return false;
        return true;
    }

    const deptData = useMemo(() =>
        Object.entries(
            activeRows.reduce((m, r) => {
                const dept = r.department?.trim() || "ไม่ระบุ";
                if (isValidDept(dept)) m[dept] = (m[dept] || 0) + 1;
                return m;
            }, {} as Record<string, number>)
        )
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8) as [string, number][], [activeRows]);

    const comorbData = useMemo(() => {
        const m: Record<string, number> = {};
        activeRows.forEach((r) => normComorbidity(r.comorbidity).forEach((c) => { m[c] = (m[c] || 0) + 1; }));
        return Object.entries(m).sort(([, a], [, b]) => b - a).map(([name, value], i) => ({
            name, value, fill: PALETTE[i % PALETTE.length],
        }));
    }, [activeRows]);

    const ageData = useMemo(() => {
        const groups: Record<string, number> = { "< 15": 0, "15-29": 0, "30-44": 0, "45-59": 0, "60-74": 0, "≥ 75": 0 };
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

    const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold text-gray-800">
                            Dashboard ผู้ป่วยติดเชื้อในกระแสเลือด (Sepsis)
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
                        {data && (
                            <>
                                <span>·</span>
                                <Clock size={11} />
                                <span>อัปเดต {timeAgo(data.updatedAt)}</span>
                                <span>·</span>
                                <span>Sheets: {data.sheetNames.join(", ")}</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={refetch} />
                    <ConnectionStatus error={!!error} connected={connected && !!data} />
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ใน .env และ Spreadsheet permissions</p>
                    </div>
                </div>
            )}

            {/* ── Loading shimmer ── */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Year Tabs ── */}
            {!loading && data && years.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">เลือกปีงบประมาณ</p>
                    <YearTab years={years} selected={selectedYear} onSelect={setSelectedYear} />
                </div>
            )}

            {/* ── KPI Cards ── */}
            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(kpiTotal)} ราย`}
                        sub={selectedYear === "all" ? `${years.length} ปีงบประมาณ` : `ปี ${selectedYear}`}
                        accent="#185FA5" bg="#E6F1FB" />
                    <KpiCard icon={CheckCircle2} label="Improve" value={`${fmt(kpiImprove)} ราย`}
                        sub={kpiTotal > 0 ? `${fmtB((kpiImprove / kpiTotal) * 100)}%` : "0%"}
                        accent="#3B6D11" bg="#EAF3DE" />
                    <KpiCard icon={Skull} label="เสียชีวิต" value={`${fmt(kpiDead)} ราย`}
                        sub={`Mortality ${kpiMortality}%`}
                        accent="#A32D2D" bg="#FCEBEB" highlight={kpiDead > 0} />
                    <KpiCard icon={AlertTriangle} label="Septic Shock" value={`${fmt(kpiShock)} ราย`}
                        sub="ที่มีข้อมูล" accent="#BA7517" bg="#FAEEDA" />
                    <KpiCard icon={HeartPulse} label="อายุเฉลี่ย" value={`${kpiAvgAge} ปี`}
                        sub="เฉพาะที่มีข้อมูล" accent="#1D9E75" bg="#E1F5EE" />
                    <KpiCard icon={Microscope} label="Pathogen พบ" value={`${pathogenData.length} ชนิด`}
                        sub="ยกเว้น No Growth" accent="#7F77DD" bg="#EEEDFE" />
                </div>
            )}

            {/* ── KPI เวลา (Sepsis Time Bundle) ── */}
            {data && (timeKpis.door30.n > 0 || timeKpis.atb60.n > 0) && (
                <SectionCard
                    title="ความรวดเร็วในการดูแล Sepsis (เฉพาะ Admit / Refer — ไม่นับ Refer Back)"
                    icon={Clock}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <KpiCard icon={Timer} label="มาถึง รพ. → Dx Sepsis ≤ 30 นาที"
                            value={`${timeKpis.door30.pct}%`}
                            sub={`เฉลี่ย ${timeKpis.door30.avg} นาที · ผ่าน ${timeKpis.door30.within}/${timeKpis.door30.n} ราย`}
                            accent="#185FA5" bg="#E6F1FB" />
                        <KpiCard icon={Activity} label="มาถึง รพ. → Dx Sepsis ≤ 1 ชม."
                            value={`${timeKpis.door60.pct}%`}
                            sub={`เฉลี่ย ${timeKpis.door60.avg} นาที · ผ่าน ${timeKpis.door60.within}/${timeKpis.door60.n} ราย`}
                            accent="#1D9E75" bg="#E1F5EE" />
                        <KpiCard icon={Syringe} label="Dx Sepsis → ได้รับ ATB ≤ 1 ชม."
                            value={`${timeKpis.atb60.pct}%`}
                            sub={`เฉลี่ย ${timeKpis.atb60.avg} นาที · ผ่าน ${timeKpis.atb60.within}/${timeKpis.atb60.n} ราย`}
                            accent="#BA7517" bg="#FAEEDA" />
                    </div>
                    <div className="mt-3 mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">เวลาเฉลี่ย</span>
                        <div className="h-px flex-1 bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <KpiCard icon={Timer} label="เฉลี่ย มาถึง รพ. → Dx Sepsis"
                            value={`${timeKpis.door60.avg} นาที`}
                            sub={`จาก ${timeKpis.door60.n} ราย`}
                            accent="#185FA5" bg="#E6F1FB" />
                        <KpiCard icon={Activity} label="เฉลี่ย มาถึง รพ. → Dx Sepsis"
                            value={`${timeKpis.door60.avg} นาที`}
                            sub={`จาก ${timeKpis.door60.n} ราย`}
                            accent="#1D9E75" bg="#E1F5EE" />
                        <KpiCard icon={Syringe} label="เฉลี่ย Dx Sepsis → ได้รับ ATB"
                            value={`${timeKpis.atb60.avg} นาที`}
                            sub={`จาก ${timeKpis.atb60.n} ราย`}
                            accent="#BA7517" bg="#FAEEDA" />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">
                        * ตัวเลขใหญ่บน = % ที่ทำได้ตามเกณฑ์ · นับเฉพาะผู้ป่วยที่มีเวลาครบและสถานะ Admit หรือ Refer
                        (ไม่นับ Refer Back) · เวลารวม มาถึง รพ. → ได้รับ ATB เฉลี่ย {timeKpis.doorToAtb.avg} นาที
                        (จาก {timeKpis.doorToAtb.n} ราย) · ปี 2565–2566 ไม่มีคอลัมน์เวลาจึงไม่ถูกนับ
                    </p>
                </SectionCard>
            )}

            {/* ── Yearly Trend (all years only) ── */}
            {data && selectedYear === "all" && data.summary.yearlyTrend.length > 1 && (
                <SectionCard title="แนวโน้มรายปี — จำนวนผู้ป่วยและอัตราเสียชีวิต" icon={TrendingUp}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.summary.yearlyTrend} margin={{ top: 4, right: 24, left: -20, bottom: 0 }} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#E24B4A" }}
                                axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                            <Tooltip {...tip} formatter={(v, name) =>
                                name === "อัตราเสียชีวิต (%)" ? [`${v ?? 0}%`, name] : [`${v ?? 0} ราย`, name]} />
                            <Bar yAxisId="left" dataKey="total" name="จำนวนทั้งหมด" fill="#378ADD" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="dead" name="เสียชีวิต" fill="#E24B4A" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="mortalityRate" name="อัตราเสียชีวิต (%)"
                                stroke="#E24B4A" strokeWidth={2.5} dot={{ r: 4, fill: "#E24B4A" }} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            )}

            {/* ── Charts Row 1 ── */}
            {data && kpiTotal > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Site of Infection */}
                    <SectionCard title="Site of Infection" icon={ShieldAlert}>
                        <div className="flex justify-center">
                            <PieChart width={160} height={160}>
                                <Pie data={siteData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                    dataKey="value" paddingAngle={3}>
                                    {siteData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                                </Pie>
                                <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                            </PieChart>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {siteData.map((d) => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                                    <span className="text-[10px] text-gray-500">{d.name.split(" ")[0]}: {d.value}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Type of Infection */}
                    <SectionCard title="Type of Infection" icon={Activity}>
                        <div className="flex justify-center">
                            <PieChart width={160} height={160}>
                                <Pie data={typeData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                                    dataKey="value" paddingAngle={4}>
                                    {typeData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                                </Pie>
                                <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                            </PieChart>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {typeData.map((d) => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                                    <span className="text-[10px] text-gray-500">{d.name}: {d.value} ราย ({kpiTotal > 0 ? Math.round((d.value / kpiTotal) * 100) : 0}%)</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Department */}
                    <SectionCard title="แผนกที่วินิจฉัย" icon={Activity}>
                        <HBarList data={deptData} colors={["#E24B4A", "#378ADD", "#EF9F27", "#1D9E75"]} total={kpiTotal} />
                    </SectionCard>
                </div>
            )}

            {/* ── Charts Row 2 ── */}
            {data && kpiTotal > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pathogen */}
                    <SectionCard title="Pathogen ที่พบ (ยกเว้น No Growth / Contaminate)" icon={Microscope}>
                        {pathogenData.length > 0
                            ? <HBarList data={pathogenData} colors={PALETTE} total={kpiTotal} />
                            : <p className="text-sm text-gray-400 text-center py-4">ไม่พบข้อมูล Pathogen</p>}
                    </SectionCard>

                    {/* Comorbidity */}
                    <SectionCard title="โรคประจำตัว (Comorbidity)" icon={HeartPulse}>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={comorbData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {comorbData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </SectionCard>
                </div>
            )}

            {/* ── Charts Row 3 ── */}
            {data && kpiTotal > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Age group */}
                    <SectionCard title={`กลุ่มอายุ (เฉลี่ย ${kpiAvgAge} ปี)`} icon={Users}>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
                                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                                <Bar dataKey="value" fill="#378ADD" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </SectionCard>

                    {/* Zone */}
                    <SectionCard title="เขตที่อยู่อาศัย" icon={MapPin}>
                        <HBarList data={zoneData} colors={PALETTE} total={kpiTotal} />
                    </SectionCard>
                </div>
            )}

            {/* ── Patient Table ── */}
            {data && activeRows.length > 0 && <PatientTable rows={activeRows} />}

            {/* ── Empty state ── */}
            {!loading && !error && data && kpiTotal === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                    <Info size={32} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
                    <p className="text-xs text-amber-700">
                        เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที
                    </p>
                    <p className="text-[11px] text-gray-400">
                        Sheets ที่ดึงข้อมูล: {data.sheetNames.join(", ") || "ไม่พบ sheet ปีงบประมาณ"}
                    </p>
                </div>
            )}
        </div>
    );
}