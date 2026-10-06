"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Droplet, Download, Users, Clock, Stethoscope, BedDouble, Search, RefreshCw, ClipboardList,
} from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { SectionCard } from "@/app/components/dashboard/live";
import { exportToExcel } from "@/lib/exportExcel";
import type { BloodTransfusionData, TransfusionRow } from "@/lib/bloodTransfusion.service";

const RED = { 50: "#FEF2F2", 100: "#FEE2E2", 600: "#DC2626", 700: "#B91C1C", 800: "#991B1B" };
const OPD_COLOR = "#2563EB";
const IPD_COLOR = "#B91C1C";

const fmt = (n: number) => n.toLocaleString("th-TH");

function toYmd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD → dd/mm/yy (พ.ศ.) เช่น 01/10/69 */
function thShort(ymd: string): string {
    if (!ymd) return "–";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${String(Number(y) + 543).slice(-2)}`;
}

/** นาที → "3 ชม. 45 นาที" */
function fmtDuration(min: number | null): string {
    if (min == null) return "–";
    return `${Math.floor(min / 60)} ชม. ${String(min % 60).padStart(2, "0")} นาที`;
}

function bangkokToday(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}

type Preset = "today" | "month" | "fiscal" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "วันนี้" },
    { key: "month", label: "เดือนนี้" },
    { key: "fiscal", label: "ปีงบประมาณ" },
    { key: "custom", label: "กำหนดเอง" },
];

/** ปีงบประมาณ (พ.ศ.) ปัจจุบัน — งบเริ่ม 1 ต.ค. */
function currentFiscalYearBE(): number {
    const today = bangkokToday();
    return (today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear()) + 543;
}

/** ปีงบที่เลือกได้: ปีปัจจุบัน + ย้อนหลัง 5 ปี */
const FISCAL_YEAR_BACK = 5;
function fiscalYearOptions(): number[] {
    const cur = currentFiscalYearBE();
    return Array.from({ length: FISCAL_YEAR_BACK + 1 }, (_, i) => cur - i);
}

/** ช่วงวันของปีงบ พ.ศ. (1 ต.ค. ปีก่อน – 30 ก.ย.) ไม่เกินวันนี้ */
function fiscalRange(yearBE: number): { start: Date; end: Date } {
    const today = bangkokToday();
    const ce = yearBE - 543;
    const fyEnd = new Date(ce, 8, 30);
    return { start: new Date(ce - 1, 9, 1), end: fyEnd > today ? today : fyEnd };
}

function presetRange(p: Exclude<Preset, "custom">, fiscalYearBE = currentFiscalYearBE()): { start: Date; end: Date } {
    const today = bangkokToday();
    if (p === "today") return { start: today, end: today };
    if (p === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    return fiscalRange(fiscalYearBE);
}

type TypeFilter = "ALL" | "OPD" | "IPD";

function statusOf(r: TransfusionRow): { label: string; cls: string } {
    if (!r.startTime) return { label: "ไม่มีเวลา", cls: "bg-gray-100 text-gray-600" };
    if (r.endEstimated) return { label: "≈ ประมาณ 4 ชม.", cls: "bg-amber-50 text-amber-700" };
    return { label: "✓ ครบถ้วน", cls: "bg-emerald-50 text-emerald-700" };
}

export default function BloodTransfusionPage() {
    const initial = presetRange("month");
    const [preset, setPreset] = useState<Preset>("month");
    const [fiscalYear, setFiscalYear] = useState<number>(currentFiscalYearBE);
    const [customStart, setCustomStart] = useState<Date>(initial.start);
    const [customEnd, setCustomEnd] = useState<Date>(initial.end);
    const [range, setRange] = useState({ start: toYmd(initial.start), end: toYmd(initial.end) });

    const [data, setData] = useState<BloodTransfusionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
    const [dept, setDept] = useState("");
    const [q, setQ] = useState("");

    const load = useCallback(async (r: { start: string; end: string }, signal?: AbortSignal) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams(r);
            const res = await fetch(`/api/blood-transfusion?${params}`, { credentials: "include", signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "ไม่สามารถดึงข้อมูลได้");
            setData(json as BloodTransfusionData);
        } catch (e) {
            if (signal?.aborted) return;
            setData(null);
            setError(e instanceof Error ? e.message : "ไม่สามารถดึงข้อมูลได้");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const c = new AbortController();
        void load(range, c.signal);
        return () => c.abort();
    }, [range, load]);

    function choosePreset(p: Preset, fy = fiscalYear) {
        setPreset(p);
        if (p === "custom") return;
        const r = presetRange(p, fy);
        setCustomStart(r.start);
        setCustomEnd(r.end);
        setRange({ start: toYmd(r.start), end: toYmd(r.end) });
    }

    function applyCustom() {
        if (customStart > customEnd) {
            setError("กรุณาระบุช่วงวันที่ให้ถูกต้อง");
            return;
        }
        setRange({ start: toYmd(customStart), end: toYmd(customEnd) });
    }

    const allRows = useMemo(() => data?.rows ?? [], [data]);
    const departments = useMemo(
        () => [...new Set(allRows.map((r) => r.department))].sort((a, b) => a.localeCompare(b, "th")),
        [allRows],
    );

    const rows = useMemo(() => {
        const term = q.trim().toLowerCase();
        return allRows.filter((r) =>
            (typeFilter === "ALL" || r.type === typeFilter)
            && (!dept || r.department === dept)
            && (!term || r.hn.includes(term) || r.an.includes(term) || r.patientName.toLowerCase().includes(term)));
    }, [allRows, typeFilter, dept, q]);

    const kpi = useMemo(() => {
        const durs = rows.map((r) => r.durationMin).filter((v): v is number => v != null);
        return {
            total: rows.length,
            patients: new Set(rows.map((r) => r.hn)).size,
            opd: rows.filter((r) => r.type === "OPD").length,
            ipd: rows.filter((r) => r.type === "IPD").length,
            avg: durs.length ? Math.round(durs.reduce((s, v) => s + v, 0) / durs.length) : null,
        };
    }, [rows]);

    const chartData = useMemo(() => {
        const m = new Map<string, { opd: number; ipd: number }>();
        for (const r of rows) {
            const v = m.get(r.transfusionDate) ?? { opd: 0, ipd: 0 };
            if (r.type === "OPD") v.opd++; else v.ipd++;
            m.set(r.transfusionDate, v);
        }
        return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date: thShort(date), OPD: v.opd, IPD: v.ipd }));
    }, [rows]);

    function handleExport() {
        if (!rows.length) return;
        exportToExcel(
            rows.map((r) => ({
                "HN": r.hn,
                "AN": r.an || "-",
                "ชื่อ-สกุล": r.patientName,
                "ประเภทบริการ": r.type,
                "แผนก": r.department,
                "วันที่รับบริการ": thShort(r.serviceDate),
                "วันที่ได้รับเลือด": thShort(r.transfusionDate),
                "ICD9CM": r.icd9,
                "Extension Code": r.extCode || "-",
                "ครั้งที่": r.round,
                "เวลาเริ่ม": r.startTime || "-",
                "เวลาสิ้นสุด": r.endTime || "-",
                "ระยะเวลา": fmtDuration(r.durationMin),
                "ระยะเวลา (นาที)": r.durationMin ?? "",
                "สถานะ": statusOf(r).label,
            })),
            { sheetName: "Blood Transfusion", filePrefix: `blood_transfusion_${range.start}_${range.end}`, dateKeys: [] },
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-5 text-gray-800">
            {/* ── Header ── */}
            <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: RED[100] }}>
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: RED[700] }}>
                        <Droplet size={18} fill={RED[600]} /> BLOOD TRANSFUSION – DETAIL
                    </div>
                    <h1 className="mt-1 text-2xl font-bold md:text-3xl" style={{ color: RED[800] }}>
                        รายละเอียดผู้ป่วยที่ได้รับเลือด (PRC)
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        OPD + IPD · หัตถการ ICD-9-CM 9904 · ช่วงวันที่ได้รับเลือด {thShort(range.start)} – {thShort(range.end)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load(range)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> รีเฟรช
                </button>
            </header>

            {/* ── Filters ── */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => choosePreset(p.key)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${preset === p.key ? "bg-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                            style={preset === p.key ? { color: RED[700] } : undefined}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {preset === "fiscal" && (
                    <select
                        aria-label="ปีงบประมาณ"
                        value={fiscalYear}
                        onChange={(e) => {
                            const fy = Number(e.target.value);
                            setFiscalYear(fy);
                            choosePreset("fiscal", fy);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                        {fiscalYearOptions().map((y) => (
                            <option key={y} value={y}>ปีงบประมาณ {y}</option>
                        ))}
                    </select>
                )}
                {preset === "custom" && (
                    <div className="flex flex-wrap items-center gap-2">
                        <DatePicker
                            selected={customStart}
                            onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                            dateFormat="dd/MM/yyyy" locale={th}
                            showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                        <span className="text-sm text-gray-500">ถึง</span>
                        <DatePicker
                            selected={customEnd}
                            onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                            dateFormat="dd/MM/yyyy" locale={th}
                            showMonthDropdown showYearDropdown dropdownMode="select" yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                        <button
                            type="button"
                            onClick={applyCustom}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                            style={{ background: RED[700] }}
                        >
                            <Search size={15} /> ค้นหา
                        </button>
                    </div>
                )}
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

            {/* ── KPI ── */}
            <section aria-label="สรุป" className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                    { label: "จำนวนครั้งที่ได้รับเลือด", value: kpi.total, unit: "ครั้ง", Icon: Droplet, color: RED[700] },
                    { label: "ผู้ป่วย", value: kpi.patients, unit: "คน", Icon: Users, color: "#374151" },
                    { label: "OPD", value: kpi.opd, unit: "ครั้ง", Icon: Stethoscope, color: OPD_COLOR },
                    { label: "IPD", value: kpi.ipd, unit: "ครั้ง", Icon: BedDouble, color: IPD_COLOR },
                ].map(({ label, value, unit, Icon, color }) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500"><Icon size={14} style={{ color }} /> {label}</div>
                        <p className="mt-1 text-2xl font-bold" style={{ color }}>
                            {loading ? "…" : fmt(value)} <span className="text-sm font-medium text-gray-500">{unit}</span>
                        </p>
                    </div>
                ))}
                <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:col-span-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500"><Clock size={14} /> เวลาเฉลี่ยต่อครั้ง</div>
                    <p className="mt-1 text-xl font-bold text-gray-800">{loading ? "…" : fmtDuration(kpi.avg)}</p>
                </div>
            </section>

            {/* ── Chart ── */}
            <SectionCard title="จำนวนครั้งที่ได้รับเลือดรายวัน (OPD / IPD)" icon={Droplet} titleColor={RED[700]}>
                {loading ? (
                    <p className="py-16 text-center text-gray-500">กำลังโหลดข้อมูล...</p>
                ) : chartData.length ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="OPD" stackId="a" fill={OPD_COLOR} />
                                <Bar dataKey="IPD" stackId="a" fill={IPD_COLOR} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="py-16 text-center text-gray-500">ไม่พบข้อมูลในช่วงวันที่กำหนด</p>
                )}
            </SectionCard>

            {/* ── Drill-through table ── */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 md:px-5">
                    <div>
                        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
                            <ClipboardList size={17} style={{ color: RED[700] }} /> รายละเอียดการได้รับเลือด (OPD + IPD)
                        </h2>
                        <p className="text-sm text-gray-500">{loading ? "กำลังโหลด..." : `แสดง ${fmt(rows.length)} รายการ`}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                            {(["ALL", "OPD", "IPD"] as TypeFilter[]).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTypeFilter(t)}
                                    className={`rounded-md px-3 py-1 text-sm font-medium ${typeFilter === t ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`}
                                >
                                    {t === "ALL" ? "ทั้งหมด" : t}
                                </button>
                            ))}
                        </div>
                        <select
                            aria-label="แผนก"
                            value={dept}
                            onChange={(e) => setDept(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        >
                            <option value="">ทุกแผนก</option>
                            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                            aria-label="ค้นหา HN / AN / ชื่อ"
                            placeholder="ค้นหา HN / AN / ชื่อ"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={loading || rows.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: RED[700] }}
                        >
                            <Download size={15} /> Excel
                        </button>
                    </div>
                </div>
                <div className="max-h-[620px] overflow-auto">
                    <table className="w-full min-w-[1200px] text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold text-gray-600">
                            <tr>
                                {["HN", "AN", "ชื่อ-สกุล", "ประเภทบริการ", "แผนก", "วันที่รับบริการ", "วันที่ได้รับเลือด",
                                    "ICD9CM", "Extension Code", "ครั้งที่", "เวลาเริ่ม", "เวลาสิ้นสุด", "ระยะเวลา", "สถานะ"].map((h) => (
                                    <th key={h} scope="col" className="whitespace-nowrap border-b border-gray-200 px-3 py-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={14} className="px-3 py-12 text-center text-gray-500">กำลังโหลดข้อมูล...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={14} className="px-3 py-12 text-center text-gray-500">{error ? "ไม่สามารถแสดงข้อมูลได้" : "ไม่พบข้อมูลในช่วงวันที่กำหนด"}</td></tr>
                            ) : rows.map((r) => {
                                const st = statusOf(r);
                                return (
                                    <tr key={r.id} className="hover:bg-red-50/40">
                                        <td className="px-3 py-2.5 font-mono">{r.hn}</td>
                                        <td className="px-3 py-2.5 font-mono">{r.an || "–"}</td>
                                        <td className="px-3 py-2.5 font-medium">{r.patientName}</td>
                                        <td className="px-3 py-2.5">
                                            <span
                                                className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                                                style={{ background: r.type === "OPD" ? OPD_COLOR : IPD_COLOR }}
                                            >
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5" title={r.ward || undefined}>{r.department}</td>
                                        <td className="whitespace-nowrap px-3 py-2.5">{thShort(r.serviceDate)}</td>
                                        <td className="whitespace-nowrap px-3 py-2.5">{thShort(r.transfusionDate)}</td>
                                        <td className="px-3 py-2.5 font-mono">{r.icd9}</td>
                                        <td className="px-3 py-2.5 font-mono">{r.extCode || "–"}</td>
                                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: RED[700] }}>ครั้งที่ {r.round}</td>
                                        <td className="px-3 py-2.5 font-mono">{r.startTime || "–"}</td>
                                        <td className="px-3 py-2.5 font-mono">
                                            {r.endTime || "–"}
                                            {r.endEstimated && <span className="ml-1 text-amber-600" title="ประมาณจากเวลาเริ่ม + 4 ชม.">*</span>}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5">{fmtDuration(r.durationMin)}</td>
                                        <td className="whitespace-nowrap px-3 py-2.5">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 md:px-5">
                    <p>* เวลาสิ้นสุดที่ไม่ได้บันทึกในหัตถการ ประมาณจาก เวลาเริ่ม + 4 ชม. (เวลาให้เลือดจริงโดยประมาณ) · ครั้งที่ นับจาก Extension Code (ไม่มี → เรียงตามเวลาใน visit/admission)</p>
                    {data?.columns && (
                        <p>
                            แหล่งข้อมูล — OPD: doctor_operation (ext: {data.columns.opd.ext ?? "–"}, เริ่ม: {data.columns.opd.start ?? "–"}, สิ้นสุด: {data.columns.opd.end ?? "–"})
                            {" · "}IPD: iptoprt (ext: {data.columns.ipd.ext ?? "–"}, เริ่ม: {data.columns.ipd.start ?? "–"}, สิ้นสุด: {data.columns.ipd.end ?? "–"})
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}
