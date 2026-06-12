// app/pages/dmht-new/page.tsx
"use client";

import { useState, useCallback } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { AnimatePresence, motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
    Activity,
    HeartPulse,
    Users,
    ChevronRight,
    ChevronDown,
    Search,
    MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import ThaiDateInput from "@/app/components/ThaiDateInput";
import { formatDate } from "@/lib/dateUtils";
import { cardVariants, pageVariants } from "@/lib/variants";

// ── Types (mirror lib/dmht.service.ts) ──────────────────────────────────────
interface MooRow {
    tmbpart: string;
    tmb_name: string;
    moopart: string;
    moo_name: string;
    dm: number;
    ht: number;
    total: number;
}
interface TambonRow {
    tmbpart: string;
    tmb_name: string;
    dm: number;
    ht: number;
    total: number;
    moo: MooRow[];
}
interface DmhtData {
    start: string;
    end: string;
    fiscalYear: string;
    totalDM: number;
    totalHT: number;
    grandTotal: number;
    byTambon: TambonRow[];
}

const MINT = "#1a5233";

// ── ปีงบประมาณ (พ.ศ.) — 1 ต.ค.(FY-1) ถึง 30 ก.ย.(FY) ──────────────────────────
function currentFiscalYear(): number {
    const d = new Date();
    const be = d.getFullYear() + 543;
    return d.getMonth() >= 9 ? be + 1 : be; // ต.ค. (เดือน index 9) ขึ้นไป = ปีงบถัดไป
}
function fiscalRange(fyBE: number): { start: Date; end: Date } {
    const gStart = fyBE - 543 - 1; // ปี ค.ศ. ของ 1 ต.ค.
    const gEnd = fyBE - 543; // ปี ค.ศ. ของ 30 ก.ย.
    const start = new Date(gStart, 9, 1); // 1 ต.ค.
    let end = new Date(gEnd, 8, 30); // 30 ก.ย.
    const now = new Date();
    if (end > now) end = now; // ปีงบปัจจุบัน/อนาคต ตัดที่วันนี้
    return { start, end };
}
const TODAY_FY = currentFiscalYear();
const FY_OPTIONS = [0, 1, 2, 3, 4].map((i) => TODAY_FY - i); // 2569..2565
const INIT = fiscalRange(TODAY_FY);

// ช่วง 6 เดือน (ครึ่งปีงบ): part1 = ต.ค.(fy-1)–มี.ค.(fy), part2 = เม.ย.(fy)–ก.ย.(fy)
function halfRange(fyBE: number, part: 1 | 2): { start: Date; end: Date } {
    const gPrev = fyBE - 543 - 1;
    const gCur = fyBE - 543;
    let start: Date;
    let end: Date;
    if (part === 1) {
        start = new Date(gPrev, 9, 1); // 1 ต.ค.
        end = new Date(gCur, 2, 31); // 31 มี.ค.
    } else {
        start = new Date(gCur, 3, 1); // 1 เม.ย.
        end = new Date(gCur, 8, 30); // 30 ก.ย.
    }
    const now = new Date();
    if (end > now) end = now;
    return { start, end };
}
const NOW_MONTH = new Date().getMonth();
const INIT_HALF = NOW_MONTH >= 3 && NOW_MONTH <= 8 ? 2 : 1; // ตอนนี้อยู่ครึ่งไหน

// Dropdown แบบมีลูกศร (native select + ChevronDown)
function Dropdown({
    value,
    onChange,
    children,
    minWidth,
}: {
    value: string | number;
    onChange: (v: string) => void;
    children: React.ReactNode;
    minWidth?: number;
}) {
    return (
        <div className="relative inline-block">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none text-sm font-semibold pl-4 pr-9 py-2 rounded-lg border bg-white text-[#1a5233] border-[#cfe7d8] focus:outline-none focus:ring-2 focus:ring-[#a8d5ba] cursor-pointer"
                style={{ minWidth }}
            >
                {children}
            </select>
            <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3aa36a] pointer-events-none"
            />
        </div>
    );
}

// ── KPI card ────────────────────────────────────────────────────────────────
function Kpi({
    icon: Icon,
    label,
    value,
    bg,
    accent,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    bg: string;
    accent: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-5 flex flex-col gap-2"
            style={{ backgroundColor: bg }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: accent + "22" }}
            >
                <Icon size={20} style={{ color: accent }} strokeWidth={1.9} />
            </div>
            <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>
                {label}
            </p>
            <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: accent }}
            >
                {Number(value ?? 0).toLocaleString()}
                <span className="text-sm font-medium ml-1">ราย</span>
            </p>
        </motion.div>
    );
}

