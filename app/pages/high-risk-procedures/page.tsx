"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Activity, Wind, Droplet, Droplets, Syringe, Stethoscope,
    Download, Clock, Users, BedDouble, DoorOpen, AlertTriangle, RefreshCw,
} from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { SectionCard, LiveBadge } from "@/app/components/dashboard/live";
import { Dropdown } from "@/app/pages/rdu-dashboard/_components/Dropdown";
import { exportToExcel } from "@/lib/exportExcel";
import { formatThaiDate } from "@/lib/dateUtils";
import type {
    HighRiskProceduresData, HrpOpdRow, HrpIpdRow,
} from "@/lib/highRiskProcedures.service";

// ─── meta สี/ไอคอนต่อหัตถการ ──────────────────────────────────────────────────
const PROC_META: Record<string, { short: string; color: string; bg: string; Icon: React.ElementType }> = {
    "9604": { short: "ETT", color: "#185FA5", bg: "#E6F1FB", Icon: Wind },
    "3404": { short: "ICD", color: "#A32D2D", bg: "#FCEBEB", Icon: Activity },
    "3491": { short: "Thoraco", color: "#854F0B", bg: "#FAEEDA", Icon: Droplet },
    "5491": { short: "Paracentesis", color: "#2d8a56", bg: "#EAF3DE", Icon: Droplets },
    "0331": { short: "LP", color: "#6B21A8", bg: "#F3E8FF", Icon: Syringe },
};
const fallbackMeta = { short: "อื่นๆ", color: "#5F5E5A", bg: "#f3f4f6", Icon: Activity };

const MINT = { 300: "#7ec8a0", 500: "#3aa36a", 700: "#236b43", 800: "#1a5233" };
const fmt = (n: number) => n.toLocaleString("th-TH");
const sexLabel = (s: string) => (s === "1" ? "ชาย" : "หญิง");

function fmtDateInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── ตัวเลือกช่วงเวลา (เหมือน RDU) ─────────────────────────────────────────────
type Preset = "fiscal" | "6m" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "fiscal", label: "ปีงบประมาณ" },
    { key: "6m", label: "6 เดือน" },
    { key: "custom", label: "กำหนดเอง" },
];

// ปีงบประมาณ (พ.ศ.) ที่เลือกได้
const FISCAL_YEARS = ["2569", "2568", "2567", "2566", "2565"];

// ปีงบประมาณปัจจุบัน (พ.ศ.) — งบเริ่ม 1 ต.ค.
function getCurrentFiscalYearBE(): string {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const ceYear = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    return String(ceYear + 543);
}

// ช่วงวันของปีงบ พ.ศ. ที่ระบุ (1 ต.ค. ปีก่อน – 30 ก.ย.) ไม่เกินวันนี้
function fiscalRange(fyBE: string): { start: Date; end: Date } {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ceEnd = Number(fyBE) - 543;        // ปี ค.ศ. ที่ปีงบสิ้นสุด
    const start = new Date(ceEnd - 1, 9, 1);  // 1 ต.ค. ปีก่อนหน้า
    const fyEnd = new Date(ceEnd, 8, 30);     // 30 ก.ย.
    return { start, end: fyEnd < today ? fyEnd : today };
}

function getPresetRange(preset: Preset, fyBE: string): { start: Date; end: Date } {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === "6m") {
        const s = new Date(today);
        s.setMonth(s.getMonth() - 6);
        s.setDate(1);
        return { start: s, end: today };
    }
    // fiscal (และ fallback)
    return fiscalRange(fyBE);
}

