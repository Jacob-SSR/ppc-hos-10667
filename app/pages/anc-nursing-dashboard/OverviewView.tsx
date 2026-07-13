"use client";

// app/pages/anc-nursing-dashboard/page.tsx
// Dashboard งานการพยาบาลผู้คลอด (ANC / Maternity) — แบบแยกแท็บ
// แท็บ: ภาพรวม / การเงิน / งานบริการ / ภาวะซีด / ทะเบียน
// ตัวกรองวันที่+ปีงบอยู่ด้านบนตลอด ดึงข้อมูลครั้งเดียวใช้ร่วมทุกแท็บ

import { useState, useCallback, useEffect, useMemo } from "react";
import {
    Baby, Users, Activity, Syringe, Stethoscope, AlertTriangle,
    CalendarDays, BedDouble, PhoneOutgoing, Droplets, HeartPulse,
    Info, Clock, ScanLine, TestTube, Search, Banknote, UserPlus,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

import ThaiDateInput from "@/app/components/ThaiDateInput";
import {
    KpiCard, SectionCard, HBarList, LiveBadge, RefreshButton,
} from "@/app/components/dashboard/live";
import { formatThaiDate } from "@/lib/dateUtils";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";
import AncCharts from "@/app/components/dashboard/AncCharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AncSummary {
    pregPersons: number; pregVisits: number; pregFirst: number; pregLater: number;
    referDiag: number; us: number; upt: number; pv: number; nipt: number;
    gdma1: number; gdma2: number; lab: number; vacFlu: number; vacAp: number;
    vacDt: number; riskOther: number; bloodTest: number; htn: number;
    admittedAfterAnc: number; avgAge: number; newRegister: number;
    firstAncUnder12wk: number; oldAncVisits: number; quality8: number;
    age15to19: number; ageUnder15: number; ancActiveTotal: number;
    laborAdmitCount: number; referOutCount: number;
}
interface MissedAppt { hn: string; cid: string; ptname: string; age_y: number; nextdate: string; clinic: string; tel: string; }
interface LaborAdmit { an: string; hn: string; ptname: string; age_y: number; regdate: string; labor_date: string; ga: number; alive_child_count: number; pttype_name: string; }
interface ReferOut { refer_date: string; hn: string; ptname: string; age_y: number; pdx: string; pre_diagnosis: string; dest_hospital: string; }

interface DayPoint { date: string; weekday: string; value: number }
interface MonthPoint { month: string; label: string; value: number }
interface Series { total: number; byDay: DayPoint[]; byMonth: MonthPoint[] }
interface AnemiaRow { date: string; hn: string; ptname: string; age_y: number; value: number }
interface Anemia { total: number; totalTested: number; byDay: DayPoint[]; byMonth: MonthPoint[]; patients: AnemiaRow[] }
interface DailyMonthly { revenue: Series; visits: Series; newReg: Series }

interface AncData {
    updatedAt: string; start: string; end: string; summary: AncSummary;
    missedAppts: MissedAppt[]; laborAdmit: LaborAdmit[]; referOut: ReferOut[];
    anemiaHct: Anemia; anemiaHb: Anemia; daily: DailyMonthly;
    anc5ByMonth?: MonthPoint[]; // ฝากครบ 5 ครั้ง (เดือนที่มาครั้งที่ 5)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const WD_ORDER = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function fmtDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fiscalDefault(): { start: Date; end: Date } {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const fyStart = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(fyStart, 9, 1), end: now };
}

// ปีงบประมาณ (พ.ศ.) ที่ให้เลือก
const FISCAL_YEARS = [2569, 2568, 2567, 2566, 2565];
function fiscalRangeBE(beYear: number): { start: Date; end: Date } {
    const ceEnd = beYear - 543;
    return { start: new Date(ceEnd - 1, 9, 1), end: new Date(ceEnd, 8, 30) };
}
function currentFiscalBE(): number {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const fyStart = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return fyStart + 544;
}