// ── Tambon row (expandable) ───────────────────────────────────────────────────
function TambonBlock({ t, index }: { t: TambonRow; index: number }) {
    const [open, setOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white"
        >
            <button
                onClick={() => setOpen((p) => !p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0faf4] transition-colors text-left"
            >
                <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-green-700" />
                </span>
                <span className="flex-1 font-semibold text-gray-800">
                    {t.tmb_name}
                    <span className="text-xs text-gray-400 font-normal ml-2">
                        ({t.moo.length} หมู่บ้าน)
                    </span>
                </span>
                <span className="flex items-center gap-4 text-sm tabular-nums shrink-0">
                    <span className="text-blue-600 font-bold">DM {t.dm}</span>
                    <span className="text-rose-600 font-bold">HT {t.ht}</span>
                    <span
                        className="font-extrabold px-2.5 py-0.5 rounded-full border"
                        style={{
                            backgroundColor: "#f0faf4",
                            borderColor: "#a8d5ba",
                            color: MINT,
                        }}
                    >
                        {t.total}
                    </span>
                </span>
                <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight size={16} className="text-gray-400" />
                </motion.span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden border-t border-gray-100"
                    >
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500">
                                        <th className="px-4 py-2 text-left font-semibold">หมู่บ้าน</th>
                                        <th className="px-4 py-2 text-right font-semibold">DM</th>
                                        <th className="px-4 py-2 text-right font-semibold">HT</th>
                                        <th className="px-4 py-2 text-right font-semibold">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {t.moo.map((m, i) => (
                                        <tr
                                            key={m.moopart}
                                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                                        >
                                            <td className="px-4 py-2 text-gray-700">{m.moo_name}</td>
                                            <td className="px-4 py-2 text-right tabular-nums text-blue-600 font-medium">
                                                {m.dm}
                                            </td>
                                            <td className="px-4 py-2 text-right tabular-nums text-rose-600 font-medium">
                                                {m.ht}
                                            </td>
                                            <td className="px-4 py-2 text-right tabular-nums font-bold text-gray-800">
                                                {m.total}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── สร้างไฟล์ Excel (SheetJS / xlsx) ─────────────────────────────────────────
// หมายเหตุ: ใช้ xlsx รุ่นฟรี ใส่สี/เส้นขอบในเซลล์ไม่ได้ จึงเน้นจัด layout +
// ความกว้างคอลัมน์ + แยกชีตให้อ่านง่าย ตรงตามเทมเพลต
function buildWorkbook(data: DmhtData) {
    const fy = data.fiscalYear;
    const wb = XLSX.utils.book_new();

    // ───── Sheet 1: สรุป (ตามเทมเพลต) ─────
    const aoa: (string | number)[][] = [
        [`รายงาน DM HT รายใหม่ ประจำปีงบประมาณ ${fy}`],
        [`โรงพยาบาลพลับพลาชัย · งานปฐมภูมิ   (ช่วง ${data.start} ถึง ${data.end})`],
        [],
        ["โรค", "ปี", "ทั้งหมด", "แยกรายตำบล", "แยกรายหมู่บ้าน"],
        ["DM (เบาหวาน)", fy, data.totalDM, "ดูชีต “รายตำบล”", "ดูชีต “รายหมู่บ้าน”"],
        ["HT (ความดันโลหิตสูง)", fy, data.totalHT, "ดูชีต “รายตำบล”", "ดูชีต “รายหมู่บ้าน”"],
        ["รวมทั้งหมด", fy, data.grandTotal, "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 11 }, { wch: 22 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, "สรุป");

    // ───── Sheet 2: รายตำบล ─────
    const tAoa: (string | number)[][] = [
        ["DM / HT รายใหม่ — แยกรายตำบล"],
        ["ลำดับ", "ตำบล", "DM", "HT", "รวม"],
        ...(data.byTambon || []).map((t, i) => [i + 1, t.tmb_name, t.dm, t.ht, t.total]),
        ["", "รวมทั้งหมด", data.totalDM, data.totalHT, data.grandTotal],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(tAoa);
    ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ws2["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "รายตำบล");

    // ───── Sheet 3: รายหมู่บ้าน ─────
    const mAoa: (string | number)[][] = [
        ["DM / HT รายใหม่ — แยกรายหมู่บ้าน"],
        ["ลำดับ", "ตำบล", "หมู่บ้าน", "DM", "HT", "รวม"],
    ];
    let idx = 0;
    (data.byTambon || []).forEach((t) => {
        (t.moo || []).forEach((m) => {
            idx += 1;
            mAoa.push([idx, t.tmb_name, m.moo_name, m.dm, m.ht, m.total]);
        });
    });
    mAoa.push(["", "รวมทั้งหมด", "", data.totalDM, data.totalHT, data.grandTotal]);
    const ws3 = XLSX.utils.aoa_to_sheet(mAoa);
    ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    ws3["!cols"] = [
        { wch: 8 },
        { wch: 26 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, "รายหมู่บ้าน");

    return wb;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DmhtNewPage() {
    const [periodType, setPeriodType] = useState<"fiscal" | "half" | "custom">(
        "fiscal",
    );
    const [fyYear, setFyYear] = useState<number>(TODAY_FY);
    const [halfSel, setHalfSel] = useState<string>(`${TODAY_FY}-${INIT_HALF}`);
    const [start, setStart] = useState<Date | null>(INIT.start);
    const [end, setEnd] = useState<Date | null>(INIT.end);
    const [data, setData] = useState<DmhtData | null>(null);
    const [loading, setLoading] = useState(false);

    const applyFiscal = (y: number) => {
        const r = fiscalRange(y);
        setStart(r.start);
        setEnd(r.end);
    };
    const applyHalf = (sel: string) => {
        const [y, p] = sel.split("-").map(Number);
        const r = halfRange(y, p === 2 ? 2 : 1);
        setStart(r.start);
        setEnd(r.end);
    };
    const onPeriodType = (t: string) => {
        const type = t as "fiscal" | "half" | "custom";
        setPeriodType(type);
        if (type === "fiscal") applyFiscal(fyYear);
        else if (type === "half") applyHalf(halfSel);
        // custom: คงค่า start/end ไว้ให้ผู้ใช้แก้เอง
    };
    const onYear = (v: string) => {
        const y = Number(v);
        setFyYear(y);
        applyFiscal(y);
    };
    const onHalf = (v: string) => {
        setHalfSel(v);
        applyHalf(v);
    };

    const fetchData = useCallback(async () => {
        if (!start || !end) {
            toast.error("กรุณาเลือกช่วงวันที่");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `/api/dmht-new?start=${formatDate(start)}&end=${formatDate(end)}`,
                { credentials: "include" },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }, [start, end]);

    const handleExport = () => {
        if (!data) return;
        try {
            const wb = buildWorkbook(data);
            const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
            saveAs(
                new Blob([buf], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
                `DM_HT_รายใหม่_ปีงบ${data.fiscalYear}.xlsx`,
            );
        } catch {
            toast.error("ออกไฟล์ Excel ไม่สำเร็จ");
        }
    };

    return (
        <motion.div
            className="space-y-5 text-gray-800 p-4 md:p-6"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
        >
            <Toaster position="top-center" />

            {/* Title */}
            <motion.div variants={cardVariants}>
                <h1 className="text-xl md:text-2xl font-bold" style={{ color: MINT }}>
                    รายงาน DM / HT รายใหม่
                </h1>
                <p className="text-sm text-gray-500">
                    ผู้ขึ้นทะเบียนคลินิกโรคเรื้อรังรายใหม่ในเขตรับผิดชอบ — งานปฐมภูมิ
                    {data && (
                        <span className="font-semibold"> · ปีงบประมาณ {data.fiscalYear}</span>
                    )}
                </p>
            </motion.div>

            {/* Filter bar */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5"
            >
                <div className="flex flex-wrap items-end gap-4">
                    {/* ประเภทช่วงเวลา */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            ช่วงเวลา
                        </label>
                        <Dropdown value={periodType} onChange={onPeriodType} minWidth={140}>
                            <option value="fiscal">ปีงบประมาณ</option>
                            <option value="half">6 เดือน</option>
                            <option value="custom">กำหนดเอง</option>
                        </Dropdown>
                    </div>

                    {/* ปีงบประมาณ */}
                    {periodType === "fiscal" && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                เลือกปี
                            </label>
                            <Dropdown value={fyYear} onChange={onYear} minWidth={150}>
                                {FY_OPTIONS.map((y) => (
                                    <option key={y} value={y}>
                                        ปีงบประมาณ {y}
                                    </option>
                                ))}
                            </Dropdown>
                        </div>
                    )}

                    {/* 6 เดือน (ครึ่งปีงบ) */}
                    {periodType === "half" && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                เลือกรอบ 6 เดือน
                            </label>
                            <Dropdown value={halfSel} onChange={onHalf} minWidth={220}>
                                {FY_OPTIONS.map((y) => [
                                    <option key={`${y}-1`} value={`${y}-1`}>
                                        ครึ่งแรก ปีงบ {y} (ต.ค.{y - 1}–มี.ค.{y})
                                    </option>,
                                    <option key={`${y}-2`} value={`${y}-2`}>
                                        ครึ่งหลัง ปีงบ {y} (เม.ย.–ก.ย.{y})
                                    </option>,
                                ])}
                            </Dropdown>
                        </div>
                    )}

                    {/* กำหนดเอง: ช่องวันที่ */}
                    {periodType === "custom" && (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    วันที่เริ่ม
                                </label>
                                <DatePicker
                                    selected={start}
                                    onChange={(d: Date | null) => setStart(d)}
                                    dateFormat="dd/MM/yyyy"
                                    locale={th}
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    customInput={<ThaiDateInput />}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    วันที่สิ้นสุด
                                </label>
                                <DatePicker
                                    selected={end}
                                    onChange={(d: Date | null) => setEnd(d)}
                                    dateFormat="dd/MM/yyyy"
                                    locale={th}
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    customInput={<ThaiDateInput />}
                                />
                            </div>
                        </>
                    )}

                    {/* ช่วงวันที่ที่กำลังใช้ (โหมด preset) */}
                    {periodType !== "custom" && start && end && (
                        <div className="text-xs text-gray-400 pb-2 self-end">
                            {formatDate(start)} ถึง {formatDate(end)}
                        </div>
                    )}

                    {/* ปุ่ม */}
                    <div className="flex gap-3 ml-auto items-end">
                        <motion.button
                            onClick={fetchData}
                            disabled={loading}
                            className="text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2"
                            style={{ backgroundColor: "#3aa36a" }}
                            whileHover={{ scale: 1.04, backgroundColor: "#2d8a56" }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {loading ? (
                                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search size={15} />
                            )}
                            ค้นหา
                        </motion.button>

                        <AnimatePresence>
                            {data && (
                                <motion.button
                                    onClick={handleExport}
                                    className="text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md"
                                    style={{ backgroundColor: "#7ec8a0" }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    whileHover={{ scale: 1.04, backgroundColor: "#55b882" }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Export Excel
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            {/* KPI cards */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Kpi
                        icon={Activity}
                        label="DM รายใหม่ (เบาหวาน)"
                        value={data.totalDM}
                        bg="#eff6ff"
                        accent="#1d4ed8"
                    />
                    <Kpi
                        icon={HeartPulse}
                        label="HT รายใหม่ (ความดันโลหิตสูง)"
                        value={data.totalHT}
                        bg="#fef2f2"
                        accent="#be123c"
                    />
                    <Kpi
                        icon={Users}
                        label="รวมทั้งหมด"
                        value={data.grandTotal}
                        bg="#f0faf4"
                        accent={MINT}
                    />
                </div>
            )}

            {/* Tambon list */}
            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-5 space-y-3"
                >
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-bold text-gray-600">
                            แยกรายตำบล / หมู่บ้าน
                        </h2>
                        <span className="text-xs text-gray-400">คลิกตำบลเพื่อดูรายหมู่บ้าน</span>
                    </div>

                    {(data.byTambon ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-12">
                            ไม่พบข้อมูลในช่วงเวลานี้
                        </p>
                    ) : (
                        (data.byTambon ?? []).map((t, i) => (
                            <TambonBlock key={t.tmbpart} t={t} index={i} />
                        ))
                    )}
                </motion.div>
            )}

            {!data && !loading && (
                <div className="text-center py-20 text-gray-400 text-sm">
                    เลือกปีงบประมาณหรือช่วงวันที่ แล้วกด “ค้นหา” เพื่อแสดงข้อมูล
                </div>
            )}
        </motion.div>
    );
}