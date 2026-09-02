"use client";

// รายงาน "การทำหัตถการที่ห้อง ER"
// filter: ช่วงวัน (เลือกเอง) / ปีงบประมาณ / รายเดือน / หัตถการ (เลือกได้หลายรายการ)
// ข้อมูลจาก /api/er-procedures — ดึงทั้งช่วงมาครั้งเดียว แล้วกรองหัตถการ/คำค้นฝั่ง client
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Activity, CalendarDays, Clock, Download, RefreshCw, Scissors, Search,
    Stethoscope, TrendingUp, UserRound, Users,
} from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { SectionCard, LiveBadge, HBarList, MiniPagination } from "@/app/components/dashboard/live";
import { Dropdown } from "@/app/pages/rdu-dashboard/_components/Dropdown";
import { ProcedurePicker } from "./_components/ProcedurePicker";
import { exportToExcel } from "@/lib/exportExcel";
import { formatThaiDate } from "@/lib/dateUtils";
import {
    fmtDate, getBangkokToday, getCurrentFiscalYear, recentFiscalYears,
    THAI_MONTHS_SHORT, toThaiDateLabel,
} from "@/lib/thaiDate";
import { usePagination } from "@/hooks/usePagination";
import type { ErProceduresData, ErProcedureRow } from "@/lib/erProcedures.service";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── ธีมมิ้นต์ (เดียวกับทั้งเว็บ) ──────────────────────────────────────────────
const MINT = { 300: "#7ec8a0", 500: "#3aa36a", 700: "#236b43", 800: "#1a5233" };
const BAR_COLORS = ["#3aa36a", "#378ADD", "#E2A33A", "#8B5CF6", "#E24B4A", "#0EA5E9", "#EC4899"];

const fmt = (n: number) => n.toLocaleString("th-TH");
const sexLabel = (s: string) => (s === "1" ? "ชาย" : s === "2" ? "หญิง" : "-");
const PAGE_SIZE = 25;

// ─── ตัวเลือกช่วงเวลา ─────────────────────────────────────────────────────────
type Mode = "fiscal" | "month" | "custom";
const MODES: { key: Mode; label: string }[] = [
    { key: "fiscal", label: "ทั้งปีงบประมาณ" },
    { key: "month", label: "รายเดือน" },
    { key: "custom", label: "เลือกวันเอง" },
];

/** เดือนที่ i ของปีงบ (0 = ต.ค. … 11 = ก.ย.) ของปีงบ พ.ศ. ที่ระบุ */
function fiscalMonth(fyBE: number, i: number): { year: number; month: number } {
    const ceEnd = fyBE - 543;          // ปี ค.ศ. ที่ปีงบสิ้นสุด (ก.ย.)
    const abs = 9 + i;                 // ต.ค. = index 9 ของปีปฏิทิน
    return { year: ceEnd - 1 + Math.floor(abs / 12), month: abs % 12 };
}

/** ช่วงวันของ mode ปัจจุบัน — ตัดปลายไม่ให้เกินวันนี้ */
function rangeOf(
    mode: Mode, fyBE: number, monthIdx: number, cStart: Date, cEnd: Date,
): { start: Date; end: Date } {
    const today = getBangkokToday();
    if (mode === "custom") return { start: cStart, end: cEnd };

    if (mode === "month") {
        const { year, month } = fiscalMonth(fyBE, monthIdx);
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0); // วันสุดท้ายของเดือน
        return { start, end: end > today ? today : end };
    }

    const ceEnd = fyBE - 543;
    const end = new Date(ceEnd, 8, 30); // 30 ก.ย.
    return { start: new Date(ceEnd - 1, 9, 1), end: end > today ? today : end };
}

/** index (0-11 แบบปีงบ) ของเดือนปัจจุบัน — ต.ค. = 0 */
function currentFiscalMonthIdx(): number {
    return (getBangkokToday().getMonth() + 3) % 12; // ต.ค.(9) → 0, พ.ย.(10) → 1, ม.ค.(0) → 3
}

