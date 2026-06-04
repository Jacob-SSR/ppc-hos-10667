"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
    LayoutDashboard, ListChecks, Wrench, Ticket, TrendingUp, Clock,
    Banknote, Users, Wallet, Download, Search, Stethoscope,
} from "lucide-react";
import {
    CountdownRing, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { SectionCard } from "@/app/components/dashboard/live";
import { Shimmer } from "@/app/components/ui/Shimmer";
import { KpiCard } from "@/app/components/dashboard/live";

// ─── Types ──────────────────────────────────────────────────────────────────
type StaffType = "ทันตแพทย์" | "ทันตาภิบาล" | "อื่นๆ";
type ShiftCode = "wd_am" | "wd_pm" | "wknd" | "off";
interface SummaryRow { doctor_name: string; staff_type: StaffType; patient_count: number; visit_count: number; total_income: number; }
interface QueueRow { vn: string; hn: string; patient_name: string; doctor_name: string; staff_type: StaffType; visit_time: string; chief_complaint: string; }
interface ProcRow { doctor_name: string; staff_type: StaffType; procedure_code: string; procedure_name: string; count: number; }
interface PttypeRow { doctor_name: string; staff_type: StaffType; pttype_name: string; count: number; }
interface TrendRow { vstdate: string; staff_type: StaffType; patient_count: number; total_income: number; }
interface ShiftRow { shift_code: ShiftCode; staff_type: StaffType; pttype_name: string; patient_count: number; visit_count: number; total_income: number; }
interface IncomeRow { doctor_name: string; staff_type: StaffType; pttype_name: string; total_income: number; patient_count: number; visit_count: number; }
interface PatientRow { vstdate: string; vsttime: string; hn: string; vn: string; patient_name: string; age: number | null; doctor_name: string; staff_type: StaffType; pttype_name: string; chief_complaint: string; procedures: string; total_income: number; }
interface ApiResp {
    updatedAt: string; start: string; end: string;
    summary: SummaryRow[]; queue: QueueRow[]; procedures: ProcRow[]; pttype: PttypeRow[];
    daily_trend: TrendRow[]; shift_report: ShiftRow[]; income_by_doctor_pttype: IncomeRow[]; patient_list: PatientRow[];
}

type TabId = "today" | "queue" | "procedure" | "pttype" | "trend" | "shift" | "income" | "patients";
type Preset = "today" | "7days" | "30days" | "thismonth" | "custom";
type IncomeMode = "income" | "patient" | "visit";

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "today", label: "ภาพรวม", Icon: LayoutDashboard },
    { id: "queue", label: "คิวรอ", Icon: ListChecks },
    { id: "procedure", label: "หัตถการ", Icon: Wrench },
    { id: "pttype", label: "สิทธิ", Icon: Ticket },
    { id: "trend", label: "แนวโน้ม", Icon: TrendingUp },
    { id: "shift", label: "เวร & สิทธิ์", Icon: Clock },
    { id: "income", label: "รายได้รายแพทย์", Icon: Banknote },
    { id: "patients", label: "รายชื่อผู้ป่วย", Icon: Users },
];

const PRESET_LABEL: Record<Preset, string> = {
    today: "วันนี้", "7days": "7 วัน", "30days": "30 วัน", thismonth: "เดือนนี้", custom: "กำหนดเอง",
};

const SHIFT_ORDER: ShiftCode[] = ["wd_am", "wd_pm", "wknd", "off"];
const SHIFT_META: Record<ShiftCode, { label: string; short: string; color: string }> = {
    wd_am: { label: "วันธรรมดา เช้า (08:30–16:30)", short: "ธ.เช้า", color: "#2980b9" },
    wd_pm: { label: "วันธรรมดา เย็น (16:30–20:30)", short: "ธ.เย็น", color: "#8e44ad" },
    wknd: { label: "เสาร์-อาทิตย์ (08:30–16:30)", short: "ส-อา", color: "#e67e22" },
    off: { label: "นอกเวร / ไม่ระบุ", short: "นอกเวร", color: "#95a5a6" },
};
const STAFF_TYPES: StaffType[] = ["ทันตแพทย์", "ทันตาภิบาล"];
const STAFF_COLOR: Record<StaffType, string> = { "ทันตแพทย์": "#185FA5", "ทันตาภิบาล": "#3aa36a", "อื่นๆ": "#8e44ad" };
const PTTYPE_COLORS = ["#185FA5", "#3aa36a", "#8e44ad", "#e67e22", "#c0392b", "#16a085", "#d35400", "#7f8c8d"];

const MINT = {
    50: "#f0faf4", 100: "#d6f0e0", 200: "#a8d5ba", 300: "#7ec8a0",
    400: "#55b882", 500: "#3aa36a", 600: "#2d8a56", 700: "#236b43", 800: "#1a5233",
};
const REFRESH_SEC = 60;

