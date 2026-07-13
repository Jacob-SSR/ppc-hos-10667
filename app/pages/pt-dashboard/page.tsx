"use client";
import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Activity, Banknote, Stethoscope, UserCog,
    Search, ChevronRight, Printer, FileSpreadsheet, ListChecks, Clock, Table2,
    CalendarDays,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { exportToExcel } from "@/lib/exportExcel";
import {
    useAutoRefresh, timeAgo, CountdownRing,
    KpiCard, HBarList, SectionCard, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { Shimmer } from "@/app/components/ui/Shimmer";
import { EmptyState } from "@/app/components/ui/EmptyState";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { formatThaiDate } from "@/lib/dateUtils";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";
// ─── Types ──────────────────────────────────────────────────────────────────
interface PtRecord {
    date: string;
    shift: "morning" | "evening";
    staff_id: string;
    staff_name: string;
    role: "pt" | "pta";
    right: string;
    procedure: string;
    procedure_name: string;
    income: number;
    hn: string;
    patient_name: string;
}
interface PtQueueItem {
    queue_no: string;
    hn: string;
    patient_name: string;
    staff_name: string;
    vsttime: string;
    status: string;
}
interface ApiResp {
    records: PtRecord[];
    queue: PtQueueItem[];
    start: string;
    end: string;
    updatedAt: string;
}

type Preset = "today" | "7days" | "30days" | "thismonth" | "custom";

// ─── Constants / theme ──────────────────────────────────────────────────────
const REFRESH_MS = 60_000;

const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "วันนี้" },
    { key: "7days", label: "7 วัน" },
    { key: "30days", label: "30 วัน" },
    { key: "thismonth", label: "เดือนนี้" },
    { key: "custom", label: "กำหนดเอง" },
];

const MINT = {
    50: "#f0faf4", 100: "#d6f0e0", 200: "#a8d5ba", 300: "#7ec8a0",
    400: "#55b882", 500: "#3aa36a", 600: "#2d8a56", 700: "#236b43", 800: "#1a5233",
};

const SHIFT_LABEL: Record<string, string> = { morning: "เวรเช้า", evening: "เวรเย็น" };
const SHIFT_FULL: Record<string, string> = {
    morning: "เวรเช้า (08:30–16:30)",
    evening: "เวรเย็น (16:30–20:30)",
};

const RIGHT_COLOR: Record<string, string> = {
    UC: "#185FA5",
    "ข้าราชการ": "#3B6D11",
    "ประกันสังคม": "#854F0B",
    "จ่ายเอง": "#5b21b6",
};
const CHART_PALETTE = ["#185FA5", "#3B6D11", "#854F0B", "#5b21b6", "#3aa36a", "#c0392b"];

const baht = (n: number) => "฿" + (n || 0).toLocaleString();

// ─── Date helpers (สำหรับ custom range) ──────────────────────────────────────
function fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getBangkokToday(): Date {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
    const pt = role === "pt";
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pt ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
            {pt ? "PT" : "PTA"}
        </span>
    );
}

function ShiftBadge({ shift }: { shift: string }) {
    const m = shift === "morning";
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"}`}>
            {SHIFT_LABEL[shift] ?? shift}
        </span>
    );
}

// thead สีเขียวมินต์ ให้ตรงกับ TableHeader กลางของระบบ
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <th
            className={`text-white text-left px-3 py-2 text-xs font-semibold whitespace-nowrap ${className}`}
            style={{ backgroundColor: MINT[300] }}
        >
            {children}
        </th>
    );
}

// แถวตาราง zebra + hover แบบเดียวกับ TableRow กลาง
function Tr({ index, children }: { index: number; children: React.ReactNode }) {
    const base = index % 2 ? "#f9fafb" : "#ffffff";
    return (
        <tr
            className="border-b border-gray-100 transition-colors"
            style={{ backgroundColor: base }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = MINT[50])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = base)}
        >
            {children}
        </tr>
    );
}