/** เดือนของปีงบที่ "เริ่มแล้ว" — ปีงบปัจจุบันจะยังไม่ครบ 12 เดือน */
function monthOptionsOf(fyBE: number): { key: string; label: string }[] {
    const today = getBangkokToday();
    const out: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
        const { year, month } = fiscalMonth(fyBE, i);
        if (new Date(year, month, 1) > today) break;
        out.push({ key: String(i), label: `${THAI_MONTHS_SHORT[month]} ${year + 543}` });
    }
    return out;
}

/** "2026-03" → "มี.ค. 69" (แกน x ของกราฟแนวโน้ม) */
function monthLabel(ym: string): string {
    const [y, m] = ym.split("-").map(Number);
    if (!y || !m) return ym;
    return `${THAI_MONTHS_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th
            className={`text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-r border-[#a8d5ba] ${right ? "text-right" : "text-left"}`}
            style={{ backgroundColor: MINT[300] }}
        >
            {children}
        </th>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ErProceduresPage() {
    const [mode, setMode] = useState<Mode>("fiscal");
    const [fiscalYear, setFiscalYear] = useState<number>(() => getCurrentFiscalYear());
    const [monthIdx, setMonthIdx] = useState<string>(() => String(currentFiscalMonthIdx()));
    const [customStart, setCustomStart] = useState<Date>(
        () => rangeOf("fiscal", getCurrentFiscalYear(), 0, new Date(), new Date()).start,
    );
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());

    const [data, setData] = useState<ErProceduresData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<string[]>([]); // icode ที่เลือก (ว่าง = ทุกหัตถการ)
    const [keyword, setKeyword] = useState("");

    // เดือนที่เลือกอาจไม่มีในปีงบใหม่ (เช่นสลับมาปีงบปัจจุบันที่ยังไม่ถึงเดือนนั้น)
    const monthOptions = useMemo(() => monthOptionsOf(fiscalYear), [fiscalYear]);
    const effMonthIdx = monthOptions.some((o) => o.key === monthIdx)
        ? monthIdx
        : (monthOptions[monthOptions.length - 1]?.key ?? "0");

    const range = useMemo(
        () => rangeOf(mode, fiscalYear, Number(effMonthIdx), customStart, customEnd),
        [mode, fiscalYear, effMonthIdx, customStart, customEnd],
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/er-procedures?start=${fmtDate(range.start)}&end=${fmtDate(range.end)}`,
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
    }, [range]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── กรองฝั่ง client: หัตถการที่เลือก + คำค้น ─────────────────────────────
    const rows = useMemo(() => {
        const set = new Set(picked);
        const kw = keyword.trim().toLowerCase();
        return (data?.rows ?? []).filter((r) => {
            if (set.size && !set.has(r.icode)) return false;
            if (!kw) return true;
            return (
                r.patientName.toLowerCase().includes(kw) ||
                r.hn.toLowerCase().includes(kw) ||
                r.doctorName.toLowerCase().includes(kw) ||
                r.procedureName.toLowerCase().includes(kw) ||
                r.icode.includes(kw)
            );
        });
    }, [data, picked, keyword]);

    // ── สรุปจากแถวที่กรองแล้ว (KPI/กราฟจึงตรงกับ filter เสมอ) ────────────────
    const stats = useMemo(() => {
        const byProc = new Map<string, { name: string; icode: string; count: number }>();
        const byMonth = new Map<string, number>();
        const byDoctor = new Map<string, number>();
        const vn = new Set<string>();
        const hn = new Set<string>();
        let qty = 0;

        for (const r of rows) {
            const p = byProc.get(r.icode) ?? { name: r.procedureName, icode: r.icode, count: 0 };
            p.count += 1;
            byProc.set(r.icode, p);

            const m = r.vstdate.slice(0, 7);
            if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
            byDoctor.set(r.doctorName, (byDoctor.get(r.doctorName) ?? 0) + 1);

            if (r.vn) vn.add(r.vn);
            if (r.hn) hn.add(r.hn);
            qty += r.qty;
        }

        return {
            total: rows.length,
            visits: vn.size,
            patients: hn.size,
            types: byProc.size,
            qty,
            byProcedure: [...byProc.values()].sort((a, b) => b.count - a.count),
            byMonth: [...byMonth.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([m, count]) => ({ month: m, label: monthLabel(m), count })),
            byDoctor: [...byDoctor.entries()]
                .map(([name, count]) => ({ label: name, count }))
                .sort((a, b) => b.count - a.count),
        };
    }, [rows]);

    const topProcedures = useMemo(() => stats.byProcedure.slice(0, 12), [stats]);

    const { page, setPage, totalPages, paged } = usePagination(rows, PAGE_SIZE);

    const rangeLabel = data ? toThaiDateLabel(data.start, data.end) : "";
    const updatedAt = data
        ? new Date(data.updatedAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok", day: "2-digit", month: "short",
            year: "2-digit", hour: "2-digit", minute: "2-digit",
        })
        : "";

    const exportRows = () => {
        if (!rows.length) return;
        exportToExcel(
            rows.map((r: ErProcedureRow, i) => ({
                "ลำดับ": i + 1,
                "วันที่รับบริการ": formatThaiDate(r.vstdate),
                "เวลา": r.vsttime || "",
                HN: r.hn,
                VN: r.vn,
                "ชื่อ-นามสกุล": r.patientName,
                "อายุ": r.age || "",
                "เพศ": sexLabel(r.sex),
                "สิทธิ์การรักษา": r.pttypeName,
                "รหัสรายการ (icode)": r.icode,
                "รหัสหัตถการ ER": r.operCode,
                "ชื่อหัตถการ": r.procedureName,
                "จำนวน": r.qty,
                "แพทย์/ผู้ทำหัตถการ": r.doctorName,
            })),
            { filePrefix: "หัตถการที่ห้องER", sheetName: "ER Procedures" },
        );
    };

    const pickedLabel =
        picked.length === 0
            ? "ทุกหัตถการ"
            : picked
                .map((c) => data?.catalog.find((x) => x.icode === c)?.name ?? c)
                .join(", ");

    return (
        <div className="space-y-4 text-gray-800">
            {/* ── Header + filter ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Scissors size={18} style={{ color: MINT[800] }} />
                            <h1 className="text-lg font-bold text-gray-800">
                                การทำหัตถการที่ห้อง ER
                            </h1>
                            <LiveBadge />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-2">
                            <span>รายการหัตถการที่ทำกับผู้ป่วยห้องอุบัติเหตุ-ฉุกเฉิน (นับ 1 หัตถการ ต่อ 1 visit)</span>
                            {data && (
                                <>
                                    <span>·</span>
                                    <Clock size={11} />
                                    <span>{rangeLabel}</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {data && (
                            <span className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-gray-500 px-3 py-1.5 rounded-full whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,.2)]" />
                                update ล่าสุด · {updatedAt}
                            </span>
                        )}

                        <Dropdown<Mode> value={mode} options={MODES} onChange={setMode} />

                        {mode !== "custom" && (
                            <Dropdown<string>
                                value={String(fiscalYear)}
                                options={recentFiscalYears(5).map((y) => ({
                                    key: String(y),
                                    label: `ปีงบประมาณ ${y}`,
                                }))}
                                onChange={(v) => setFiscalYear(Number(v))}
                            />
                        )}

                        {mode === "month" && (
                            <Dropdown<string>
                                value={effMonthIdx}
                                options={monthOptions}
                                onChange={setMonthIdx}
                            />
                        )}

                        {mode === "custom" && (
                            <>
                                <DatePicker
                                    selected={customStart}
                                    onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                                    dateFormat="dd/MM/yyyy" locale={th}
                                    showMonthDropdown showYearDropdown dropdownMode="select"
                                    yearDropdownItemNumber={20}
                                    customInput={<ThaiDateInput />}
                                />
                                <DatePicker
                                    selected={customEnd}
                                    onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                                    dateFormat="dd/MM/yyyy" locale={th}
                                    showMonthDropdown showYearDropdown dropdownMode="select"
                                    yearDropdownItemNumber={20}
                                    customInput={<ThaiDateInput />}
                                />
                            </>
                        )}

                        <ProcedurePicker
                            catalog={data?.catalog ?? []}
                            selected={picked}
                            onChange={setPicked}
                            disabled={!data}
                        />
                    </div>
                </div>

                {picked.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 flex items-start gap-1.5">
                        <Stethoscope size={13} className="mt-0.5 flex-shrink-0" style={{ color: MINT[500] }} />
                        <span>
                            <span className="font-semibold text-gray-600">หัตถการที่เลือก:</span> {pickedLabel}
                        </span>
                    </p>
                )}

                {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                        <RefreshCw size={14} className="flex-shrink-0" />
                        <span>ดึงข้อมูลไม่สำเร็จ: {error}</span>
                        <button onClick={fetchData} className="ml-auto underline font-semibold">
                            ลองใหม่
                        </button>
                    </div>
                )}
            </div>

            {/* ── Loading ── */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── KPI ── */}
            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <KpiBox Icon={Activity} label="หัตถการทั้งหมด" value={fmt(stats.total)} sub="ครั้ง" color={MINT[800]} bg="#EAF3DE" />
                    <KpiBox Icon={CalendarDays} label="จำนวน visit" value={fmt(stats.visits)} sub="visit ที่มีหัตถการ" color="#185FA5" bg="#E6F1FB" />
                    <KpiBox Icon={Users} label="ผู้รับบริการ" value={fmt(stats.patients)} sub="คน (HN ไม่ซ้ำ)" color="#6B21A8" bg="#F3E8FF" />
                    <KpiBox Icon={Scissors} label="ชนิดหัตถการ" value={fmt(stats.types)} sub="รายการ" color="#854F0B" bg="#FAEEDA" />
                    <KpiBox Icon={UserRound} label="แพทย์/ผู้ทำหัตถการ" value={fmt(stats.byDoctor.length)} sub="คน" color="#A32D2D" bg="#FCEBEB" />
                </div>
            )}

            {/* ── กราฟ: หัตถการที่ทำมากที่สุด ── */}
            {data && (
                <SectionCard
                    title={`หัตถการที่ทำมากที่สุด${stats.byProcedure.length > 12 ? " (12 อันดับแรก)" : ""}`}
                    icon={Activity}
                    titleColor={MINT[800]}
                >
                    {topProcedures.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูลในช่วงเวลานี้</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(220, topProcedures.length * 34)}>
                            <BarChart
                                data={topProcedures}
                                layout="vertical"
                                margin={{ top: 4, right: 40, left: 12, bottom: 4 }}
                            >
                                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis
                                    type="category" dataKey="name" width={190}
                                    tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false}
                                />
                                <Tooltip
                                    formatter={(v: number | undefined) => [`${fmt(v ?? 0)} ครั้ง`, "จำนวน"]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                                    {topProcedures.map((_, i) => (
                                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                    ))}
                                    <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#4b5563" }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </SectionCard>
            )}

            {/* ── กราฟแนวโน้มรายเดือน + แพทย์ผู้ทำหัตถการ ── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <SectionCard title="แนวโน้มรายเดือน" icon={TrendingUp} titleColor={MINT[800]}>
                            {stats.byMonth.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูลในช่วงเวลานี้</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={stats.byMonth} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="#eef2f7" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            formatter={(v: number | undefined) => [`${fmt(v ?? 0)} ครั้ง`, "จำนวน"]}
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line
                                            type="monotone" dataKey="count" name="จำนวนหัตถการ"
                                            stroke={MINT[500]} strokeWidth={2.5}
                                            dot={{ r: 3, fill: MINT[500] }} activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </SectionCard>
                    </div>

                    <SectionCard title="แพทย์/ผู้ทำหัตถการ (10 อันดับแรก)" icon={Stethoscope} titleColor={MINT[800]}>
                        {stats.byDoctor.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูล</p>
                        ) : (
                            <HBarList
                                data={stats.byDoctor.slice(0, 10)}
                                colors={BAR_COLORS}
                                total={stats.total}
                                labelWidth={130}
                            />
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ── ตารางรายชื่อ ── */}
            {data && (
                <SectionCard
                    title={`รายละเอียดการทำหัตถการ — ${fmt(rows.length)}${rows.length !== data.rows.length ? `/${fmt(data.rows.length)}` : ""} ครั้ง`}
                    icon={Scissors}
                    titleColor={MINT[800]}
                >
                    <div className="flex flex-wrap justify-end items-center gap-2 mb-3">
                        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="ค้นหา ชื่อ / HN / แพทย์ / หัตถการ"
                                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-green-700 placeholder:text-gray-300"
                            />
                        </div>
                        <button
                            onClick={exportRows}
                            disabled={!rows.length}
                            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40"
                            style={{ backgroundColor: MINT[300] }}
                        >
                            <Download size={15} /> Export Excel
                        </button>
                    </div>

                    {rows.length === 0 ? (
                        <p className="text-center text-gray-400 py-8 text-sm">ไม่พบข้อมูล</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead className="sticky top-0">
                                        <tr>
                                            <Th right>ลำดับ</Th>
                                            <Th>วันที่รับบริการ</Th>
                                            <Th>เวลา</Th>
                                            <Th>HN</Th>
                                            <Th>ชื่อ-นามสกุล</Th>
                                            <Th right>อายุ</Th>
                                            <Th>เพศ</Th>
                                            <Th>สิทธิ์</Th>
                                            <Th>รหัส</Th>
                                            <Th>ชื่อหัตถการ</Th>
                                            <Th right>จำนวน</Th>
                                            <Th>แพทย์/ผู้ทำหัตถการ</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.map((r, i) => (
                                            <tr
                                                key={`${r.vn}-${r.icode}`}
                                                className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-[#f0faf4]`}
                                            >
                                                <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                                                    {(page - 1) * PAGE_SIZE + i + 1}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatThaiDate(r.vstdate)}</td>
                                                <td className="px-3 py-2 text-gray-500">{r.vsttime || "-"}</td>
                                                <td className="px-3 py-2 font-mono text-gray-700">{r.hn}</td>
                                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.patientName || "-"}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{r.age || "-"}</td>
                                                <td className="px-3 py-2 text-gray-600">{sexLabel(r.sex)}</td>
                                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.pttypeName || "-"}</td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono"
                                                        style={{ backgroundColor: "#EAF3DE", color: MINT[800] }}
                                                        title={r.operCode ? `รหัสหัตถการ ER ${r.operCode}` : undefined}
                                                    >
                                                        {r.icode}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.procedureName}</td>
                                                <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{fmt(r.qty)}</td>
                                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.doctorName}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <MiniPagination page={page} totalPages={totalPages} onChange={setPage} count={rows.length} />
                        </>
                    )}
                </SectionCard>
            )}

            {/* ── AI ── */}
            <AiSummaryCard
                summary={
                    data
                        ? {
                            ช่วงข้อมูล: rangeLabel,
                            หัตถการที่เลือก: pickedLabel,
                            จำนวนหัตถการทั้งหมด: stats.total,
                            จำนวน_visit: stats.visits,
                            จำนวนผู้รับบริการ: stats.patients,
                            ชนิดหัตถการที่ทำ: stats.types,
                            แยกตามหัตถการ: stats.byProcedure.slice(0, 15).map((p) => ({
                                รหัส: p.icode,
                                ชื่อหัตถการ: p.name,
                                จำนวนครั้ง: p.count,
                            })),
                            รายเดือน: stats.byMonth.map((m) => ({
                                เดือน: m.label,
                                จำนวนครั้ง: m.count,
                            })),
                            แยกตามผู้ทำหัตถการ: stats.byDoctor.slice(0, 10).map((d) => ({
                                ผู้ทำหัตถการ: d.label,
                                จำนวนครั้ง: d.count,
                            })),
                        }
                        : null
                }
                context="รายงานการทำหัตถการที่ห้องอุบัติเหตุ-ฉุกเฉิน (ER) โรงพยาบาลพลับพลาชัย — นับจากรายการค่าบริการที่อยู่ในทะเบียนหัตถการ ER ของผู้ป่วยที่ลงทะเบียน ER"
                disabled={!data}
            />
        </div>
    );
}

// ─── KPI box ─────────────────────────────────────────────────────────────────
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