function bangkokNow(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}
// ย้อนหลัง n เดือน (รวมเดือนปัจจุบัน): วันที่ 1 ของเดือนเมื่อ n-1 เดือนก่อน → วันนี้
function monthsBackRange(n: number): { start: Date; end: Date } {
    const now = bangkokNow();
    return { start: new Date(now.getFullYear(), now.getMonth() - (n - 1), 1), end: now };
}

const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// ปี ค.ศ. ของเดือน (1–12) ในปีงบ be: ต.ค.–ธ.ค. = ปีก่อน, ม.ค.–ก.ย. = ปีถัดไป
function monthCEYear(month1to12: number, fiscalBE: number): number {
    const janSepYear = fiscalBE - 543;
    return month1to12 >= 10 ? janSepYear - 1 : janSepYear;
}
// ช่วงทั้งเดือน (1 → วันสุดท้าย) ของเดือนนั้นในปีงบ be
function monthRange(month1to12: number, fiscalBE: number): { start: Date; end: Date } {
    const y = monthCEYear(month1to12, fiscalBE);
    return { start: new Date(y, month1to12 - 1, 1), end: new Date(y, month1to12, 0) };
}

// ─── แท็บ ─────────────────────────────────────────────────────────────────────
type TabId = "overview" | "finance" | "service" | "anemia" | "registers";
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "ภาพรวม", icon: Activity },
    { id: "finance", label: "การเงิน", icon: Banknote },
    { id: "service", label: "งานบริการ", icon: Users },
    { id: "anemia", label: "ภาวะซีด", icon: Droplets },
    { id: "registers", label: "ทะเบียน", icon: CalendarDays },
];