// ─── ตารางย่อย ───────────────────────────────────────────────────────────────
function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th className={`text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-[#a8d5ba] ${right ? "text-right" : "text-left"}`}
            style={{ backgroundColor: MINT[300] }}>{children}</th>
    );
}
function ProcBadge({ code }: { code: string }) {
    const m = PROC_META[code] ?? fallbackMeta;
    return (
        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: m.bg, color: m.color }}>{code}</span>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HighRiskProceduresPage() {
    const [preset, setPreset] = useState<Preset>("fiscal");
    const [fiscalYear, setFiscalYear] = useState<string>(() => getCurrentFiscalYearBE());
    const [customStart, setCustomStart] = useState<Date>(
        () => getPresetRange("fiscal", getCurrentFiscalYearBE()).start,
    );
    const [customEnd, setCustomEnd] = useState<Date>(
        () => getPresetRange("fiscal", getCurrentFiscalYearBE()).end,
    );
    const [data, setData] = useState<HighRiskProceduresData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { start, end } =
            preset === "custom"
                ? { start: customStart, end: customEnd }
                : getPresetRange(preset, fiscalYear);
        setLoading(true); setError(null);
        try {
            const res = await fetch(
                `/api/high-risk-procedures?start=${fmtDateInput(start)}&end=${fmtDateInput(end)}`,
                { credentials: "include" },
            );
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            setData(await res.json());
        } catch (err) {
            setError((err as Error).message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [preset, fiscalYear, customStart, customEnd]);

    // โหลดอัตโนมัติเมื่อเปลี่ยน preset / ปีงบ / ช่วงกำหนดเอง (เหมือน RDU)
    useEffect(() => { fetchData(); }, [fetchData]);

    const s = data?.summary;
    const rangeLabel = data
        ? `${formatThaiDate(data.start)} – ${formatThaiDate(data.end)}`
        : "";
    const updatedAt = data
        ? new Date(data.updatedAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok", day: "2-digit", month: "short", year: "2-digit",
            hour: "2-digit", minute: "2-digit",
        })
        : "";

    const chartData = useMemo(
        () => (s?.byProcedure ?? []).map((p) => ({
            name: `${(PROC_META[p.code] ?? fallbackMeta).short} (${p.code})`,
            "ผู้ป่วยนอก (OPD/ER)": p.opd,
            "ผู้ป่วยใน (IPD)": p.ipd,
        })),
        [s],
    );

    // จัดกลุ่มตามชนิดหัตถการ (icd9) แล้วเรียงวันที่ใหม่→เก่าในแต่ละกลุ่ม
    const sortedOpd = useMemo(
        () =>
            [...(data?.opd ?? [])].sort(
                (a, b) =>
                    a.icd9.localeCompare(b.icd9) ||
                    b.service_date.localeCompare(a.service_date) ||
                    b.service_time.localeCompare(a.service_time),
            ),
        [data],
    );

    const sortedIpd = useMemo(
        () =>
            [...(data?.ipd ?? [])].sort(
                (a, b) =>
                    a.icd9.localeCompare(b.icd9) ||
                    b.service_date.localeCompare(a.service_date),
            ),
        [data],
    );

    const exportOpd = () => {
        if (!data?.opd.length) return;
        const rows = sortedOpd.map((r: HrpOpdRow) => ({
            "วันที่รับบริการ": formatThaiDate(r.service_date),
            "เวลา": r.service_time,
            "ประเภท": r.visit_type,
            HN: r.hn,
            "ชื่อ-นามสกุล": r.patient_name,
            "อายุ": r.age,
            "เพศ": sexLabel(r.sex),
            "รหัสหัตถการ (ICD-9)": r.icd9,
            "ชื่อหัตถการ": r.procedure_name,
        }));
        exportToExcel(rows, { filePrefix: "หัตถการเสี่ยงสูง_OPD-ER", sheetName: "OPD-ER" });
    };
    const exportIpd = () => {
        if (!data?.ipd.length) return;
        const rows = sortedIpd.map((r: HrpIpdRow) => ({
            "วันจำหน่าย": formatThaiDate(r.service_date),
            AN: r.an,
            HN: r.hn,
            "ชื่อ-นามสกุล": r.patient_name,
            "อายุ": r.age,
            "เพศ": sexLabel(r.sex),
            "รหัสหัตถการ (ICD-9)": r.icd9,
            "ชื่อหัตถการ": r.procedure_name,
            "ประเภทการจำหน่าย": r.dchtype_name,
        }));
        exportToExcel(rows, { filePrefix: "หัตถการเสี่ยงสูง_IPD", sheetName: "IPD" });
    };

    return (
        <div className="space-y-4 text-gray-800">
            {/* Header + ตัวเลือกช่วงเวลา (เหมือน RDU) */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Stethoscope size={18} style={{ color: MINT[800] }} />
                            <h1 className="text-lg font-bold text-gray-800">
                                จำนวนหัตถการเสี่ยงสูงในโรงพยาบาลพลับพลาชัย
                            </h1>
                            <LiveBadge />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                            <span>แยกผู้ป่วยนอก (OPD/ER ใช้วันรับบริการ) และผู้ป่วยใน (IPD ใช้วันจำหน่าย)</span>
                            {data && (<><span>·</span><Clock size={11} /><span>{rangeLabel}</span></>)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {data && (
                            <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-gray-500 px-3 py-1.5 rounded-full whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,.2)]" />
                                update ล่าสุด · {updatedAt}
                            </span>
                        )}

                        <Dropdown<Preset> value={preset} options={PRESETS} onChange={setPreset} />

                        {preset === "fiscal" && (
                            <Dropdown<string>
                                value={fiscalYear}
                                options={FISCAL_YEARS.map((y) => ({ key: y, label: `ปีงบประมาณ ${y}` }))}
                                onChange={setFiscalYear}
                            />
                        )}

                        {preset === "custom" && (
                            <>
                                <DatePicker
                                    selected={customStart}
                                    onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                                    dateFormat="dd/MM/yyyy" locale={th}
                                    showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20}
                                    customInput={<ThaiDateInput />}
                                />
                                <DatePicker
                                    selected={customEnd}
                                    onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                                    dateFormat="dd/MM/yyyy" locale={th}
                                    showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20}
                                    customInput={<ThaiDateInput />}
                                />
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                        <RefreshCw size={14} className="flex-shrink-0" />
                        <span>ดึงข้อมูลไม่สำเร็จ: {error}</span>
                        <button onClick={fetchData} className="ml-auto underline font-semibold">ลองใหม่</button>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* KPI: รวม + ต่อหัตถการ */}
            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <KpiBox Icon={Users} label="ทั้งหมด" value={fmt(s.grandTotal)} sub="หัตถการ" color={MINT[800]} bg={MINT[300] + "33"} />
                    <KpiBox Icon={DoorOpen} label="ผู้ป่วยนอก (OPD/ER)" value={fmt(s.opdTotal)} sub="ครั้ง" color="#185FA5" bg="#E6F1FB" />
                    <KpiBox Icon={BedDouble} label="ผู้ป่วยใน (IPD)" value={fmt(s.ipdTotal)} sub="ครั้ง" color="#A32D2D" bg="#FCEBEB" />
                    {s.byProcedure.map((p) => {
                        const m = PROC_META[p.code] ?? fallbackMeta;
                        return (
                            <KpiBox key={p.code} Icon={m.Icon} label={`${m.short} (${p.code})`}
                                value={fmt(p.total)} sub={`OPD/ER ${p.opd} · IPD ${p.ipd}`} color={m.color} bg={m.bg} />
                        );
                    })}
                </div>
            )}

            {/* Chart */}
            {s && (
                <SectionCard title="จำนวนหัตถการแยกตามประเภท (OPD/ER เทียบ IPD)" icon={Activity} titleColor={MINT[800]}>
                    {chartData.every((d) => d["ผู้ป่วยนอก (OPD/ER)"] === 0 && d["ผู้ป่วยใน (IPD)"] === 0)
                        ? <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูลในช่วงเวลานี้</p>
                        : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }} barGap={4}>
                                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="ผู้ป่วยนอก (OPD/ER)" fill="#378ADD" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="ผู้ป่วยใน (IPD)" fill="#E24B4A" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </SectionCard>
            )}

            {/* OPD/ER table */}
            {data && (
                <SectionCard
                    title={`ผู้ป่วยนอก (OPD + ER) — ${fmt(data.opd.length)} ครั้ง`}
                    icon={DoorOpen}
                    titleColor={MINT[800]}
                >
                    <div className="flex justify-end mb-3">
                        <button onClick={exportOpd} disabled={!data.opd.length}
                            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40"
                            style={{ backgroundColor: MINT[300] }}>
                            <Download size={15} /> Export Excel
                        </button>
                    </div>
                    {sortedOpd.length === 0
                        ? <p className="text-center text-gray-400 py-8 text-sm">ไม่พบข้อมูล</p>
                        : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[520px]">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="sticky top-0">
                                        <tr>
                                            <Th>วันที่รับบริการ</Th><Th>เวลา</Th><Th>ประเภท</Th><Th>HN</Th>
                                            <Th>ชื่อ-นามสกุล</Th><Th right>อายุ</Th><Th>เพศ</Th>
                                            <Th>รหัส (ICD-9)</Th><Th>ชื่อหัตถการ</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedOpd.map((r, i) => (
                                            <tr key={i} className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-[#f0faf4]`}>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatThaiDate(r.service_date)}</td>
                                                <td className="px-3 py-2 text-gray-500">{r.service_time || "-"}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.visit_type === "ER" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                                        {r.visit_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-gray-700">{r.hn}</td>
                                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.patient_name}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{r.age || "-"}</td>
                                                <td className="px-3 py-2 text-gray-600">{sexLabel(r.sex)}</td>
                                                <td className="px-3 py-2"><ProcBadge code={r.icd9} /></td>
                                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.procedure_name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                </SectionCard>
            )}

            {/* IPD table */}
            {data && (
                <SectionCard
                    title={`ผู้ป่วยใน (IPD) — ${fmt(data.ipd.length)} ครั้ง`}
                    icon={BedDouble}
                    titleColor={MINT[800]}
                >
                    <div className="flex justify-end mb-3">
                        <button onClick={exportIpd} disabled={!data.ipd.length}
                            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40"
                            style={{ backgroundColor: MINT[300] }}>
                            <Download size={15} /> Export Excel
                        </button>
                    </div>
                    {sortedIpd.length === 0
                        ? <p className="text-center text-gray-400 py-8 text-sm">ไม่พบข้อมูล</p>
                        : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[520px]">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="sticky top-0">
                                        <tr>
                                            <Th>วันจำหน่าย</Th><Th>AN</Th><Th>HN</Th>
                                            <Th>ชื่อ-นามสกุล</Th><Th right>อายุ</Th><Th>เพศ</Th>
                                            <Th>รหัส (ICD-9)</Th><Th>ชื่อหัตถการ</Th><Th>ประเภทการจำหน่าย</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedIpd.map((r, i) => (
                                            <tr key={i} className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-[#f0faf4]`}>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatThaiDate(r.service_date)}</td>
                                                <td className="px-3 py-2 font-mono text-gray-500">{r.an}</td>
                                                <td className="px-3 py-2 font-mono text-gray-700">{r.hn}</td>
                                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.patient_name}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{r.age || "-"}</td>
                                                <td className="px-3 py-2 text-gray-600">{sexLabel(r.sex)}</td>
                                                <td className="px-3 py-2"><ProcBadge code={r.icd9} /></td>
                                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.procedure_name}</td>
                                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.dchtype_name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                </SectionCard>
            )}
        </div>
    );
}

// ─── KPI box ───────────────────────────────────────────────────────────────
function KpiBox({ Icon, label, value, sub, color, bg }: {
    Icon: React.ElementType; label: string; value: string; sub: string; color: string; bg: string;
}) {
    return (
        <div className="rounded-2xl p-4 flex flex-col gap-1.5" style={{ backgroundColor: bg }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
                <Icon size={18} style={{ color }} strokeWidth={1.8} />
            </div>
            <p className="text-[11px] font-bold leading-snug" style={{ color }}>{label}</p>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-[10px]" style={{ color: color + "99" }}>{sub}</p>
        </div>
    );
}