function EmptyRow({ cols }: { cols: number }) {
    return (
        <tr>
            <td colSpan={cols} className="text-center text-gray-400 py-4 text-sm">
                ไม่มีข้อมูล
            </td>
        </tr>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PtDashboardPage() {
    const [preset, setPreset] = useState<Preset>("today");

    // ── custom range state ──
    const [customStart, setCustomStart] = useState<Date>(() => getBangkokToday());
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());
    // ช่วงที่ "ยืนยันแล้ว" (กด ค้นหา) — ใช้ประกอบ URL จริง
    const [appliedRange, setAppliedRange] = useState<{ start: string; end: string } | null>(null);

    // ── สร้าง URL ตาม preset ──
    // custom → ใช้ start/end ที่ยืนยันแล้ว (ถ้ายังไม่กดค้นหา ใช้วันนี้ไปก่อน)
    const apiUrl = useMemo(() => {
        if (preset === "custom") {
            if (appliedRange) {
                return `/api/pt-dashboard?preset=custom&start=${appliedRange.start}&end=${appliedRange.end}`;
            }
            const today = fmtDate(getBangkokToday());
            return `/api/pt-dashboard?preset=custom&start=${today}&end=${today}`;
        }
        return `/api/pt-dashboard?preset=${preset}`;
    }, [preset, appliedRange]);

    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<ApiResp>(apiUrl, REFRESH_MS);

    const records = useMemo(() => data?.records ?? [], [data]);
    const queue = useMemo(() => data?.queue ?? [], [data]);

    // ── เปลี่ยน preset ──
    const handlePreset = useCallback((key: Preset) => {
        setPreset(key);
        if (key === "custom" && !appliedRange) {
            // ตั้ง default เป็นวันนี้รอไว้
            const today = getBangkokToday();
            setCustomStart(today);
            setCustomEnd(today);
        }
    }, [appliedRange]);

    // ── กดค้นหาช่วง custom ──
    const handleCustomSearch = useCallback(() => {
        if (!customStart || !customEnd) return;
        let s = customStart;
        let e = customEnd;
        // กันกรณีเลือกกลับด้าน (start > end) → สลับให้
        if (s > e) { const t = s; s = e; e = t; }
        setAppliedRange({ start: fmtDate(s), end: fmtDate(e) });
    }, [customStart, customEnd]);

    // filters
    const [q, setQ] = useState("");
    const [fRight, setFRight] = useState("");
    const [fShift, setFShift] = useState("");
    const [fRole, setFRole] = useState("");

    // expand states
    const [openSD, setOpenSD] = useState<Record<string, boolean>>({});
    const [collapsedGrp, setCollapsedGrp] = useState<Record<string, boolean>>({});

    // ── KPI ──
    const kpi = useMemo(() => {
        const pts = new Set(records.map((r) => r.hn)).size;
        const inc = records.reduce((a, r) => a + r.income, 0);
        const pt = records.filter((r) => r.role === "pt");
        const pta = records.filter((r) => r.role === "pta");
        return {
            pts, vis: records.length, inc,
            ptV: pt.length, ptI: pt.reduce((a, r) => a + r.income, 0),
            ptaV: pta.length, ptaI: pta.reduce((a, r) => a + r.income, 0),
        };
    }, [records]);

    // ── staff summary ──
    const staffRows = useMemo(() => {
        const map: Record<string, { name: string; role: string; pts: Set<string>; vis: number; inc: number }> = {};
        records.forEach((r) => {
            if (!map[r.staff_id]) map[r.staff_id] = { name: r.staff_name, role: r.role, pts: new Set(), vis: 0, inc: 0 };
            map[r.staff_id].pts.add(r.hn);
            map[r.staff_id].vis++;
            map[r.staff_id].inc += r.income;
        });
        return Object.values(map).sort(
            (a, b) => (a.role === "pt" ? 0 : 1) - (b.role === "pt" ? 0 : 1) || b.vis - a.vis,
        );
    }, [records]);

    // ── shifts × rights ──
    const shiftData = useMemo(() => {
        const SH: Record<string, Record<string, { vis: number; inc: number }>> = { morning: {}, evening: {} };
        records.forEach((r) => {
            const sh = SH[r.shift] || SH.morning;
            if (!sh[r.right]) sh[r.right] = { vis: 0, inc: 0 };
            sh[r.right].vis++;
            sh[r.right].inc += r.income;
        });
        return SH;
    }, [records]);

    // ── right totals (pie) ──
    const rightPie = useMemo(() => {
        const map: Record<string, number> = {};
        records.forEach((r) => { map[r.right] = (map[r.right] || 0) + r.income; });
        return Object.entries(map).map(([name, value], i) => ({
            name, value, color: RIGHT_COLOR[name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
        }));
    }, [records]);

    // ── proc top (HBarList) ──
    const procTop = useMemo(() => {
        const map: Record<string, number> = {};
        records.forEach((r) => {
            if (r.procedure && r.procedure !== "-") map[r.procedure] = (map[r.procedure] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, count]) => ({ label, count }));
    }, [records]);

    // ── pivot staff × right ──
    const pivot = useMemo(() => {
        const staffMap: Record<string, Record<string, number>> = {};
        records.forEach((r) => {
            if (!staffMap[r.staff_name]) staffMap[r.staff_name] = {};
            staffMap[r.staff_name][r.right] = (staffMap[r.staff_name][r.right] || 0) + r.income;
        });
        const rights = [...new Set(records.map((r) => r.right))];
        const totals: Record<string, number> = {};
        rights.forEach((rr) => (totals[rr] = 0));
        let grand = 0;
        const rows = Object.entries(staffMap).map(([sn, rm]) => {
            const tot = Object.values(rm).reduce((a, b) => a + b, 0);
            grand += tot;
            rights.forEach((rr) => (totals[rr] += rm[rr] || 0));
            return { sn, rm, tot };
        });
        return { rights, totals, grand, rows };
    }, [records]);

    // ── staff detail ──
    const staffDetail = useMemo(() => {
        const map: Record<string, {
            name: string; role: string;
            shifts: Record<string, { vis: number; inc: number }>;
            rights: Record<string, { vis: number; inc: number }>;
            procs: Record<string, number>;
        }> = {};
        records.forEach((r) => {
            if (!map[r.staff_id]) map[r.staff_id] = { name: r.staff_name, role: r.role, shifts: {}, rights: {}, procs: {} };
            const s = map[r.staff_id];
            if (!s.shifts[r.shift]) s.shifts[r.shift] = { vis: 0, inc: 0 };
            s.shifts[r.shift].vis++; s.shifts[r.shift].inc += r.income;
            if (!s.rights[r.right]) s.rights[r.right] = { vis: 0, inc: 0 };
            s.rights[r.right].vis++; s.rights[r.right].inc += r.income;
            if (r.procedure && r.procedure !== "-") s.procs[r.procedure] = (s.procs[r.procedure] || 0) + 1;
        });
        return Object.entries(map).sort(
            (a, b) => (a[1].role === "pt" ? 0 : 1) - (b[1].role === "pt" ? 0 : 1),
        );
    }, [records]);

    // ── patient list grouped by staff ──
    const patientGroups = useMemo(() => {
        const grpMap: Record<string, { name: string; role: string; rows: PtRecord[] }> = {};
        records.forEach((r) => {
            if (!grpMap[r.staff_id]) grpMap[r.staff_id] = { name: r.staff_name, role: r.role, rows: [] };
            grpMap[r.staff_id].rows.push(r);
        });
        const ql = q.toLowerCase();
        const groups = Object.entries(grpMap)
            .sort((a, b) => (a[1].role === "pt" ? 0 : 1) - (b[1].role === "pt" ? 0 : 1))
            .map(([sid, grp]) => {
                if (fRole && grp.role !== fRole) return null;
                const filtered = grp.rows.filter((r) => {
                    const mq = !ql ||
                        r.hn.toLowerCase().includes(ql) ||
                        r.patient_name.toLowerCase().includes(ql) ||
                        r.procedure.toLowerCase().includes(ql);
                    const mr = !fRight || r.right === fRight;
                    const ms = !fShift || r.shift === fShift;
                    return mq && mr && ms;
                });
                if (!filtered.length) return null;
                const grpI = filtered.reduce((a, r) => a + r.income, 0);
                return { sid, grp, filtered, grpI };
            })
            .filter(Boolean) as { sid: string; grp: { name: string; role: string }; filtered: PtRecord[]; grpI: number }[];

        const grandV = groups.reduce((a, g) => a + g.filtered.length, 0);
        const grandI = groups.reduce((a, g) => a + g.grpI, 0);
        return { groups, grandV, grandI };
    }, [records, q, fRight, fShift, fRole]);

    // ── สรุปสำหรับ AI — ส่งเฉพาะสถิติรวม (ไม่ส่งชื่อ/HN ผู้ป่วย) ──
    const aiSummary = useMemo(() => {
        if (!records.length) return null;
        const topN = (obj: Record<string, number>, n = 8) =>
            Object.fromEntries(Object.entries(obj).sort(([, a], [, b]) => b - a).slice(0, n));
        const shiftAgg: Record<string, { visits: number; income: number }> = {};
        const rightAgg: Record<string, number> = {};
        const procAgg: Record<string, number> = {};
        records.forEach((r) => {
            const sh = SHIFT_LABEL[r.shift] || r.shift;
            if (!shiftAgg[sh]) shiftAgg[sh] = { visits: 0, income: 0 };
            shiftAgg[sh].visits++; shiftAgg[sh].income += r.income;
            rightAgg[r.right] = (rightAgg[r.right] || 0) + r.income;
            if (r.procedure && r.procedure !== "-") procAgg[r.procedure] = (procAgg[r.procedure] || 0) + 1;
        });
        return {
            ช่วงข้อมูล: data ? `${data.start} ถึง ${data.end}` : preset,
            ผู้ป่วยไม่ซ้ำ_ราย: kpi.pts,
            จำนวนครั้งบริการ_visits: kpi.vis,
            รายได้รวม_บาท: kpi.inc,
            แยกตามประเภทเจ้าหน้าที่: {
                นักกายภาพบำบัด_PT: { visits: kpi.ptV, รายได้: kpi.ptI },
                ผู้ช่วย_PTA: { visits: kpi.ptaV, รายได้: kpi.ptaI },
            },
            ภาระงานรายเจ้าหน้าที่: staffRows.map((s) => ({
                ชื่อ: s.name, ประเภท: s.role === "pt" ? "PT" : "PTA",
                ผู้ป่วย: s.pts.size, visits: s.vis, รายได้: s.inc,
            })),
            แยกตามเวร: shiftAgg,
            รายได้แยกตามสิทธิ์: topN(rightAgg),
            หัตถการที่ทำบ่อย: topN(procAgg),
            คิวคงเหลือ: queue.length,
        };
    }, [records, data, preset, kpi, staffRows, queue]);

    // ── export ──
    const onExportExcel = () => {
        if (!records.length) return;
        exportToExcel(
            records.map((r) => ({
                วันที่: r.date,
                เวร: SHIFT_LABEL[r.shift] || r.shift,
                เจ้าหน้าที่: r.staff_name,
                ประเภท: r.role === "pt" ? "PT" : "PTA",
                HN: r.hn,
                ชื่อผู้ป่วย: r.patient_name,
                หัตถการ: r.procedure,
                ชื่อหัตถการ: r.procedure_name,
                สิทธิ์: r.right,
                รายได้: r.income,
            })),
            { filePrefix: "รายงานกายภาพบำบัด", sheetName: "PT" },
        );
    };

    return (
        <div className="space-y-4 text-gray-800">
            {/* print: ซ่อนปุ่มควบคุม + จัด A4 แนวนอน */}
            <style>{`@media print{.no-print{display:none!important}@page{size:A4 landscape;margin:1.2cm}}`}</style>

            {/* ── Header card ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Stethoscope size={18} style={{ color: MINT[800] }} />
                        <h1 className="text-lg font-bold text-gray-800">ระบบรายงานกายภาพบำบัด</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>รพ.พลับพลาชัย · ดึงจาก HOSxP แบบ Real-time</span>
                        {data?.updatedAt && (
                            <>
                                <span>·</span>
                                <Clock size={11} />
                                <span>อัปเดต {timeAgo(data.updatedAt)}</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_MS / 1000} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={refetch} />
                    <ConnectionStatus error={!!error} connected={connected && !!data} />
                </div>
            </div>

            {/* ── Controls ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-3 no-print">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        {PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => handlePreset(p.key)}
                                className="px-3.5 py-1.5 text-xs transition-colors"
                                style={{
                                    backgroundColor: preset === p.key ? MINT[500] : "#fff",
                                    color: preset === p.key ? "#fff" : "#4b5563",
                                    fontWeight: preset === p.key ? 600 : 400,
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={onExportExcel}
                            disabled={!records.length}
                            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 transition-colors"
                            style={{ backgroundColor: MINT[500] }}
                        >
                            <FileSpreadsheet size={15} /> Excel
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <Printer size={15} /> พิมพ์ / PDF
                        </button>
                    </div>
                </div>

                {/* ── Custom date range — แสดงเฉพาะตอนเลือก "กำหนดเอง" ── */}
                <AnimatePresence>
                    {preset === "custom" && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                        >
                            <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 text-[#717171]">
                                    <CalendarDays size={16} />
                                    <span className="text-sm">เลือกช่วงวันที่:</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">วันที่เริ่ม</span>
                                    <DatePicker
                                        selected={customStart}
                                        onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        showMonthDropdown showYearDropdown dropdownMode="select"
                                        yearDropdownItemNumber={10}
                                        customInput={<ThaiDateInput />}
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">วันที่สิ้นสุด</span>
                                    <DatePicker
                                        selected={customEnd}
                                        onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                                        dateFormat="dd/MM/yyyy"
                                        locale={th}
                                        showMonthDropdown showYearDropdown dropdownMode="select"
                                        yearDropdownItemNumber={10}
                                        customInput={<ThaiDateInput />}
                                    />
                                </div>

                                <button
                                    onClick={handleCustomSearch}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 text-white text-sm font-semibold px-5 py-2 rounded-lg shadow-sm self-end disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: MINT[500] }}
                                >
                                    {loading ? (
                                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                                    ) : (
                                        <Search size={15} />
                                    )}
                                    ค้นหา
                                </button>

                                {data?.start && data?.end && (
                                    <span className="text-xs text-gray-500 self-end pb-2 ml-1">
                                        แสดงข้อมูล:{" "}
                                        <strong style={{ color: MINT[800] }}>
                                            {formatThaiDate(data.start)}
                                            {data.start !== data.end ? ` – ${formatThaiDate(data.end)}` : ""}
                                        </strong>
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm font-medium text-red-700">
                    ⚠️ {error}
                </div>
            )}

            {/* ── Loading ── */}
            {loading && !data && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} h="h-[150px]" />)}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Shimmer h="h-72" /><Shimmer h="h-72" />
                    </div>
                </>
            )}

            {/* ── Content ── */}
            {data && (
                <>
                    {/* KPI */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={kpi.pts.toLocaleString()} sub="ราย" accent="#1a5233" bg="#f0faf4" />
                        <KpiCard icon={Activity} label="Visits ทั้งหมด" value={kpi.vis.toLocaleString()} sub="ครั้ง" accent="#0369A1" bg="#E0F2FE" />
                        <KpiCard icon={Banknote} label="รายได้รวม" value={baht(kpi.inc)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
                        <KpiCard icon={Stethoscope} label="นักกายภาพ PT" value={kpi.ptV.toLocaleString()} sub={`visits · ${baht(kpi.ptI)}`} accent="#185FA5" bg="#E6F1FB" />
                        <KpiCard icon={UserCog} label="ผู้ช่วยกายภาพ PTA" value={kpi.ptaV.toLocaleString()} sub={`visits · ${baht(kpi.ptaI)}`} accent="#065F46" bg="#D1FAE5" />
                    </div>

                    {/* staff summary + queue */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="สรุปรายบุคคล" icon={Users} titleColor={MINT[800]}>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <Th>ชื่อ</Th><Th>ประเภท</Th>
                                            <Th className="text-right">ผู้ป่วย</Th>
                                            <Th className="text-right">Visits</Th>
                                            <Th className="text-right">รายได้</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffRows.map((s, i) => (
                                            <Tr key={i} index={i}>
                                                <td className="px-3 py-2 text-gray-800">{s.name}</td>
                                                <td className="px-3 py-2"><RoleBadge role={s.role} /></td>
                                                <td className="px-3 py-2 text-right text-gray-700">{s.pts.size}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{s.vis}</td>
                                                <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{baht(s.inc)}</td>
                                            </Tr>
                                        ))}
                                        {!staffRows.length && <EmptyRow cols={5} />}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>

                        <SectionCard title="คิวรอรับบริการ (วันนี้)" icon={ListChecks} titleColor={MINT[800]}>
                            {queue.length ? (
                                <div className="space-y-2">
                                    {queue.slice(0, 12).map((qi, i) => {
                                        const active = qi.status === "กำลังรับบริการ";
                                        return (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                style={{ backgroundColor: MINT[50] }}
                                            >
                                                <span className="text-gray-700">
                                                    <span className="font-semibold" style={{ color: MINT[800] }}>{qi.queue_no}.</span>{" "}
                                                    {qi.patient_name}{" "}
                                                    <span className="text-gray-400 text-xs font-mono">({qi.hn})</span>
                                                </span>
                                                <span className={`text-[11px] font-semibold ${active ? "text-green-600" : "text-amber-600"}`}>
                                                    {qi.status}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 py-8 text-sm">ไม่มีคิวรอ</p>
                            )}
                        </SectionCard>
                    </div>

                    {/* shifts + right pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SectionCard title="แยกตามเวร / สิทธิ์" icon={Clock} titleColor={MINT[800]}>
                            <div className="space-y-4">
                                {(["morning", "evening"] as const).map((sh) => (
                                    <div key={sh}>
                                        <div className="mb-1.5"><ShiftBadge shift={sh} />
                                            <span className="text-[11px] text-gray-400 ml-2">{SHIFT_FULL[sh]}</span>
                                        </div>
                                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                                            <table className="min-w-full text-sm border-collapse">
                                                <thead>
                                                    <tr>
                                                        <Th>สิทธิ์</Th>
                                                        <Th className="text-right">Visits</Th>
                                                        <Th className="text-right">รายได้</Th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(shiftData[sh]).map(([k, v], i) => (
                                                        <Tr key={k} index={i}>
                                                            <td className="px-3 py-2 text-gray-700">{k}</td>
                                                            <td className="px-3 py-2 text-right text-gray-700">{v.vis}</td>
                                                            <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{baht(v.inc)}</td>
                                                        </Tr>
                                                    ))}
                                                    {!Object.keys(shiftData[sh]).length && <EmptyRow cols={3} />}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="รายได้ตามสิทธิ์" icon={Banknote} titleColor={MINT[800]}>
                            {rightPie.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีข้อมูล</p>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={rightPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                                dataKey="value" paddingAngle={2}>
                                                {rightPie.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
                                            </Pie>
                                            <RTooltip
                                                formatter={(v) => baht(Number(v ?? 0))}
                                                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
                                        {rightPie.map((d) => (
                                            <span key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                                                {d.name} <strong className="text-gray-800">{baht(d.value)}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* patient list grouped by staff */}
                    <SectionCard title="รายชื่อผู้ป่วย แยกรายเจ้าหน้าที่" icon={Users} titleColor={MINT[800]}>
                        {/* search toolbar */}
                        <div className="flex flex-wrap gap-2 mb-4 no-print">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="ค้นหา HN / ชื่อ / หัตถการ..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    className="w-full border-2 border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0] transition-colors"
                                />
                            </div>
                            {[
                                { val: fRight, set: setFRight, opts: [["", "สิทธิ์ทั้งหมด"], ["UC", "UC"], ["ข้าราชการ", "ข้าราชการ"], ["ประกันสังคม", "ประกันสังคม"], ["จ่ายเอง", "จ่ายเอง"]] },
                                { val: fShift, set: setFShift, opts: [["", "เวรทั้งหมด"], ["morning", "เวรเช้า"], ["evening", "เวรเย็น"]] },
                                { val: fRole, set: setFRole, opts: [["", "PT + PTA"], ["pt", "PT เท่านั้น"], ["pta", "PTA เท่านั้น"]] },
                            ].map((sel, si) => (
                                <select
                                    key={si}
                                    value={sel.val}
                                    onChange={(e) => sel.set(e.target.value)}
                                    className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#7ec8a0] transition-colors"
                                >
                                    {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            ))}
                        </div>

                        {patientGroups.grandV ? (
                            <>
                                <div className="flex justify-end gap-4 mb-3 text-sm text-gray-500">
                                    <span>รวม <strong className="text-gray-800">{patientGroups.grandV} visits</strong></span>
                                    <span>รายได้รวม <strong style={{ color: MINT[800] }}>{baht(patientGroups.grandI)}</strong></span>
                                </div>

                                <div className="space-y-3">
                                    {patientGroups.groups.map(({ sid, grp, filtered, grpI }) => {
                                        const collapsed = !!collapsedGrp[sid];
                                        return (
                                            <div key={sid} className="border border-gray-200 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() => setCollapsedGrp((s) => ({ ...s, [sid]: !s[sid] }))}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                                                    style={{ backgroundColor: MINT[50] }}
                                                >
                                                    <RoleBadge role={grp.role} />
                                                    <span className="font-semibold text-gray-800 text-sm">{grp.name}</span>
                                                    <span className="text-xs text-gray-500 ml-auto">
                                                        {filtered.length} visits · <strong style={{ color: MINT[800] }}>{baht(grpI)}</strong>
                                                    </span>
                                                    <motion.span animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                                                        <ChevronRight size={15} className="text-gray-400" />
                                                    </motion.span>
                                                </button>

                                                <AnimatePresence initial={false}>
                                                    {!collapsed && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full text-xs border-collapse">
                                                                    <thead>
                                                                        <tr>
                                                                            <Th>วันที่</Th><Th>HN</Th><Th>ชื่อผู้ป่วย</Th>
                                                                            <Th className="text-center">หัตถการ</Th><Th>เวร</Th><Th>สิทธิ์</Th>
                                                                            <Th className="text-right">รายได้</Th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {filtered.map((r, i) => (
                                                                            <Tr key={i} index={i}>
                                                                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatThaiDate(r.date)}</td>
                                                                                <td className="px-3 py-2 font-mono text-gray-500">{r.hn}</td>
                                                                                <td className="px-3 py-2 text-gray-800">{r.patient_name}</td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" title={r.procedure_name}
                                                                                        style={{ backgroundColor: MINT[50], color: MINT[800] }}>
                                                                                        {r.procedure}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-3 py-2"><ShiftBadge shift={r.shift} /></td>
                                                                                <td className="px-3 py-2 font-semibold" style={{ color: RIGHT_COLOR[r.right] ?? "#374151" }}>{r.right}</td>
                                                                                <td className="px-3 py-2 text-right font-semibold" style={{ color: MINT[800] }}>{baht(r.income)}</td>
                                                                            </Tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr style={{ backgroundColor: MINT[50] }}>
                                                                            <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-gray-500">รวม {filtered.length} visits</td>
                                                                            <td className="px-3 py-2 text-right font-bold" style={{ color: MINT[800] }}>{baht(grpI)}</td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <EmptyState variant="noResult" onClear={() => { setQ(""); setFRight(""); setFShift(""); setFRole(""); }} />
                        )}
                    </SectionCard>

                    {/* staff detail */}
                    <SectionCard title="สรุปรายเจ้าหน้าที่ (เวร / สิทธิ์ / หัตถการ)" icon={Stethoscope} titleColor={MINT[800]}>
                        {staffDetail.length ? (
                            <div className="space-y-3">
                                {staffDetail.map(([sid, s]) => {
                                    const vis = Object.values(s.shifts).reduce((a, v) => a + v.vis, 0);
                                    const inc = Object.values(s.shifts).reduce((a, v) => a + v.inc, 0);
                                    const open = !!openSD[sid];
                                    const topProcs = Object.entries(s.procs).sort((a, b) => b[1] - a[1]).slice(0, 5);
                                    return (
                                        <div key={sid} className="border border-gray-200 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setOpenSD((o) => ({ ...o, [sid]: !o[sid] }))}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                                                style={{ backgroundColor: MINT[50] }}
                                            >
                                                <RoleBadge role={s.role} />
                                                <span className="font-semibold text-gray-800 text-sm">{s.name}</span>
                                                <span className="text-xs text-gray-500 ml-auto flex gap-3">
                                                    <span>Visits <strong className="text-gray-800">{vis}</strong></span>
                                                    <span>รายได้ <strong style={{ color: MINT[800] }}>{baht(inc)}</strong></span>
                                                </span>
                                                <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                                    <ChevronRight size={15} className="text-gray-400" />
                                                </motion.span>
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {open && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                                        className="overflow-hidden border-t border-gray-100"
                                                    >
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                                                            {/* by shift */}
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">แยกตามเวร</p>
                                                                <div className="space-y-1.5">
                                                                    {Object.entries(s.shifts).map(([sh, v]) => (
                                                                        <div key={sh} className="flex items-center justify-between text-xs">
                                                                            <ShiftBadge shift={sh} />
                                                                            <span className="text-gray-500">{v.vis} · <strong style={{ color: MINT[800] }}>{baht(v.inc)}</strong></span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* by right */}
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">แยกตามสิทธิ์</p>
                                                                <div className="space-y-1.5">
                                                                    {Object.entries(s.rights).map(([rt, v]) => (
                                                                        <div key={rt} className="flex items-center justify-between text-xs">
                                                                            <span className="text-gray-600">{rt}</span>
                                                                            <span className="text-gray-500">{v.vis} · <strong style={{ color: MINT[800] }}>{baht(v.inc)}</strong></span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* top procs */}
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">หัตถการ Top 5</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {topProcs.length ? topProcs.map(([c, n]) => (
                                                                        <span key={c} className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                                            style={{ backgroundColor: MINT[50], color: MINT[800] }}>
                                                                            {c} <b>({n})</b>
                                                                        </span>
                                                                    )) : <span className="text-xs text-gray-400">—</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</p>
                        )}
                    </SectionCard>

                    {/* pivot */}
                    <SectionCard title="Pivot รายได้ บุคลากร × สิทธิ์การรักษา" icon={Table2} titleColor={MINT[800]}>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <Th>บุคลากร</Th>
                                        {pivot.rights.map((r) => <Th key={r} className="text-right">{r}</Th>)}
                                        <Th className="text-right">รวม</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivot.rows.map(({ sn, rm, tot }, i) => (
                                        <Tr key={sn} index={i}>
                                            <td className="px-3 py-2 text-gray-800 font-medium">{sn}</td>
                                            {pivot.rights.map((rr) => (
                                                <td key={rr} className="px-3 py-2 text-right text-gray-700">{baht(rm[rr] || 0)}</td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-bold" style={{ color: MINT[800], backgroundColor: MINT[50] }}>{baht(tot)}</td>
                                        </Tr>
                                    ))}
                                    <tr style={{ backgroundColor: MINT[100] }}>
                                        <td className="px-3 py-2 font-bold text-gray-800">รวมทั้งหมด</td>
                                        {pivot.rights.map((rr) => (
                                            <td key={rr} className="px-3 py-2 text-right font-bold" style={{ color: MINT[800] }}>{baht(pivot.totals[rr] || 0)}</td>
                                        ))}
                                        <td className="px-3 py-2 text-right font-extrabold" style={{ color: MINT[800] }}>{baht(pivot.grand)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </SectionCard>

                    {/* proc chart */}
                    <SectionCard title="หัตถการที่ใช้มากที่สุด" icon={Activity} titleColor={MINT[800]}>
                        {procTop.length ? (
                            <HBarList data={procTop} colors={[MINT[500]]} labelWidth={130} />
                        ) : (
                            <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีข้อมูล</p>
                        )}
                    </SectionCard>
                </>
            )}

            {/* ── AI สรุป + แชท (ปุ่มลอยมุมขวาล่าง + modal กลางจอ) ── */}
            <AiSummaryCard
                summary={aiSummary}
                context="แดชบอร์ดงานกายภาพบำบัด รพ.พลับพลาชัย จ.บุรีรัมย์ — วิเคราะห์ผลงานบริการของนักกายภาพบำบัด (PT) และผู้ช่วย (PTA) ครอบคลุมจำนวนผู้ป่วย visits รายได้ ภาระงานรายบุคคล การกระจายตามเวรเช้า/บ่าย สิทธิการรักษา และหัตถการที่ทำบ่อย เพื่อช่วยวิเคราะห์ภาระงานและการเกลี่ยอัตรากำลัง"
                disabled={!aiSummary}
            />
        </div>
    );
}