// ─── DayMonthPair: การ์ดรายเดือน + รายวัน (จ/พ/ศ) ใช้ซ้ำทุกเมตริก ───────────────
function DayMonthPair({
    title, icon, color, series, unit = "",
}: {
    title: string;
    icon: React.ElementType;
    color: string;
    series: Series;
    unit?: string; // ต่อท้ายค่า เช่น "บาท", "ครั้ง", "ราย"
}) {
    const [wd, setWd] = useState("ทั้งหมด");

    const weekdays = useMemo(
        () => [...new Set(series.byDay.map((d) => d.weekday))]
            .sort((a, b) => WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b)),
        [series.byDay],
    );

    const monthBars = useMemo<[string, number][]>(
        () => series.byMonth.map((m) => [m.label, m.value]),
        [series.byMonth],
    );

    const dayBars = useMemo<[string, number][]>(
        () => series.byDay
            .filter((d) => wd === "ทั้งหมด" || d.weekday === wd)
            .map((d) => [`${formatThaiDate(d.date)} (${d.weekday})`, d.value]),
        [series.byDay, wd],
    );

    const totalLabel = `รวม ${fmt(series.total)}${unit ? " " + unit : ""}`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title={`${title} — รายเดือน`} icon={icon} titleColor={color}>
                {monthBars.length === 0
                    ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                    : <>
                        <p className="text-xs text-gray-400 mb-2">{totalLabel}</p>
                        <HBarList data={monthBars} colors={[color]} labelWidth={90} />
                    </>}
            </SectionCard>

            <SectionCard title={`${title} — รายวัน (จ/พ/ศ)`} icon={CalendarDays} titleColor={color}>
                {series.byDay.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {["ทั้งหมด", ...weekdays].map((w) => {
                                const active = wd === w;
                                return (
                                    <button
                                        key={w}
                                        onClick={() => setWd(w)}
                                        className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
                                        style={active
                                            ? { backgroundColor: color + "22", borderColor: color, color }
                                            : { backgroundColor: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }}
                                    >
                                        {w === "ทั้งหมด" ? "ทั้งหมด" : `วัน${w}`}
                                    </button>
                                );
                            })}
                        </div>
                        {dayBars.length === 0
                            ? <p className="text-xs text-gray-400 text-center py-8">ไม่มีข้อมูลในวันที่เลือก</p>
                            : <div className="max-h-[420px] overflow-y-auto pr-1">
                                <HBarList data={dayBars} colors={[color]} labelWidth={130} />
                            </div>}
                    </>
                )}
            </SectionCard>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AncNursingDashboardOverview() {
    const def = useMemo(fiscalDefault, []);
    const [start, setStart] = useState<Date>(def.start);
    const [end, setEnd] = useState<Date>(def.end);
    const [data, setData] = useState<AncData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fiscalYear, setFiscalYear] = useState<number | "">(currentFiscalBE());
    const [mode, setMode] = useState<"fiscal" | "month" | "m6" | "custom">("fiscal");
    const [selMonth, setSelMonth] = useState<number | "">("");
    const [tab, setTab] = useState<TabId>("overview");

    const fetchData = useCallback(async (s: Date, e: Date) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/anc-nursing?start=${fmtDate(s)}&end=${fmtDate(e)}`, { credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
            setData(json);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(def.start, def.end); }, [fetchData, def]);

    const handleFiscalYear = (beStr: string) => {
        if (!beStr) return;
        const be = Number(beStr);
        setFiscalYear(be);
        setSelMonth("");
        setMode("fiscal");
        const { start: s2, end: e2 } = fiscalRangeBE(be);
        setStart(s2);
        setEnd(e2);
        fetchData(s2, e2);
    };

    // เลือกเดือน (1–12) ในปีงบปัจจุบัน หรือกลับไปทั้งปีงบ ("")
    const handleMonth = (mStr: string) => {
        const fy = fiscalYear === "" ? currentFiscalBE() : fiscalYear;
        setFiscalYear(fy);
        if (mStr === "") {
            setSelMonth("");
            setMode("fiscal");
            const { start: s2, end: e2 } = fiscalRangeBE(fy);
            setStart(s2); setEnd(e2); fetchData(s2, e2);
            return;
        }
        const m = Number(mStr);
        setSelMonth(m);
        setMode("month");
        const { start: s2, end: e2 } = monthRange(m, fy);
        setStart(s2); setEnd(e2); fetchData(s2, e2);
    };

    // ปุ่มลัด "เดือนนี้"
    const applyThisMonth = () => {
        const now = bangkokNow();
        const fy = currentFiscalBE();
        const m = now.getMonth() + 1;
        setFiscalYear(fy); setSelMonth(m); setMode("month");
        const { start: s2, end: e2 } = monthRange(m, fy);
        setStart(s2); setEnd(e2); fetchData(s2, e2);
    };

    // ปุ่มลัด "6 เดือน" (ย้อนหลัง 6 เดือนถึงวันนี้)
    const applyLast6 = () => {
        setFiscalYear(""); setSelMonth(""); setMode("m6");
        const { start: s2, end: e2 } = monthsBackRange(6);
        setStart(s2); setEnd(e2); fetchData(s2, e2);
    };

    // dropdown รวม: ปีงบ / 6 เดือน / กำหนดเอง
    const handlePeriod = (val: string) => {
        if (val === "m6") { applyLast6(); return; }
        if (val === "custom") { setFiscalYear(""); setSelMonth(""); setMode("custom"); return; }
        if (val.startsWith("fy:")) handleFiscalYear(val.slice(3));
    };
    const periodValue =
        mode === "m6" ? "m6"
            : mode === "custom" ? "custom"
                : fiscalYear !== "" ? `fy:${fiscalYear}` : "custom";

    const thisMonthNo = bangkokNow().getMonth() + 1;
    const fyForLabels = fiscalYear === "" ? currentFiscalBE() : fiscalYear;

    const s = data?.summary;
    const aa = data?.anemiaHct;
    const hb = data?.anemiaHb;
    const dm = data?.daily;
    const rangeLabel = data ? `${formatThaiDate(data.start)} – ${formatThaiDate(data.end)}` : "";

    const serviceBars = useMemo(() => {
        if (!s) return [];
        return [
            { label: "U/S (Z019)", count: s.us },
            { label: "ตรวจภายใน PV (Z041)", count: s.pv },
            { label: "UPT (Z321)", count: s.upt },
            { label: "NIPT (Z360)", count: s.nipt },
            { label: "ตรวจ LAB (Z017/Z717)", count: s.lab },
            { label: "ตรวจเลือด (Z718/Z017)", count: s.bloodTest },
        ].sort((a, b) => b.count - a.count);
    }, [s]);

    const vaccineBars = useMemo(() => {
        if (!s) return [];
        return [
            { label: "ไข้หวัดใหญ่ (Z251)", count: s.vacFlu },
            { label: "ไอกรน aP (Z237)", count: s.vacAp },
            { label: "บาดทะยัก dT (Z235/Z236)", count: s.vacDt },
        ].sort((a, b) => b.count - a.count);
    }, [s]);

    // ภาวะเสี่ยง/ภาวะแทรกซ้อน — รวมภาวะซีด HCT + Hb
    const riskBars = useMemo(() => {
        if (!s) return [];
        return [
            { label: "ความดันโลหิตสูง (O10–O16)", count: s.htn },
            { label: "GDMA I (O240)", count: s.gdma1 },
            { label: "GDMA II (O241)", count: s.gdma2 },
            { label: "ภาวะซีด HCT < 33%", count: aa?.total ?? 0 },
            { label: "ภาวะซีด Hb < 11", count: hb?.total ?? 0 },
            { label: "ภาวะเสี่ยงอื่นๆ (Z358)", count: s.riskOther },
        ].sort((a, b) => b.count - a.count);
    }, [s, aa, hb]);

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Baby size={20} className="text-pink-600" />
                        <h1 className="text-lg font-bold text-gray-800">Dashboard งานการพยาบาลผู้คลอด (ANC)</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <Clock size={11} />
                        <span>ช่วงข้อมูล: {rangeLabel || "—"}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={periodValue}
                        onChange={(e) => handlePeriod(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"
                    >
                        {FISCAL_YEARS.map((y) => (
                            <option key={y} value={`fy:${y}`}>ปีงบ {y}</option>
                        ))}
                        <option value="m6">6 เดือน (ย้อนหลัง)</option>
                        <option value="custom">กำหนดเอง</option>
                    </select>

                    {/* เลือกเดือน (ทั้งปีงบ / ม.ค.–ธ.ค.) */}
                    <select
                        value={selMonth === "" ? "" : String(selMonth)}
                        onChange={(e) => handleMonth(e.target.value)}
                        className={`border rounded px-2 py-1.5 text-sm ${mode === "month" ? "border-pink-300 bg-pink-50 text-pink-700 font-semibold" : "border-gray-300 bg-white text-gray-600"}`}
                    >
                        <option value="">ทั้งปีงบ</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                                {MONTH_TH[m - 1]} {String(monthCEYear(m, fyForLabels) + 543).slice(2)}
                            </option>
                        ))}
                    </select>

                    {/* ปุ่มลัด */}
                    <button onClick={applyThisMonth}
                        className={`border rounded px-3 py-1.5 text-sm transition-colors ${mode === "month" && selMonth === thisMonthNo && fiscalYear === currentFiscalBE() ? "bg-pink-600 text-white border-pink-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        เดือนนี้
                    </button>

                    <DatePicker selected={start} onChange={(d: Date | null) => { if (d) { setStart(d); setFiscalYear(""); setSelMonth(""); setMode("custom"); } }}
                        dateFormat="dd/MM/yyyy" locale={th} showMonthDropdown showYearDropdown
                        dropdownMode="select" customInput={<ThaiDateInput />} />
                    <DatePicker selected={end} onChange={(d: Date | null) => { if (d) { setEnd(d); setFiscalYear(""); setSelMonth(""); setMode("custom"); } }}
                        dateFormat="dd/MM/yyyy" locale={th} showMonthDropdown showYearDropdown
                        dropdownMode="select" customInput={<ThaiDateInput />} />
                    <button onClick={() => fetchData(start, end)} disabled={loading}
                        className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50">
                        {loading ? <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" /> : <Search size={14} />}
                        ค้นหา
                    </button>
                    <RefreshButton loading={loading} onClick={() => fetchData(start, end)} />
                </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-1.5 flex gap-1 overflow-x-auto">
                {TABS.map((t) => {
                    const active = tab === t.id;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${active ? "bg-pink-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}
                        >
                            <Icon size={15} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* ── Loading ── */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ════════ แท็บ: ภาพรวม ════════ */}
            {tab === "overview" && s && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        <KpiCard icon={Users} label="หญิงตั้งครรภ์รับบริการ" value={fmt(s.pregPersons)} sub={`${fmt(s.pregVisits)} ครั้ง`} accent="#9D174D" bg="#FCE7F3" />
                        <KpiCard icon={Baby} label="ครรภ์แรก (Z340)" value={fmt(s.pregFirst)} sub={`ครรภ์หลัง ${fmt(s.pregLater)}`} accent="#6B21A8" bg="#F3E8FF" />
                        <KpiCard icon={CalendarDays} label="ฝากครรภ์รายใหม่" value={fmt(s.newRegister)} sub="ในช่วงเวลา" accent="#065F46" bg="#D1FAE5" />
                        <KpiCard icon={Activity} label="รายเก่า (ครั้ง)" value={fmt(s.oldAncVisits)} accent="#1E40AF" bg="#DBEAFE" />
                        <KpiCard icon={HeartPulse} label="อายุเฉลี่ย" value={`${s.avgAge}`} sub="ปี (บัญชี 2)" accent="#854D0E" bg="#FEF9C3" />
                        <KpiCard icon={Stethoscope} label="ครบ 8 ครั้งคุณภาพ" value={fmt(s.quality8)} accent="#134E4A" bg="#CCFBF1" />
                        <KpiCard icon={BedDouble} label="ฝากครรภ์แล้ว Admit" value={fmt(s.admittedAfterAnc)} accent="#5B21B6" bg="#EDE9FE" />
                        <KpiCard icon={PhoneOutgoing} label="ส่งต่อ (ระบุ Diag)" value={fmt(s.referDiag)} accent="#9A3412" bg="#FFF7ED" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <KpiCard icon={Banknote} label="รายได้งานฝากครรภ์" value={fmt(dm?.revenue.total ?? 0)} sub="บาท (ในช่วง)" accent="#065F46" bg="#D1FAE5" />
                        <KpiCard icon={ScanLine} label="ฝากครั้งแรก GA < 12 สัปดาห์" value={fmt(s.firstAncUnder12wk)} accent="#0369A1" bg="#E0F2FE" />
                        <KpiCard icon={Users} label="หญิงตั้งครรภ์ในบัญชี 2" value={fmt(s.ancActiveTotal)} sub="ยังไม่คลอด" accent="#1a5233" bg="#f0faf4" />
                        <KpiCard icon={AlertTriangle} label="ภาวะเสี่ยง (HT+GDM+ซีด+อื่นๆ)" value={fmt(s.htn + s.gdma1 + s.gdma2 + s.riskOther + (aa?.total ?? 0) + (hb?.total ?? 0))} accent="#A32D2D" bg="#FCEBEB" />
                        <KpiCard icon={Droplets} label="ซีด HCT < 33%" value={fmt(aa?.total ?? 0)} sub={`จากตรวจ ${fmt(aa?.totalTested ?? 0)} ราย`} accent="#A32D2D" bg="#FCEBEB" />
                        <KpiCard icon={Droplets} label="ซีด Hb < 11" value={fmt(hb?.total ?? 0)} sub={`จากตรวจ ${fmt(hb?.totalTested ?? 0)} ราย`} accent="#9A3412" bg="#FFF7ED" />
                        <KpiCard icon={HeartPulse} label="ตั้งครรภ์วัยรุ่น 15–19 ปี" value={`${fmt(s.age15to19)} (${pct(s.age15to19, s.pregPersons)}%)`} sub={`< 15 ปี: ${fmt(s.ageUnder15)} · จากคนท้อง ${fmt(s.pregPersons)} ราย`} accent="#9D174D" bg="#FCE7F3" />
                        <KpiCard icon={BedDouble} label="ทะเบียน Admit ห้องคลอด" value={fmt(s.laborAdmitCount)} accent="#185FA5" bg="#E6F1FB" />
                        <KpiCard icon={PhoneOutgoing} label="ทะเบียนส่งต่อห้องคลอด" value={fmt(s.referOutCount)} accent="#9A3412" bg="#FAEEDA" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SectionCard title="การตรวจ/บริการระหว่างฝากครรภ์" icon={TestTube}>
                            {serviceBars.every((b) => b.count === 0)
                                ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                                : <HBarList data={serviceBars} colors={["#85B7EB"]} labelWidth={140} />}
                        </SectionCard>
                        <SectionCard title="การได้รับวัคซีน" icon={Syringe}>
                            {vaccineBars.every((b) => b.count === 0)
                                ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                                : <HBarList data={vaccineBars} colors={["#7DE8B0", "#3aa36a", "#55b882"]} labelWidth={140} />}
                        </SectionCard>
                        <SectionCard title="ภาวะเสี่ยง/ภาวะแทรกซ้อน" icon={AlertTriangle} titleColor="#A32D2D">
                            {riskBars.every((b) => b.count === 0)
                                ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                                : <HBarList data={riskBars} colors={["#EF9F27"]} labelWidth={140} />}
                        </SectionCard>
                    </div>

                    {/* ── กราฟไตรมาส + โดนัทภาวะเสี่ยง/สถานะคลอด ── */}
                    {dm && (
                        <AncCharts
                            newRegByMonth={dm.newReg.byMonth}
                            anc5ByMonth={data?.anc5ByMonth ?? []}
                            riskData={riskBars}
                            delivery={{
                                "ยังไม่คลอด": s.ancActiveTotal,
                                "คลอดแล้ว": s.laborAdmitCount,
                                "ส่งต่อห้องคลอด": s.referOutCount,
                            }}
                        />
                    )}
                </>
            )}

            {/* ════════ แท็บ: การเงิน ════════ */}
            {tab === "finance" && dm && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <KpiCard icon={Banknote} label="รายได้รวมในช่วง" value={fmt(dm.revenue.total)} sub="บาท" accent="#065F46" bg="#D1FAE5" />
                        <KpiCard icon={CalendarDays} label="เฉลี่ย/เดือน" value={fmt(dm.revenue.byMonth.length ? Math.round(dm.revenue.total / dm.revenue.byMonth.length) : 0)} sub="บาท" accent="#0369A1" bg="#E0F2FE" />
                        <KpiCard icon={Users} label="จำนวนครั้งบริการ" value={fmt(dm.visits.total)} sub="ครั้ง" accent="#9D174D" bg="#FCE7F3" />
                    </div>
                    <DayMonthPair title="รายได้งานฝากครรภ์" icon={Banknote} color="#3aa36a" series={dm.revenue} unit="บาท" />
                </>
            )}

            {/* ════════ แท็บ: งานบริการ ════════ */}
            {tab === "service" && dm && (
                <>
                    <DayMonthPair title="คนท้องมารับบริการ" icon={Users} color="#9D174D" series={dm.visits} unit="ครั้ง" />
                    <DayMonthPair title="ฝากครรภ์รายใหม่" icon={UserPlus} color="#065F46" series={dm.newReg} unit="ราย" />
                </>
            )}

            {/* ════════ แท็บ: ภาวะซีด ════════ */}
            {tab === "anemia" && aa && hb && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <KpiCard icon={Droplets} label="ซีด HCT < 33%" value={fmt(aa.total)} sub={`จากตรวจ ${fmt(aa.totalTested)} ราย · ${pct(aa.total, aa.totalTested)}%`} accent="#A32D2D" bg="#FCEBEB" />
                        <KpiCard icon={Droplets} label="ซีด Hb < 11" value={fmt(hb.total)} sub={`จากตรวจ ${fmt(hb.totalTested)} ราย · ${pct(hb.total, hb.totalTested)}%`} accent="#9A3412" bg="#FFF7ED" />
                    </div>

                    <DayMonthPair title="ภาวะซีด HCT < 33%" icon={Droplets} color="#A32D2D" series={aa} unit="ครั้ง" />
                    <DayMonthPair title="ภาวะซีด Hb < 11" icon={Droplets} color="#9A3412" series={hb} unit="ครั้ง" />

                    <SectionCard title={`ทะเบียนภาวะซีด HCT < 33% (${fmt(aa.patients.length)} ราย)`} icon={Droplets} titleColor="#A32D2D">
                        <RegisterTable
                            empty="ไม่พบข้อมูลภาวะซีดในช่วงเวลานี้"
                            headers={["วันที่ตรวจ", "HN", "ชื่อ-สกุล", "อายุ", "HCT (%)"]}
                            rows={aa.patients.map((r) => [
                                formatThaiDate(r.date), r.hn, r.ptname, String(r.age_y ?? "-"), r.value.toFixed(1),
                            ])}
                        />
                    </SectionCard>

                    <SectionCard title={`ทะเบียนภาวะซีด Hb < 11 (${fmt(hb.patients.length)} ราย)`} icon={Droplets} titleColor="#9A3412">
                        <RegisterTable
                            empty="ไม่พบข้อมูลภาวะซีดในช่วงเวลานี้"
                            headers={["วันที่ตรวจ", "HN", "ชื่อ-สกุล", "อายุ", "Hb (g/dL)"]}
                            rows={hb.patients.map((r) => [
                                formatThaiDate(r.date), r.hn, r.ptname, String(r.age_y ?? "-"), r.value.toFixed(1),
                            ])}
                        />
                    </SectionCard>
                </>
            )}

            {/* ════════ แท็บ: ทะเบียน ════════ */}
            {tab === "registers" && data && (
                <>
                    <SectionCard title={`หญิงตั้งครรภ์ที่ไม่มาตามนัด (${fmt(data.missedAppts.length)} ราย)`} icon={CalendarDays} titleColor="#854D0E">
                        <RegisterTable
                            empty="ไม่มีรายการนัดที่ขาด"
                            headers={["วันที่นัด", "HN", "ชื่อ-สกุล", "อายุ", "คลินิก", "เบอร์โทร"]}
                            rows={data.missedAppts.map((r) => [
                                formatThaiDate(r.nextdate), r.hn, r.ptname, String(r.age_y ?? "-"), r.clinic ?? "-", r.tel ?? "-",
                            ])}
                        />
                    </SectionCard>

                    <SectionCard title={`ทะเบียน Admit ห้องคลอด (${fmt(data.laborAdmit.length)} ราย)`} icon={BedDouble} titleColor="#185FA5">
                        <RegisterTable
                            empty="ไม่มีรายการคลอดในช่วงเวลานี้"
                            headers={["วันคลอด", "AN", "HN", "ชื่อ-สกุล", "อายุ", "GA(wk)", "บุตรมีชีพ", "สิทธิ์"]}
                            rows={data.laborAdmit.map((r) => [
                                formatThaiDate(r.labor_date), r.an, r.hn, r.ptname, String(r.age_y ?? "-"),
                                String(r.ga ?? "-"), String(r.alive_child_count ?? "-"), r.pttype_name ?? "-",
                            ])}
                        />
                    </SectionCard>

                    <SectionCard title={`ทะเบียนส่งต่อห้องคลอด (${fmt(data.referOut.length)} ราย)`} icon={PhoneOutgoing} titleColor="#9A3412">
                        <RegisterTable
                            empty="ไม่มีรายการส่งต่อในช่วงเวลานี้"
                            headers={["วันที่ส่งต่อ", "HN", "ชื่อ-สกุล", "อายุ", "Pdx", "Pre-Dx", "ปลายทาง"]}
                            rows={data.referOut.map((r) => [
                                formatThaiDate(r.refer_date), r.hn, r.ptname, String(r.age_y ?? "-"),
                                r.pdx ?? "-", r.pre_diagnosis ?? "-", r.dest_hospital ?? "-",
                            ])}
                        />
                    </SectionCard>
                </>
            )}

            {/* ── AI สรุป + แชท (ปุ่มลอยมุมขวาล่าง + modal กลางจอ) ── */}
            <AiSummaryCard
                summary={
                    data?.summary
                        ? {
                            ช่วงข้อมูล: `${formatThaiDate(data.start)} – ${formatThaiDate(data.end)}`,
                            หญิงตั้งครรภ์รับบริการ: data.summary.pregPersons,
                            จำนวนครั้งฝากครรภ์: data.summary.pregVisits,
                            ครรภ์แรก: data.summary.pregFirst,
                            ครรภ์หลัง: data.summary.pregLater,
                            ฝากครรภ์รายใหม่: data.summary.newRegister,
                            ฝากครั้งแรกก่อน12สัปดาห์: data.summary.firstAncUnder12wk,
                            ครบ8ครั้งคุณภาพ: data.summary.quality8,
                            อายุเฉลี่ย: data.summary.avgAge,
                            ตั้งครรภ์วัยรุ่น15ถึง19: data.summary.age15to19,
                            ตั้งครรภ์อายุต่ำกว่า15: data.summary.ageUnder15,
                            ในบัญชี2ยังไม่คลอด: data.summary.ancActiveTotal,
                            ภาวะเสี่ยง: {
                                ความดันโลหิตสูง: data.summary.htn,
                                เบาหวาน_GDMA1: data.summary.gdma1,
                                เบาหวาน_GDMA2: data.summary.gdma2,
                                ซีด_HCT_ต่ำกว่า33: data.anemiaHct?.total ?? 0,
                                ซีด_Hb_ต่ำกว่า11: data.anemiaHb?.total ?? 0,
                                เสี่ยงอื่นๆ: data.summary.riskOther,
                            },
                            ฝากครรภ์แล้วAdmit: data.summary.admittedAfterAnc,
                            Admitห้องคลอด: data.summary.laborAdmitCount,
                            ส่งต่อห้องคลอด: data.summary.referOutCount,
                            รายได้งานฝากครรภ์_บาท: data.daily?.revenue.total ?? 0,
                            จำนวนครั้งบริการ: data.daily?.visits.total ?? 0,
                            ไม่มาตามนัด_จำนวนราย: data.missedAppts.length,
                        }
                        : null
                }
                context="Dashboard งานการพยาบาลผู้คลอด (ANC / ฝากครรภ์) โรงพยาบาลพลับพลาชัย — การฝากครรภ์ คุณภาพบริการ ภาวะเสี่ยง ภาวะซีด การคลอด และรายได้"
                disabled={!data?.summary}
            />
        </div>
    );
}

// ─── Register table (ใช้ร่วมทุกทะเบียน) ───────────────────────────────────────
function RegisterTable({ headers, rows, empty }: {
    headers: string[]; rows: (string | number)[][]; empty: string;
}) {
    const [page, setPage] = useState(1);
    const PAGE = 10;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
    const paged = rows.slice((page - 1) * PAGE, page * PAGE);

    if (rows.length === 0)
        return <p className="text-xs text-gray-400 text-center py-8">{empty}</p>;

    return (
        <div>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700">
                            {headers.map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-white font-semibold whitespace-nowrap border-r border-green-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((row, i) => (
                            <tr key={i} className={`border-b border-gray-100 hover:bg-green-50/60 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                {row.map((c, j) => (
                                    <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{c}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">หน้า {page} / {totalPages} · {rows.length} รายการ</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">← ก่อนหน้า</button>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-30 hover:bg-gray-50">ถัดไป →</button>
                    </div>
                </div>
            )}
        </div>
    );
}