"use client";

// app/pages/anc-nursing-dashboard/page.tsx
// Dashboard งานการพยาบาลผู้คลอด (ANC / Maternity) — 26 ตัวชี้วัดตาม spec

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Baby, Users, Activity, Syringe, Stethoscope, AlertTriangle,
    CalendarDays, BedDouble, PhoneOutgoing, Droplet, HeartPulse,
    Info, Clock, ScanLine, TestTube, Search,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

import ThaiDateInput from "@/app/components/ThaiDateInput";
import {
    KpiCard, SectionCard, HBarList, LiveBadge, RefreshButton,
} from "@/app/components/dashboard/live";
import { formatThaiDate } from "@/lib/dateUtils";

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
interface AncData {
    updatedAt: string; start: string; end: string; summary: AncSummary;
    missedAppts: MissedAppt[]; laborAdmit: LaborAdmit[]; referOut: ReferOut[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
function fmtDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fiscalDefault(): { start: Date; end: Date } {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const fyStart = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(fyStart, 9, 1), end: now };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AncNursingDashboardPage() {
    const def = useMemo(fiscalDefault, []);
    const [start, setStart] = useState<Date>(def.start);
    const [end, setEnd] = useState<Date>(def.end);
    const [data, setData] = useState<AncData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const s = data?.summary;
    const rangeLabel = data ? `${formatThaiDate(data.start)} – ${formatThaiDate(data.end)}` : "";

    // กลุ่มบริการ ICD10 → bar list
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

    const riskBars = useMemo(() => {
        if (!s) return [];
        return [
            { label: "ความดันโลหิตสูง (O10–O16)", count: s.htn },
            { label: "GDMA I (O240)", count: s.gdma1 },
            { label: "GDMA II (O241)", count: s.gdma2 },
            { label: "ภาวะเสี่ยงอื่นๆ (Z358)", count: s.riskOther },
        ].sort((a, b) => b.count - a.count);
    }, [s]);

    const ageBars = useMemo(() => {
        if (!s) return [];
        return [
            { label: "อายุ < 15 ปี", count: s.ageUnder15 },
            { label: "อายุ 15–19 ปี", count: s.age15to19 },
        ];
    }, [s]);

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
                    <DatePicker selected={start} onChange={(d: Date | null) => d && setStart(d)}
                        dateFormat="dd/MM/yyyy" locale={th} showMonthDropdown showYearDropdown
                        dropdownMode="select" customInput={<ThaiDateInput />} />
                    <DatePicker selected={end} onChange={(d: Date | null) => d && setEnd(d)}
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

            {/* ── KPI ── */}
            {s && (
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
            )}

            {/* ── KPI row 2: GA / ทะเบียน ── */}
            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <KpiCard icon={ScanLine} label="ฝากครั้งแรก GA < 12 สัปดาห์" value={fmt(s.firstAncUnder12wk)} accent="#0369A1" bg="#E0F2FE" />
                    <KpiCard icon={Users} label="หญิงตั้งครรภ์ในบัญชี 2" value={fmt(s.ancActiveTotal)} sub="ยังไม่คลอด" accent="#1a5233" bg="#f0faf4" />
                    <KpiCard icon={BedDouble} label="ทะเบียน Admit ห้องคลอด" value={fmt(s.laborAdmitCount)} accent="#185FA5" bg="#E6F1FB" />
                    <KpiCard icon={PhoneOutgoing} label="ทะเบียนส่งต่อห้องคลอด" value={fmt(s.referOutCount)} accent="#9A3412" bg="#FAEEDA" />
                    <KpiCard icon={AlertTriangle} label="ภาวะเสี่ยง (HT+GDM+อื่นๆ)" value={fmt(s.htn + s.gdma1 + s.gdma2 + s.riskOther)} accent="#A32D2D" bg="#FCEBEB" />
                </div>
            )}

            {/* ── Charts row ── */}
            {s && (
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
            )}

            {/* ── Age groups ── */}
            {s && (
                <SectionCard title="หญิงตั้งครรภ์กลุ่มอายุเสี่ยง (บัญชี 2)" icon={Droplet} titleColor="#9D174D">
                    <HBarList data={ageBars} colors={["#D4537E", "#ED93B1"]} total={s.ancActiveTotal} labelWidth={110} />
                </SectionCard>
            )}

            {/* ── ทะเบียน 17: ไม่มาตามนัด ── */}
            {data && (
                <SectionCard title={`หญิงตั้งครรภ์ที่ไม่มาตามนัด (${fmt(data.missedAppts.length)} ราย)`} icon={CalendarDays} titleColor="#854D0E">
                    <RegisterTable
                        empty="ไม่มีรายการนัดที่ขาด"
                        headers={["วันที่นัด", "HN", "ชื่อ-สกุล", "อายุ", "คลินิก", "เบอร์โทร"]}
                        rows={data.missedAppts.map((r) => [
                            formatThaiDate(r.nextdate), r.hn, r.ptname, String(r.age_y ?? "-"), r.clinic ?? "-", r.tel ?? "-",
                        ])}
                    />
                </SectionCard>
            )}

            {/* ── ทะเบียน 25: Admit ห้องคลอด ── */}
            {data && (
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
            )}

            {/* ── ทะเบียน 26: ส่งต่อ ── */}
            {data && (
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
            )}
        </div>
    );
}

// ─── Register table (ใช้ร่วม 3 ทะเบียน) ───────────────────────────────────────
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