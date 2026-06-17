"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
    PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
    Users, Activity, Banknote, Coins, ListChecks, BarChart3, Wallet,
    Table2, Tags, Search, Leaf, Clock,
    ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import {
    CountdownRing, KpiCard, HBarList, SectionCard,
    LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { Shimmer } from "@/app/components/ui/Shimmer";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatThaiDate } from "@/lib/dateUtils";

// ─── Types (ตรงกับ lib/ttm.service.ts) ────────────────────────────────────────
interface Shift { visit_count: number; revenue: number; }
interface DoctorSummary {
    doctor_id: string; doctor_name: string;
    patient_count: number; visit_count: number; revenue: number;
    shifts: Record<string, Shift>;
}
interface RightRow {
    doctor_id: string; doctor_name: string;
    right_code: string; right_name: string;
    visit_count: number; revenue: number;
}
interface IcdRow { icd10_code: string; icd10_name: string; use_count: number; }
interface QueueRow {
    queue_no: string; hn: string; patient_name: string;
    doctor_name: string; right_name: string; vsttime: string; status: string;
}
interface PatientRow {
    vstdate: string; vsttime: string; vn: string; hn: string; patient_name: string;
    doctor_id: string; doctor_name: string; right_code: string; right_name: string;
    icd10: string; icd10_name: string; revenue: number;
}
interface DashData {
    summary: { doctors: DoctorSummary[] };
    rights: { rows: RightRow[] };
    icd10: { rows: IcdRow[] };
    queue: { queue: QueueRow[] };
    patients: { rows: PatientRow[] };
}

type Preset = "today" | "7days" | "30days" | "thismonth" | "custom";
type Mode = "revenue" | "visits" | "patients";
type PivotMode = "revenue" | "visits" | "patients";
type ShiftKey = "am" | "pm" | "ot";

// ─── Constants / theme ──────────────────────────────────────────────────────
const REFRESH_SEC = 60;

const MINT = {
    50: "#f0faf4", 100: "#d6f0e0", 200: "#a8d5ba", 300: "#7ec8a0",
    400: "#55b882", 500: "#3aa36a", 600: "#2d8a56", 700: "#236b43", 800: "#1a5233",
};

const PRESET_LABEL: Record<Preset, string> = {
    today: "วันนี้", "7days": "7 วันล่าสุด", "30days": "30 วันล่าสุด",
    thismonth: "เดือนนี้", custom: "กำหนดเอง",
};

const BAR_PALETTE = ["#3aa36a", "#185FA5", "#6a1b9a", "#e65100", "#00695c"];
const PIE_PALETTE = ["#185FA5", "#880e4f", "#e65100", "#5b21b6", "#3aa36a", "#00695c"];

const DOC_TAG: string[] = [
    "bg-green-100 text-green-700",
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-800",
];

const shiftLabel: Record<ShiftKey, string> = { am: "เช้า", pm: "เย็น", ot: "นอกเวลา" };

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmtB = (n: number) =>
    Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getShift(vsttime: string): ShiftKey {
    const [h, m] = (vsttime || "00:00").split(":").map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    // เวรเช้าเริ่ม 06:00 → คนไข้ที่มา visit ก่อนเวลาทำการนับเป็นเช้า (ตรงกับ PT)
    if (mins >= 6 * 60 && mins < 16 * 60 + 30) return "am";
    if (mins >= 16 * 60 + 30 && mins < 20 * 60 + 30) return "pm";
    return "ot";
}
function rightBadgeClass(code: string): string {
    switch (code) {
        case "UC": return "bg-blue-100 text-blue-700";
        case "GOV": return "bg-indigo-100 text-indigo-700";
        case "SSO": return "bg-orange-100 text-orange-700";
        case "SELF": return "bg-purple-100 text-purple-700";
        default: return "bg-green-100 text-green-700";
    }
}
function shiftTagClass(s: ShiftKey): string {
    return s === "am" ? "bg-blue-100 text-blue-700"
        : s === "pm" ? "bg-purple-100 text-purple-700"
            : "bg-gray-100 text-gray-600";
}
function docCardShiftClass(name: string): string {
    return name.includes("เช้า") ? "bg-blue-100 text-blue-700"
        : name.includes("เย็น") ? "bg-purple-100 text-purple-700"
            : "bg-teal-100 text-teal-700";
}