const fmt = (n: number | string) => Number(n || 0).toLocaleString("th-TH");
const fmtB = (n: number | string) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BADGE = "inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold";
function staffBadgeClass(t: StaffType) {
    return t === "ทันตแพทย์" ? "bg-blue-100 text-blue-700"
        : t === "ทันตาภิบาล" ? "bg-green-100 text-green-700"
            : "bg-purple-100 text-purple-700";
}
function StaffBadge({ t }: { t: StaffType }) {
    return <span className={`${BADGE} ${staffBadgeClass(t)}`}>{t}</span>;
}

// ─── table helpers ──────────────────────────────────────────────────────────
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <th className={`text-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-left ${className}`}
            style={{ backgroundColor: MINT[300] }}>{children}</th>
    );
}
function Tr({ index, children }: { index: number; children: React.ReactNode }) {
    const base = index % 2 ? "#f9fafb" : "#ffffff";
    return (
        <tr className="border-b border-gray-100 transition-colors" style={{ backgroundColor: base }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = MINT[50])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = base)}>{children}</tr>
    );
}
const Empty = ({ msg = "ไม่พบข้อมูล" }: { msg?: string }) =>
    <p className="text-center text-gray-400 py-10 text-sm">{msg}</p>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function DentalDashboardPage() {
    const [preset, setPreset] = useState<Preset>("today");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [data, setData] = useState<ApiResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<TabId>("today");
    const [secondsLeft, setSecondsLeft] = useState(REFRESH_SEC);

    // patient filters
    const [pq, setPq] = useState("");
    const [fStaff, setFStaff] = useState("");
    const [fDoctor, setFDoctor] = useState("");
    const [fPttype, setFPttype] = useState("");
    const [incomeMode, setIncomeMode] = useState<IncomeMode>("income");

    // ── fetch ──
    const load = useCallback(async () => {
        if (preset === "custom" && (!customFrom || !customTo)) return;
        setLoading(true); setErr(null);
        try {
            const url = preset === "custom"
                ? `/api/dental-dashboard?start=${customFrom}&end=${customTo}`
                : `/api/dental-dashboard?preset=${preset}`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) {
            setErr(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
            setData(null);
        } finally {
            setLoading(false);
            setSecondsLeft(REFRESH_SEC);
        }
    }, [preset, customFrom, customTo]);

    useEffect(() => { load(); }, [load]);

    const loadRef = useRef(load);
    useEffect(() => { loadRef.current = load; }, [load]);
    useEffect(() => {
        const f = setInterval(() => { loadRef.current(); setSecondsLeft(REFRESH_SEC); }, REFRESH_SEC * 1000);
        const c = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : REFRESH_SEC)), 1000);
        return () => { clearInterval(f); clearInterval(c); };
    }, []);

    const handleRefresh = () => { load(); setSecondsLeft(REFRESH_SEC); };

    const rangeLabel = data ? (data.start === data.end ? data.start : `${data.start} – ${data.end}`) : "";

    // ── KPI ──
    const kpi = useMemo(() => {
        const s = data?.summary || [];
        return {
            totalPatients: s.reduce((a, r) => a + r.patient_count, 0),
            dentistVisits: s.filter((r) => r.staff_type === "ทันตแพทย์").reduce((a, r) => a + r.visit_count, 0),
            therapistVisits: s.filter((r) => r.staff_type === "ทันตาภิบาล").reduce((a, r) => a + r.visit_count, 0),
            totalIncome: s.reduce((a, r) => a + r.total_income, 0),
        };
    }, [data]);

    // ── today pie ──
    const todayPie = useMemo(() => {
        const s = data?.summary || [];
        const cnt = (t: StaffType) => s.filter((r) => r.staff_type === t).reduce((a, r) => a + r.patient_count, 0);
        return (["ทันตแพทย์", "ทันตาภิบาล", "อื่นๆ"] as StaffType[])
            .map((t) => ({ name: t, value: cnt(t), color: STAFF_COLOR[t] }))
            .filter((d) => d.value > 0);
    }, [data]);

    // ── trend (คำนวณ totals ไว้ล่วงหน้า) ──
    const trendDerived = useMemo(() => {
        const rows = data?.daily_trend || [];
        const dates = [...new Set(rows.map((r) => r.vstdate))].sort();
        const find = (d: string, st: StaffType) => rows.find((x) => x.vstdate === d && x.staff_type === st);
        const chart = dates.map((d) => {
            const den = find(d, "ทันตแพทย์"); const the = find(d, "ทันตาภิบาล");
            return {
                label: d,
                dentistPt: den?.patient_count || 0, therapistPt: the?.patient_count || 0,
                dentistInc: den?.total_income || 0, therapistInc: the?.total_income || 0,
            };
        });
        const table = dates.slice().reverse().map((d) => {
            const den = find(d, "ทันตแพทย์"); const the = find(d, "ทันตาภิบาล");
            const tp = (den?.patient_count || 0) + (the?.patient_count || 0);
            const ti = (den?.total_income || 0) + (the?.total_income || 0);
            return { d, denPt: den?.patient_count || 0, thePt: the?.patient_count || 0, tp, denInc: den?.total_income || 0, theInc: the?.total_income || 0, ti };
        });
        return { dates, chart, table };
    }, [data]);

    // ── shift (totals + per-shift pttype ล่วงหน้า) ──
    const shiftDerived = useMemo(() => {
        const rows = data?.shift_report || [];
        const shifts = SHIFT_ORDER.filter((s) => rows.some((r) => r.shift_code === s));
        const sum = (sh: ShiftCode, st: StaffType, key: "patient_count" | "total_income" | "visit_count") =>
            rows.filter((r) => r.shift_code === sh && r.staff_type === st).reduce((a, r) => a + r[key], 0);

        const ptChart = shifts.map((sh) => ({ label: SHIFT_META[sh].short, "ทันตแพทย์": sum(sh, "ทันตแพทย์", "patient_count"), "ทันตาภิบาล": sum(sh, "ทันตาภิบาล", "patient_count") }));
        const incChart = shifts.map((sh) => ({ label: SHIFT_META[sh].short, "ทันตแพทย์": sum(sh, "ทันตแพทย์", "total_income"), "ทันตาภิบาล": sum(sh, "ทันตาภิบาล", "total_income") }));
        const kpis = shifts.map((sh) => {
            const sr = rows.filter((r) => r.shift_code === sh);
            return { sh, pt: sr.reduce((a, r) => a + r.patient_count, 0), inc: sr.reduce((a, r) => a + r.total_income, 0) };
        });
        const cross = shifts.flatMap((sh) => STAFF_TYPES.map((st) => {
            const sub = rows.filter((r) => r.shift_code === sh && r.staff_type === st);
            return { sh, st, pt: sub.reduce((a, r) => a + r.patient_count, 0), vis: sub.reduce((a, r) => a + r.visit_count, 0), inc: sub.reduce((a, r) => a + r.total_income, 0) };
        }));
        const byShiftPttype: Record<string, { staff_type: StaffType; pttype_name: string; patient_count: number; total_income: number }[]> = {};
        shifts.forEach((sh) => {
            const m = new Map<string, { staff_type: StaffType; pttype_name: string; patient_count: number; total_income: number }>();
            rows.filter((r) => r.shift_code === sh).forEach((r) => {
                const k = `${r.staff_type}|${r.pttype_name}`;
                const o = m.get(k) ?? { staff_type: r.staff_type, pttype_name: r.pttype_name, patient_count: 0, total_income: 0 };
                o.patient_count += r.patient_count; o.total_income += r.total_income;
                m.set(k, o);
            });
            byShiftPttype[sh] = [...m.values()].sort((a, b) => b.patient_count - a.patient_count);
        });
        return { rows, shifts, ptChart, incChart, kpis, cross, byShiftPttype };
    }, [data]);

    // ── income (totals ล่วงหน้า — ไม่ mutate ตอน render) ──
    const incomeDerived = useMemo(() => {
        const rows = data?.income_by_doctor_pttype || [];
        const pick = (r: IncomeRow) => incomeMode === "income" ? r.total_income : incomeMode === "patient" ? r.patient_count : r.visit_count;
        const doctors = [...new Map(rows.map((r) => [r.doctor_name, { name: r.doctor_name, type: r.staff_type }])).values()]
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "th") : a.type.localeCompare(b.type)));
        const pttypes = [...new Set(rows.map((r) => r.pttype_name))].sort();
        const lookup: Record<string, number> = {};
        rows.forEach((r) => { const k = `${r.doctor_name}__${r.pttype_name}`; lookup[k] = (lookup[k] || 0) + pick(r); });
        const getV = (dn: string, pt: string) => lookup[`${dn}__${pt}`] || 0;
        const rowTotals: Record<string, number> = {};
        doctors.forEach((d) => (rowTotals[d.name] = pttypes.reduce((s, pt) => s + getV(d.name, pt), 0)));
        const grandPt: Record<string, number> = {};
        pttypes.forEach((pt) => (grandPt[pt] = doctors.reduce((s, d) => s + getV(d.name, pt), 0)));
        const grand = Object.values(rowTotals).reduce((s, v) => s + v, 0);
        const maxPerDoctor = Math.max(1, ...Object.values(rowTotals));
        const sortedPt = pttypes.slice().sort((a, b) => grandPt[b] - grandPt[a]);
        const barData = doctors.map((d) => {
            const o: Record<string, number | string> = { name: d.name };
            pttypes.forEach((pt) => (o[pt] = getV(d.name, pt)));
            return o;
        });
        const pieData = pttypes.map((pt, i) => ({ name: pt, value: grandPt[pt], color: PTTYPE_COLORS[i % PTTYPE_COLORS.length] }));
        return { rows, doctors, pttypes, getV, rowTotals, grandPt, grand, maxPerDoctor, sortedPt, barData, pieData };
    }, [data, incomeMode]);

    const incFmt = (v: number) => (incomeMode === "income" ? fmtB(v) : fmt(v));
    const incomeLabel = incomeMode === "income" ? "รายได้ (บาท)" : incomeMode === "patient" ? "ผู้ป่วย (ราย)" : "Visits";

    // ── patient list ──
    const patientFiltered = useMemo(() => {
        const rows = data?.patient_list || [];
        const q = pq.toLowerCase();
        return rows.filter((r) =>
            (!q || [r.patient_name, r.hn, r.vn, r.chief_complaint, r.procedures].join(" ").toLowerCase().includes(q)) &&
            (!fStaff || r.staff_type === fStaff) &&
            (!fDoctor || r.doctor_name === fDoctor) &&
            (!fPttype || r.pttype_name === fPttype));
    }, [data, pq, fStaff, fDoctor, fPttype]);

    const patientDoctors = useMemo(() => [...new Set((data?.patient_list || []).map((r) => r.doctor_name))].sort(), [data]);
    const patientPttypes = useMemo(() => [...new Set((data?.patient_list || []).map((r) => r.pttype_name))].sort(), [data]);

    const patientStats = useMemo(() => ({
        patients: new Set(patientFiltered.map((r) => r.hn)).size,
        visits: patientFiltered.length,
        income: patientFiltered.reduce((s, r) => s + r.total_income, 0),
    }), [patientFiltered]);

    const patientGroups = useMemo(() => {
        const docs = [...new Map(patientFiltered.map((r) => [r.doctor_name, { name: r.doctor_name, type: r.staff_type }])).values()]
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "th") : a.type.localeCompare(b.type)));
        return docs.map((doc) => {
            const dRows = patientFiltered.filter((r) => r.doctor_name === doc.name);
            return { doc, dRows, dIncome: dRows.reduce((s, r) => s + r.total_income, 0), dPt: new Set(dRows.map((r) => r.hn)).size };
        });
    }, [patientFiltered]);

    const exportCSV = () => {
        const rows = patientFiltered;
        if (!rows.length) return;
        const headers = ["วันที่", "เวลา", "HN", "VN", "ชื่อ-นามสกุล", "อายุ", "บุคลากร", "ประเภท", "สิทธิ์", "อาการสำคัญ", "หัตถการ", "รายได้"];
        const lines = [headers.join(",")];
        rows.forEach((r) => lines.push([r.vstdate, r.vsttime || "", r.hn, r.vn, `"${r.patient_name}"`, r.age ?? "", `"${r.doctor_name}"`, r.staff_type, `"${r.pttype_name}"`, `"${(r.chief_complaint || "").replace(/"/g, "'")}"`, `"${(r.procedures || "").replace(/"/g, "'")}"`, r.total_income].join(",")));
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `dental_patients_${data?.start}_${data?.end}.csv`;
        a.click();
    };

    const RangeBadge = () =>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
            style={{ backgroundColor: MINT[50], borderColor: MINT[200], color: MINT[800] }}>{rangeLabel}</span>;

    const chartTooltip = { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } as const;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 text-gray-800">
            <style>{`@media print{.no-print{display:none!important}@page{size:A4 landscape;margin:1.2cm}}`}</style>

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Stethoscope size={18} style={{ color: MINT[800] }} />
                        <h1 className="text-lg font-bold text-gray-800">ระบบรายงานทันตกรรม</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>รพ.พลับพลาชัย · รีเฟรชทุก 60 วินาที</span>
                        {data && <><span>·</span><Clock size={11} /><span>อัปเดต {new Date(data.updatedAt).toLocaleTimeString("th-TH")}</span></>}
                    </p>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_SEC} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={handleRefresh} />
                    <ConnectionStatus error={!!err} connected={!!data && !err} />
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-2 py-1.5 flex gap-1 overflow-x-auto no-print">
                {TABS.map((t) => {
                    const A = t.Icon; const on = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
                            style={{ backgroundColor: on ? MINT[500] : "transparent", color: on ? "#fff" : "#4b5563", fontWeight: on ? 600 : 400 }}>
                            <A size={15} />{t.label}
                        </button>
                    );
                })}
            </div>

            {/* Date bar */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-3 flex flex-wrap items-center gap-3 no-print">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">ช่วงวันที่</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    {(["today", "7days", "30days", "thismonth", "custom"] as Preset[]).map((p) => (
                        <button key={p} onClick={() => setPreset(p)} className="px-3 py-1.5 text-xs transition-colors"
                            style={{ backgroundColor: preset === p ? MINT[500] : "#fff", color: preset === p ? "#fff" : "#4b5563", fontWeight: preset === p ? 600 : 400 }}>
                            {PRESET_LABEL[p]}
                        </button>
                    ))}
                </div>
                {preset === "custom" && (
                    <div className="flex items-center gap-2">
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]" />
                        <span className="text-xs text-gray-400">ถึง</span>
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]" />
                        <button onClick={load} className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg" style={{ backgroundColor: MINT[500] }}>ดู</button>
                    </div>
                )}
                {rangeLabel && <span className="ml-auto text-xs text-gray-400">{rangeLabel}</span>}
            </div>

            {/* Error */}
            {err && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-medium text-red-700">
                    ❌ เชื่อมต่อ API ไม่ได้: {err}
                </div>
            )}

            {/* ── TODAY ── */}
            {tab === "today" && (
                <>
                    {loading && !data ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="h-[150px]" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={fmt(kpi.totalPatients)} sub={`ราย · ${rangeLabel}`} accent="#1a5233" bg="#f0faf4" />
                            <KpiCard icon={Stethoscope} label="ทันตแพทย์" value={fmt(kpi.dentistVisits)} sub="Visits" accent="#185FA5" bg="#E6F1FB" />
                            <KpiCard icon={Users} label="ทันตาภิบาล" value={fmt(kpi.therapistVisits)} sub="Visits" accent="#065F46" bg="#D1FAE5" />
                            <KpiCard icon={Banknote} label="รายได้รวม" value={fmtB(kpi.totalIncome)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="รายละเอียดแยกผู้ให้บริการ" icon={Users} titleColor={MINT[800]}>
                            {loading ? <Empty msg="กำลังโหลด…" /> : (data?.summary.length ? (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full text-sm border-collapse">
                                        <thead><tr><Th>ชื่อ</Th><Th>ประเภท</Th><Th className="!text-right">ผู้ป่วย</Th><Th className="!text-right">Visits</Th><Th className="!text-right">รายได้</Th></tr></thead>
                                        <tbody>{data.summary.map((r, i) => (
                                            <Tr key={i} index={i}>
                                                <td className="px-3 py-2 text-gray-800">{r.doctor_name}</td>
                                                <td className="px-3 py-2"><StaffBadge t={r.staff_type} /></td>
                                                <td className="px-3 py-2 text-right text-gray-700">{fmt(r.patient_count)}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{fmt(r.visit_count)}</td>
                                                <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmtB(r.total_income)}</td>
                                            </Tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <Empty />)}
                        </SectionCard>

                        <SectionCard title="สัดส่วนผู้ป่วย" icon={Users} titleColor={MINT[800]}>
                            {todayPie.length === 0 ? <Empty /> : (
                                <div className="flex flex-col items-center">
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie data={todayPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                                                {todayPie.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                                            </Pie>
                                            <RTooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={chartTooltip} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                                        {todayPie.map((d) => (
                                            <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />{d.name} <strong className="text-gray-800">{fmt(d.value)}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </>
            )}

            {/* ── QUEUE ── */}
            {tab === "queue" && (
                <SectionCard title="คิวรอรับบริการ ณ ขณะนี้" icon={ListChecks} titleColor={MINT[800]}>
                    {data?.queue.length ? (
                        <div className="space-y-2">
                            {data.queue.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200"
                                    style={{ backgroundColor: MINT[50], borderLeft: `4px solid ${STAFF_COLOR[r.staff_type]}` }}>
                                    <div className="text-lg font-extrabold w-8 text-center" style={{ color: MINT[600] }}>{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-gray-800">{r.patient_name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                            HN: {r.hn} <StaffBadge t={r.staff_type} /> {r.doctor_name}{r.chief_complaint ? ` · ${r.chief_complaint}` : ""}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400">{r.visit_time}</div>
                                </div>
                            ))}
                        </div>
                    ) : <Empty msg="ไม่มีคิวรอขณะนี้" />}
                </SectionCard>
            )}

            {/* ── PROCEDURE ── */}
            {tab === "procedure" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {STAFF_TYPES.map((st) => {
                        const rows = (data?.procedures || []).filter((r) => r.staff_type === st);
                        return (
                            <SectionCard key={st} title={`หัตถการ — ${st}`} icon={Wrench} titleColor={MINT[800]}>
                                {rows.length ? (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="min-w-full text-sm border-collapse">
                                            <thead><tr><Th>ผู้ให้บริการ</Th><Th>รหัส (ICD-9)</Th><Th>หัตถการ</Th><Th className="!text-right">จำนวน</Th></tr></thead>
                                            <tbody>{rows.map((r, i) => (
                                                <Tr key={i} index={i}>
                                                    <td className="px-3 py-2 text-gray-800">{r.doctor_name}</td>
                                                    <td className="px-3 py-2 font-mono text-gray-600">{r.procedure_code}</td>
                                                    <td className="px-3 py-2 text-gray-700">{r.procedure_name}</td>
                                                    <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmt(r.count)}</td>
                                                </Tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                ) : <Empty />}
                            </SectionCard>
                        );
                    })}
                </div>
            )}

            {/* ── PTTYPE ── */}
            {tab === "pttype" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {STAFF_TYPES.map((st) => {
                        const rows = (data?.pttype || []).filter((r) => r.staff_type === st);
                        return (
                            <SectionCard key={st} title={`สิทธิการรักษา — ${st}`} icon={Ticket} titleColor={MINT[800]}>
                                {rows.length ? (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="min-w-full text-sm border-collapse">
                                            <thead><tr><Th>ผู้ให้บริการ</Th><Th>สิทธิ</Th><Th className="!text-right">จำนวน</Th></tr></thead>
                                            <tbody>{rows.map((r, i) => (
                                                <Tr key={i} index={i}>
                                                    <td className="px-3 py-2 text-gray-800">{r.doctor_name}</td>
                                                    <td className="px-3 py-2 text-gray-700">{r.pttype_name}</td>
                                                    <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmt(r.count)}</td>
                                                </Tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                ) : <Empty />}
                            </SectionCard>
                        );
                    })}
                </div>
            )}

            {/* ── TREND ── */}
            {tab === "trend" && (
                <div className="space-y-4">
                    <SectionCard title={`จำนวนผู้ป่วย · ${rangeLabel}`} icon={TrendingUp} titleColor={MINT[800]}>
                        {trendDerived.chart.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={trendDerived.chart} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RTooltip contentStyle={chartTooltip} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line type="monotone" dataKey="dentistPt" name="ทันตแพทย์" stroke={STAFF_COLOR["ทันตแพทย์"]} strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="therapistPt" name="ทันตาภิบาล" stroke={STAFF_COLOR["ทันตาภิบาล"]} strokeWidth={2.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </SectionCard>

                    <SectionCard title={`รายได้ · ${rangeLabel} (บาท)`} icon={Banknote} titleColor={MINT[800]}>
                        {trendDerived.chart.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={trendDerived.chart} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RTooltip formatter={(v, n) => [fmtB(Number(v ?? 0)), n]} contentStyle={chartTooltip} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="dentistInc" name="ทันตแพทย์" stackId="a" fill={STAFF_COLOR["ทันตแพทย์"]} />
                                    <Bar dataKey="therapistInc" name="ทันตาภิบาล" stackId="a" fill={STAFF_COLOR["ทันตาภิบาล"]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </SectionCard>

                    <SectionCard title="ตารางสรุปรายวัน" icon={TrendingUp} titleColor={MINT[800]}>
                        {trendDerived.table.length === 0 ? <Empty /> : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead><tr><Th>วันที่</Th><Th className="!text-right">ผู้ป่วย ทพ.</Th><Th className="!text-right">ผู้ป่วย ทภ.</Th><Th className="!text-right">รวมผู้ป่วย</Th><Th className="!text-right">รายได้ ทพ.</Th><Th className="!text-right">รายได้ ทภ.</Th><Th className="!text-right">รวมรายได้</Th></tr></thead>
                                    <tbody>{trendDerived.table.map((r, i) => (
                                        <Tr key={r.d} index={i}>
                                            <td className="px-3 py-2 text-gray-700">{r.d}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmt(r.denPt)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmt(r.thePt)}</td>
                                            <td className="px-3 py-2 text-right font-bold text-gray-900">{fmt(r.tp)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmtB(r.denInc)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmtB(r.theInc)}</td>
                                            <td className="px-3 py-2 text-right font-bold" style={{ color: MINT[800] }}>{fmtB(r.ti)}</td>
                                        </Tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ── SHIFT ── */}
            {tab === "shift" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {shiftDerived.kpis.map(({ sh, pt, inc }) => {
                            const m = SHIFT_META[sh];
                            return (
                                <div key={sh} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4" style={{ borderLeft: `5px solid ${m.color}` }}>
                                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{m.label}</div>
                                    <div className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: m.color }}>{fmt(pt)}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">ราย · รายได้ {fmtB(inc)} บาท</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="ผู้ป่วยแยกเวร (ราย)" icon={Clock} titleColor={MINT[800]}>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={shiftDerived.ptChart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RTooltip contentStyle={chartTooltip} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="ทันตแพทย์" stackId="a" fill={STAFF_COLOR["ทันตแพทย์"]} />
                                    <Bar dataKey="ทันตาภิบาล" stackId="a" fill={STAFF_COLOR["ทันตาภิบาล"]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>
                        <SectionCard title="รายได้แยกเวร (บาท)" icon={Banknote} titleColor={MINT[800]}>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={shiftDerived.incChart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RTooltip formatter={(v, n) => [fmtB(Number(v ?? 0)), n]} contentStyle={chartTooltip} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="ทันตแพทย์" stackId="a" fill={STAFF_COLOR["ทันตแพทย์"]} />
                                    <Bar dataKey="ทันตาภิบาล" stackId="a" fill={STAFF_COLOR["ทันตาภิบาล"]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>
                    </div>

                    <SectionCard title="ตารางสรุปแยกเวร × ประเภทบุคลากร" icon={Clock} titleColor={MINT[800]}>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="min-w-full text-sm border-collapse">
                                <thead><tr><Th>เวร</Th><Th>บุคลากร</Th><Th className="!text-right">ผู้ป่วย</Th><Th className="!text-right">Visits</Th><Th className="!text-right">รายได้</Th></tr></thead>
                                <tbody>{shiftDerived.cross.map((r, i) => {
                                    const m = SHIFT_META[r.sh];
                                    return (
                                        <Tr key={r.sh + r.st} index={i}>
                                            <td className="px-3 py-2 text-gray-700">
                                                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
                                            </td>
                                            <td className="px-3 py-2"><StaffBadge t={r.st} /></td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmt(r.pt)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{fmt(r.vis)}</td>
                                            <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmtB(r.inc)}</td>
                                        </Tr>
                                    );
                                })}</tbody>
                            </table>
                        </div>
                    </SectionCard>

                    {shiftDerived.shifts.map((sh) => {
                        const m = SHIFT_META[sh];
                        const rows = shiftDerived.byShiftPttype[sh] || [];
                        return (
                            <div key={sh} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5" style={{ borderTop: `4px solid ${m.color}` }}>
                                <p className="text-sm font-bold mb-3" style={{ color: MINT[800] }}>{m.label} — สิทธิ์การรักษา</p>
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full text-sm border-collapse">
                                        <thead><tr><Th>บุคลากร</Th><Th>สิทธิ์</Th><Th className="!text-right">ผู้ป่วย</Th><Th className="!text-right">รายได้</Th></tr></thead>
                                        <tbody>{rows.map((r, i) => (
                                            <Tr key={i} index={i}>
                                                <td className="px-3 py-2"><StaffBadge t={r.staff_type} /></td>
                                                <td className="px-3 py-2 text-gray-700">{r.pttype_name}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{fmt(r.patient_count)}</td>
                                                <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{fmtB(r.total_income)}</td>
                                            </Tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── INCOME ── */}
            {tab === "income" && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap no-print">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">แสดงค่า</span>
                        {([["income", "รายได้ (บาท)"], ["patient", "จำนวนผู้ป่วย"], ["visit", "Visits"]] as [IncomeMode, string][]).map(([m, l]) => (
                            <button key={m} onClick={() => setIncomeMode(m)} className="px-3.5 py-1.5 rounded-lg text-xs border transition-colors"
                                style={{ backgroundColor: incomeMode === m ? MINT[500] : "#fff", color: incomeMode === m ? "#fff" : "#4b5563", borderColor: incomeMode === m ? MINT[500] : "#e5e7eb", fontWeight: incomeMode === m ? 600 : 400 }}>
                                {l}
                            </button>
                        ))}
                    </div>

                    <SectionCard title="ตาราง: แพทย์ × สิทธิ์การรักษา" icon={Wallet} titleColor={MINT[800]}>
                        {incomeDerived.doctors.length === 0 ? <Empty /> : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead><tr><Th>แพทย์ / ทันตาภิบาล</Th>{incomeDerived.pttypes.map((pt) => <Th key={pt} className="!text-right">{pt}</Th>)}<Th className="!text-right">รวม</Th></tr></thead>
                                    <tbody>{incomeDerived.doctors.map((d, di) => (
                                        <Tr key={d.name} index={di}>
                                            <td className="px-3 py-2 whitespace-nowrap"><StaffBadge t={d.type} /> <span className="text-gray-800 font-medium ml-1">{d.name}</span></td>
                                            {incomeDerived.pttypes.map((pt) => {
                                                const v = incomeDerived.getV(d.name, pt);
                                                const pct = incomeDerived.maxPerDoctor > 0 ? (v / incomeDerived.maxPerDoctor) * 100 : 0;
                                                return (
                                                    <td key={pt} className="px-3 py-2 text-right">
                                                        <div className="text-gray-700">{incFmt(v)}</div>
                                                        <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: MINT[400] }} /></div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 text-right font-bold" style={{ color: MINT[800], backgroundColor: MINT[50] }}>{incFmt(incomeDerived.rowTotals[d.name] || 0)}</td>
                                        </Tr>
                                    ))}</tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: MINT[100] }}>
                                            <td className="px-3 py-2 font-bold text-gray-800">รวมทั้งหมด</td>
                                            {incomeDerived.pttypes.map((pt) => <td key={pt} className="px-3 py-2 text-right font-bold" style={{ color: MINT[800] }}>{incFmt(incomeDerived.grandPt[pt])}</td>)}
                                            <td className="px-3 py-2 text-right font-extrabold" style={{ color: MINT[800] }}>{incFmt(incomeDerived.grand)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard title={`${incomeLabel} แยกสิทธิ์ แต่ละแพทย์`} icon={Banknote} titleColor={MINT[800]}>
                        {incomeDerived.barData.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={incomeDerived.barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <RTooltip formatter={(v, n) => [incFmt(Number(v ?? 0)), n]} contentStyle={chartTooltip} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    {incomeDerived.pttypes.map((pt, i) => (
                                        <Bar key={pt} dataKey={pt} stackId="a" fill={PTTYPE_COLORS[i % PTTYPE_COLORS.length]}
                                            radius={i === incomeDerived.pttypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </SectionCard>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="สัดส่วนสิทธิ์รวมทั้งหมด" icon={Wallet} titleColor={MINT[800]}>
                            {incomeDerived.pieData.length === 0 ? <Empty /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={incomeDerived.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                                            {incomeDerived.pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                                        </Pie>
                                        <RTooltip formatter={(v) => incFmt(Number(v ?? 0))} contentStyle={chartTooltip} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </SectionCard>

                        <SectionCard title={`Top ${incomeLabel} ตามสิทธิ์`} icon={TrendingUp} titleColor={MINT[800]}>
                            <div className="space-y-2.5">
                                {incomeDerived.sortedPt.map((pt, i) => {
                                    const v = incomeDerived.grandPt[pt];
                                    const pct = incomeDerived.grand > 0 ? (v / incomeDerived.grand) * 100 : 0;
                                    const col = PTTYPE_COLORS[incomeDerived.pttypes.indexOf(pt) % PTTYPE_COLORS.length];
                                    return (
                                        <div key={pt} className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: col }}>{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-gray-700 truncate">{pt}</div>
                                                <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} /></div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-sm font-bold" style={{ color: col }}>{incFmt(v)}</div>
                                                <div className="text-[11px] text-gray-400">{pct.toFixed(1)}%</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* ── PATIENTS ── */}
            {tab === "patients" && (
                <SectionCard title="รายชื่อผู้ป่วย" icon={Users} titleColor={MINT[800]}>
                    <div className="flex items-center gap-2 mb-3 -mt-2"><RangeBadge /></div>

                    <div className="flex flex-wrap gap-2 mb-3 no-print">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="ค้นหา ชื่อ / HN / VN" value={pq} onChange={(e) => setPq(e.target.value)}
                                className="w-full border-2 border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0]" />
                        </div>
                        <select value={fStaff} onChange={(e) => setFStaff(e.target.value)} className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                            <option value="">— ทุกประเภทบุคลากร —</option><option>ทันตแพทย์</option><option>ทันตาภิบาล</option>
                        </select>
                        <select value={fDoctor} onChange={(e) => setFDoctor(e.target.value)} className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                            <option value="">— ทุกเจ้าหน้าที่ —</option>{patientDoctors.map((d) => <option key={d}>{d}</option>)}
                        </select>
                        <select value={fPttype} onChange={(e) => setFPttype(e.target.value)} className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0]">
                            <option value="">— ทุกสิทธิ์ —</option>{patientPttypes.map((p) => <option key={p}>{p}</option>)}
                        </select>
                        <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm" style={{ backgroundColor: MINT[500] }}>
                            <Download size={15} /> Export CSV
                        </button>
                    </div>

                    <div className="flex gap-3 mb-3 flex-wrap text-sm">
                        {[
                            { l: "ผู้ป่วย", v: `${fmt(patientStats.patients)} ราย` },
                            { l: "Visits", v: `${fmt(patientStats.visits)} ครั้ง` },
                            { l: "รายได้รวม", v: `${fmtB(patientStats.income)} บาท` },
                        ].map((s) => (
                            <span key={s.l} className="px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: MINT[50], color: MINT[800] }}>
                                {s.l} <strong>{s.v}</strong>
                            </span>
                        ))}
                    </div>

                    {patientFiltered.length ? (
                        <div className="space-y-4">
                            {patientGroups.map(({ doc, dRows, dIncome, dPt }) => (
                                <div key={doc.name}>
                                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-1 text-white"
                                        style={{ background: `linear-gradient(135deg, ${MINT[700]}, ${STAFF_COLOR[doc.type]})` }}>
                                        <span className="flex items-center gap-2 text-sm font-bold">
                                            <span className={`${BADGE} bg-white/25 text-white`}>{doc.type}</span>{doc.name}
                                        </span>
                                        <span className="text-xs opacity-90">ผู้ป่วย {fmt(dPt)} · {fmt(dRows.length)} visits · {fmtB(dIncome)} บาท</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="min-w-full text-xs border-collapse">
                                            <thead><tr>
                                                <Th>วันที่</Th><Th>เวลา</Th><Th>HN</Th><Th>VN</Th><Th>ชื่อ-นามสกุล</Th>
                                                <Th className="!text-center">อายุ</Th><Th>สิทธิ์</Th><Th>อาการสำคัญ</Th><Th>หัตถการ (ICD-9)</Th><Th className="!text-right">รายได้</Th>
                                            </tr></thead>
                                            <tbody>{dRows.map((r, i) => (
                                                <Tr key={i} index={i}>
                                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.vstdate}</td>
                                                    <td className="px-3 py-2 text-gray-500">{r.vsttime || "-"}</td>
                                                    <td className="px-3 py-2 font-mono text-gray-700">{r.hn}</td>
                                                    <td className="px-3 py-2 text-gray-400">{r.vn}</td>
                                                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{r.patient_name}</td>
                                                    <td className="px-3 py-2 text-center text-gray-600">{r.age ?? "-"}</td>
                                                    <td className="px-3 py-2"><span className={`${BADGE} bg-blue-100 text-blue-700`}>{r.pttype_name}</span></td>
                                                    <td className="px-3 py-2 text-gray-600">{r.chief_complaint || "-"}</td>
                                                    <td className="px-3 py-2 text-gray-500 max-w-[280px] whitespace-normal leading-relaxed">{r.procedures || "-"}</td>
                                                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: MINT[800] }}>{fmtB(r.total_income)}</td>
                                                </Tr>
                                            ))}</tbody>
                                            <tfoot>
                                                <tr style={{ backgroundColor: MINT[50] }}>
                                                    <td colSpan={9} className="px-3 py-2 text-right text-xs font-semibold text-gray-500">รวม {doc.name}</td>
                                                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: MINT[800] }}>{fmtB(dIncome)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <Empty />}
                </SectionCard>
            )}
        </div>
    );
}