const BADGE = "inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold";

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <th className={`text-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-left ${className}`}
            style={{ backgroundColor: MINT[300] }}>
            {children}
        </th>
    );
}

function Tr({ index, children }: { index: number; children: React.ReactNode }) {
    const base = index % 2 ? "#f9fafb" : "#ffffff";
    return (
        <tr className="border-b border-gray-100 transition-colors"
            style={{ backgroundColor: base }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = MINT[50])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = base)}>
            {children}
        </tr>
    );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
    if (!active) return <ChevronsUpDown size={12} className="inline opacity-40 ml-0.5" />;
    return asc
        ? <ChevronUp size={12} className="inline ml-0.5" />
        : <ChevronDown size={12} className="inline ml-0.5" />;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TtmDashboardPage() {
    const [data, setData] = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [preset, setPreset] = useState<Preset>("today");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [mode, setMode] = useState<Mode>("revenue");
    const [pivotMode, setPivotMode] = useState<PivotMode>("revenue");
    const [lastUpdate, setLastUpdate] = useState("—");
    const [secondsLeft, setSecondsLeft] = useState(REFRESH_SEC);

    // patient list controls
    const [ptSearch, setPtSearch] = useState("");
    const [ptDoctor, setPtDoctor] = useState("");
    const [ptRight, setPtRight] = useState("");
    const [ptShift, setPtShift] = useState("");
    const [ptSortKey, setPtSortKey] = useState<string>("vstdate");
    const [ptSortAsc, setPtSortAsc] = useState(true);

    // doctor → tag class (stable ตามลำดับที่พบ)
    const docColorMap = useRef<Record<string, string>>({});
    const getDocColor = (name: string) => {
        if (!docColorMap.current[name]) {
            const idx = Object.keys(docColorMap.current).length % DOC_TAG.length;
            docColorMap.current[name] = DOC_TAG[idx];
        }
        return docColorMap.current[name];
    };

    // ── fetch ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (preset === "custom") {
                if (!customStart || !customEnd) { setLoading(false); return; }
                params.set("start", customStart);
                params.set("end", customEnd);
            } else {
                params.set("preset", preset);
            }
            const res = await fetch(`/api/ttm-dashboard?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as DashData;
            setData(json);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            setSecondsLeft(REFRESH_SEC);
        }
    }, [preset, customStart, customEnd]);

    // initial + เมื่อเปลี่ยน preset (ยกเว้น custom — รอกดปุ่ม "ดู")
    useEffect(() => {
        if (preset !== "custom") fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preset]);

    // ── auto refresh 60s (timer คงที่ ใช้ ref กัน reset ตอนพิมพ์วันที่) ──
    const fetchRef = useRef(fetchData);
    useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);
    useEffect(() => {
        const f = setInterval(() => { fetchRef.current(); setSecondsLeft(REFRESH_SEC); }, REFRESH_SEC * 1000);
        const c = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : REFRESH_SEC)), 1000);
        return () => { clearInterval(f); clearInterval(c); };
    }, []);

    const handleRefresh = () => { fetchData(); setSecondsLeft(REFRESH_SEC); };

    // ── derived ──
    const doctors = data?.summary.doctors ?? [];
    const rightRows = data?.rights.rows ?? [];
    const icdRows = data?.icd10.rows ?? [];
    const queueRows = data?.queue.queue ?? [];
    const allPatients = data?.patients.rows ?? [];

    // ── KPI ──
    const kpi = useMemo(() => {
        let tp = 0, tv = 0, tr = 0;
        doctors.forEach((d) => { tp += d.patient_count; tv += d.visit_count; tr += d.revenue; });
        return { patients: tp, visits: tv, revenue: tr, avg: tv > 0 ? tr / tv : 0, queue: queueRows.length };
    }, [doctors, queueRows]);

    // ── bar (รายแพทย์) ──
    const barData = useMemo(() =>
        doctors.map((d) => ({
            name: d.doctor_name.split(" ").slice(-1)[0],
            value: mode === "revenue" ? d.revenue : mode === "visits" ? d.visit_count : d.patient_count,
        })), [doctors, mode]);

    // ── pie (สิทธิ์) ──
    const pieData = useMemo(() => {
        const agg: Record<string, number> = {};
        rightRows.forEach((r) => {
            agg[r.right_name] = (agg[r.right_name] || 0) + (mode === "revenue" ? r.revenue : r.visit_count);
        });
        return Object.entries(agg).map(([name, value], i) => ({
            name, value, color: PIE_PALETTE[i % PIE_PALETTE.length],
        }));
    }, [rightRows, mode]);

    // ── pivot (คำนวณ totals ล่วงหน้า — ไม่ mutate ตอน render) ──
    const pivot = useMemo(() => {
        const docs = [...new Set(rightRows.map((r) => r.doctor_name))];
        const rights = [...new Set(rightRows.map((r) => r.right_name))];
        const lookup: Record<string, number> = {};
        rightRows.forEach((r) => {
            // โหมด "ผู้ป่วย" ใช้ visit_count เป็น proxy (ไม่มี unique HN ต่อสิทธิ์)
            const v = pivotMode === "revenue" ? r.revenue : r.visit_count;
            const k = `${r.doctor_name}__${r.right_name}`;
            lookup[k] = (lookup[k] || 0) + v;
        });
        const rowTotals: Record<string, number> = {};
        docs.forEach((d) => (rowTotals[d] = rights.reduce((s, r) => s + (lookup[`${d}__${r}`] || 0), 0)));
        const colTotals: Record<string, number> = {};
        rights.forEach((r) => (colTotals[r] = docs.reduce((s, d) => s + (lookup[`${d}__${r}`] || 0), 0)));
        const grand = Object.values(rowTotals).reduce((s, v) => s + v, 0);
        return { docs, rights, lookup, rowTotals, colTotals, grand };
    }, [rightRows, pivotMode]);

    const pivFmt = (v: number) => (pivotMode === "revenue" ? fmtB(v) : fmt(v));

    // ── icd10 → HBarList ──
    const icdData = useMemo(
        () => icdRows.map((r) => ({ label: `${r.icd10_code} · ${r.icd10_name}`, count: r.use_count })),
        [icdRows],
    );

    // ── patient filter + sort ──
    const ptDoctors = useMemo(() => [...new Set(allPatients.map((r) => r.doctor_name))].sort(), [allPatients]);
    const ptRights = useMemo(() => [...new Set(allPatients.map((r) => r.right_name))].sort(), [allPatients]);

    const filteredPatients = useMemo(() => {
        const q = ptSearch.toLowerCase().trim();
        const rows = allPatients.filter((r) => {
            if (ptDoctor && r.doctor_name !== ptDoctor) return false;
            if (ptRight && r.right_name !== ptRight) return false;
            if (ptShift && getShift(r.vsttime) !== ptShift) return false;
            if (q) {
                const hay = `${r.hn} ${r.patient_name} ${r.icd10} ${r.icd10_name}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        return rows.slice().sort((a, b) => {
            let va: string | number = (a as never)[ptSortKey] ?? "";
            let vb: string | number = (b as never)[ptSortKey] ?? "";
            if (ptSortKey === "revenue") { va = Number(va); vb = Number(vb); }
            if (ptSortKey === "shift") { va = getShift(a.vsttime); vb = getShift(b.vsttime); }
            if (va < vb) return ptSortAsc ? -1 : 1;
            if (va > vb) return ptSortAsc ? 1 : -1;
            return 0;
        });
    }, [allPatients, ptSearch, ptDoctor, ptRight, ptShift, ptSortKey, ptSortAsc]);

    const totalRev = useMemo(
        () => filteredPatients.reduce((s, r) => s + Number(r.revenue || 0), 0),
        [filteredPatients],
    );

    const sortPt = (key: string) => {
        if (ptSortKey === key) setPtSortAsc((p) => !p);
        else { setPtSortKey(key); setPtSortAsc(true); }
    };

    const periodLabel = preset === "custom" ? `${customStart || "?"} – ${customEnd || "?"}` : PRESET_LABEL[preset];

    const PT_COLUMNS: [string, string][] = [
        ["vstdate", "วันที่"], ["hn", "HN"], ["patient_name", "ชื่อ-สกุล"],
        ["doctor_name", "แพทย์แผนไทย"], ["shift", "เวร"], ["right_name", "สิทธิ์"], ["icd10", "ICD-10"],
    ];

    const PeriodBadge = () => (
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ml-1"
            style={{ backgroundColor: MINT[50], borderColor: MINT[200], color: MINT[800] }}>
            {periodLabel}
        </span>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 text-gray-800">
            <style>{`@media print{.no-print{display:none!important}@page{size:A4 landscape;margin:1.2cm}}`}</style>

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Leaf size={18} style={{ color: MINT[800] }} />
                        <h1 className="text-lg font-bold text-gray-800">Dashboard แพทย์แผนไทย</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>รพ.พลับพลาชัย · HOSxP แบบ Real-time</span>
                        <span>·</span>
                        <Clock size={11} />
                        <span>อัปเดต {lastUpdate}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_SEC} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={handleRefresh} />
                    <ConnectionStatus error={!!error} connected={!!data && !error} />
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-3 flex flex-wrap items-center gap-3 no-print">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">ช่วงวันที่</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    {(["today", "7days", "30days", "thismonth", "custom"] as Preset[]).map((p) => (
                        <button key={p} onClick={() => setPreset(p)}
                            className="px-3 py-1.5 text-xs transition-colors"
                            style={{
                                backgroundColor: preset === p ? MINT[500] : "#fff",
                                color: preset === p ? "#fff" : "#4b5563",
                                fontWeight: preset === p ? 600 : 400,
                            }}>
                            {PRESET_LABEL[p]}
                        </button>
                    ))}
                </div>

                {preset === "custom" && (
                    <div className="flex items-center gap-2">
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]" />
                        <span className="text-xs text-gray-400">ถึง</span>
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]" />
                        <button onClick={fetchData}
                            className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg shadow-sm"
                            style={{ backgroundColor: MINT[500] }}>
                            ดู
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">แสดงค่า</span>
                    <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                        <option value="revenue">รายได้ (บาท)</option>
                        <option value="visits">จำนวน Visits</option>
                        <option value="patients">จำนวนผู้ป่วย</option>
                    </select>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-medium text-red-700">
                    ❌ โหลดข้อมูลไม่สำเร็จ: {error} — ตรวจสอบการเชื่อมต่อฐานข้อมูล/สิทธิ์การเข้าถึง
                </div>
            )}

            {/* Loading */}
            {loading && !data && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} h="h-[150px]" />)}
                    </div>
                    <Shimmer h="h-64" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Shimmer h="h-72" /><Shimmer h="h-72" />
                    </div>
                </>
            )}

            {/* Content */}
            {data && (
                <>
                    {/* KPI */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={fmt(kpi.patients)} sub="unique HN" accent="#1a5233" bg="#f0faf4" />
                        <KpiCard icon={Activity} label="Visits ทั้งหมด" value={fmt(kpi.visits)} sub="ครั้ง" accent="#0369A1" bg="#E0F2FE" />
                        <KpiCard icon={Banknote} label="รายได้รวม" value={fmtB(kpi.revenue)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
                        <KpiCard icon={Coins} label="รายได้เฉลี่ย/Visit" value={kpi.visits > 0 ? fmtB(kpi.avg) : "—"} sub="บาท/ครั้ง" accent="#5B21B6" bg="#EDE9FE" />
                        <KpiCard icon={ListChecks} label="คิวรอ ณ ขณะนี้" value={fmt(kpi.queue)} sub="ราย" accent="#065F46" bg="#D1FAE5" />
                    </div>

                    {/* Doctor cards */}
                    <SectionCard title="สรุปรายแพทย์แผนไทย" icon={Users} titleColor={MINT[800]}>
                        <div className="flex items-center gap-2 mb-3 -mt-2"><PeriodBadge /></div>
                        {doctors.length === 0 ? (
                            <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {doctors.map((d) => (
                                    <div key={d.doctor_id} className="border border-gray-200 rounded-xl p-4" style={{ backgroundColor: MINT[50] }}>
                                        <div className="font-bold text-sm mb-3" style={{ color: MINT[800] }}>👤 {d.doctor_name}</div>
                                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                            {[
                                                { v: fmt(d.patient_count), l: "ผู้ป่วย" },
                                                { v: fmt(d.visit_count), l: "Visits" },
                                                { v: fmtB(d.revenue), l: "บาท" },
                                            ].map((s, i) => (
                                                <div key={i} className="bg-white rounded-lg py-2 border border-gray-100">
                                                    <div className="text-base font-extrabold tabular-nums" style={{ color: MINT[600] }}>{s.v}</div>
                                                    <div className="text-[10px] text-gray-400">{s.l}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-1">
                                            {Object.entries(d.shifts).map(([name, s]) => (
                                                <div key={name} className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs ${docCardShiftClass(name)}`}>
                                                    <span>{name}</span>
                                                    <span className="font-bold">{fmt(s.visit_count)} visits / {fmtB(s.revenue)} ฿</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="รายได้/จำนวน รายแพทย์" icon={BarChart3} titleColor={MINT[800]}>
                            {barData.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <RTooltip
                                            formatter={(v) => [mode === "revenue" ? fmtB(Number(v ?? 0)) : fmt(Number(v ?? 0)), mode === "revenue" ? "บาท" : mode === "visits" ? "Visits" : "ผู้ป่วย"]}
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                        />
                                        <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                                            {barData.map((_, i) => <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </SectionCard>

                        <SectionCard title="สิทธิ์การรักษา" icon={Wallet} titleColor={MINT[800]}>
                            {pieData.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                                                {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                                            </Pie>
                                            <RTooltip
                                                formatter={(v) => mode === "revenue" ? fmtB(Number(v ?? 0)) : fmt(Number(v ?? 0))}
                                                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
                                        {pieData.map((d) => (
                                            <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                                                {d.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Pivot */}
                    <SectionCard title="ตาราง Pivot: แพทย์แผนไทย × สิทธิ์การรักษา" icon={Table2} titleColor={MINT[800]}>
                        <div className="flex gap-2 mb-3 no-print">
                            {(["revenue", "visits", "patients"] as PivotMode[]).map((m) => (
                                <button key={m} onClick={() => setPivotMode(m)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs border transition-colors"
                                    style={{
                                        backgroundColor: pivotMode === m ? MINT[500] : "#fff",
                                        color: pivotMode === m ? "#fff" : "#4b5563",
                                        borderColor: pivotMode === m ? MINT[500] : "#e5e7eb",
                                        fontWeight: pivotMode === m ? 600 : 400,
                                    }}>
                                    {m === "revenue" ? "รายได้" : m === "visits" ? "Visits" : "ผู้ป่วย"}
                                </button>
                            ))}
                        </div>
                        {pivot.docs.length === 0 ? (
                            <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <Th>แพทย์แผนไทย</Th>
                                            {pivot.rights.map((r) => <Th key={r} className="!text-right">{r}</Th>)}
                                            <Th className="!text-right">รวม</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pivot.docs.map((doc, i) => (
                                            <Tr key={doc} index={i}>
                                                <td className="px-3 py-2 text-gray-800 font-medium">{doc}</td>
                                                {pivot.rights.map((r) => (
                                                    <td key={r} className="px-3 py-2 text-right text-gray-700">{pivFmt(pivot.lookup[`${doc}__${r}`] || 0)}</td>
                                                ))}
                                                <td className="px-3 py-2 text-right font-bold" style={{ color: MINT[800], backgroundColor: MINT[50] }}>{pivFmt(pivot.rowTotals[doc] || 0)}</td>
                                            </Tr>
                                        ))}
                                        <tr style={{ backgroundColor: MINT[100] }}>
                                            <td className="px-3 py-2 font-bold text-gray-800">รวมทั้งหมด</td>
                                            {pivot.rights.map((r) => (
                                                <td key={r} className="px-3 py-2 text-right font-bold" style={{ color: MINT[800] }}>{pivFmt(pivot.colTotals[r] || 0)}</td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-extrabold" style={{ color: MINT[800] }}>{pivFmt(pivot.grand)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>

                    {/* ICD10 + Queue */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="รหัสวินิจฉัย ICD-10 ที่ใช้บ่อย" icon={Tags} titleColor={MINT[800]}>
                            {icdData.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                            ) : (
                                <HBarList data={icdData} colors={[MINT[500]]} labelWidth={170} />
                            )}
                        </SectionCard>

                        <SectionCard title="คิวรอรับบริการ ณ ปัจจุบัน" icon={ListChecks} titleColor={MINT[800]}>
                            {queueRows.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">ไม่มีคิวรอบริการ</p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full text-sm border-collapse">
                                        <thead>
                                            <tr>
                                                <Th>คิว</Th><Th>HN</Th><Th>ชื่อ</Th><Th>แพทย์</Th>
                                                <Th>สิทธิ์</Th><Th>เวลา</Th><Th>สถานะ</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {queueRows.map((r, i) => (
                                                <Tr key={r.queue_no + r.hn} index={i}>
                                                    <td className="px-3 py-2 font-bold" style={{ color: MINT[800] }}>{r.queue_no}</td>
                                                    <td className="px-3 py-2 font-mono text-gray-600">{r.hn}</td>
                                                    <td className="px-3 py-2 text-gray-800">{r.patient_name}</td>
                                                    <td className="px-3 py-2 text-gray-700">{r.doctor_name}</td>
                                                    <td className="px-3 py-2"><span className={`${BADGE} bg-green-100 text-green-700`}>{r.right_name}</span></td>
                                                    <td className="px-3 py-2 text-gray-600">{r.vsttime || "—"}</td>
                                                    <td className={`px-3 py-2 font-semibold ${r.status === "กำลังรับบริการ" ? "text-green-600" : "text-amber-600"}`}>{r.status}</td>
                                                </Tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Patient list */}
                    <SectionCard title="รายชื่อผู้ป่วย" icon={Users} titleColor={MINT[800]}>
                        <div className="flex items-center gap-2 mb-3 -mt-2"><PeriodBadge /></div>

                        <div className="flex flex-wrap gap-2 mb-4 no-print">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" placeholder="ค้นหา HN / ชื่อ-สกุล / ICD-10" value={ptSearch}
                                    onChange={(e) => setPtSearch(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0] transition-colors" />
                            </div>
                            <select value={ptDoctor} onChange={(e) => setPtDoctor(e.target.value)}
                                className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                                <option value="">— แพทย์ทุกคน —</option>
                                {ptDoctors.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={ptRight} onChange={(e) => setPtRight(e.target.value)}
                                className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                                <option value="">— สิทธิ์ทุกประเภท —</option>
                                {ptRights.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select value={ptShift} onChange={(e) => setPtShift(e.target.value)}
                                className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                                <option value="">— ทุกเวร —</option>
                                <option value="am">เช้า (08:30-16:30)</option>
                                <option value="pm">เย็น (16:30-20:30)</option>
                                <option value="ot">นอกเวลา</option>
                            </select>
                            <span className="ml-auto self-center text-xs text-gray-400">แสดง {filteredPatients.length} รายการ</span>
                        </div>

                        <div className="overflow-auto max-h-[440px] rounded-xl border border-gray-200">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        {PT_COLUMNS.map(([key, label]) => (
                                            <th key={key} onClick={() => sortPt(key)}
                                                className="sticky top-0 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-left cursor-pointer select-none"
                                                style={{ backgroundColor: MINT[300] }}>
                                                {label}<SortIcon active={ptSortKey === key} asc={ptSortAsc} />
                                            </th>
                                        ))}
                                        <th onClick={() => sortPt("revenue")}
                                            className="sticky top-0 text-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-right cursor-pointer select-none"
                                            style={{ backgroundColor: MINT[300] }}>
                                            รายได้ (฿)<SortIcon active={ptSortKey === "revenue"} asc={ptSortAsc} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center text-gray-400 py-6 text-sm">ไม่มีข้อมูลผู้ป่วย</td></tr>
                                    ) : (
                                        filteredPatients.map((r, i) => {
                                            const sh = getShift(r.vsttime);
                                            return (
                                                <Tr key={r.vn + i} index={i}>
                                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatThaiDate(r.vstdate) || "—"} {(r.vsttime || "").slice(0, 5)}</td>
                                                    <td className="px-3 py-2 font-mono font-semibold text-gray-700">{r.hn}</td>
                                                    <td className="px-3 py-2 text-gray-800">{r.patient_name}</td>
                                                    <td className="px-3 py-2"><span className={`${BADGE} ${getDocColor(r.doctor_name)}`}>{r.doctor_name}</span></td>
                                                    <td className="px-3 py-2"><span className={`${BADGE} ${shiftTagClass(sh)}`}>{shiftLabel[sh]}</span></td>
                                                    <td className="px-3 py-2"><span className={`${BADGE} ${rightBadgeClass(r.right_code)}`}>{r.right_name}</span></td>
                                                    <td className="px-3 py-2 text-gray-600 text-xs"><b className="font-mono">{r.icd10}</b> {r.icd10_name}</td>
                                                    <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmtB(r.revenue)}</td>
                                                </Tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: MINT[100] }}>
                                        <td colSpan={7} className="px-3 py-2 font-bold text-gray-800">รวม</td>
                                        <td className="px-3 py-2 text-right font-extrabold" style={{ color: MINT[800] }}>
                                            {filteredPatients.length ? fmtB(totalRev) : "—"}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </SectionCard>
                </>
            )}
        </div>
    );
}