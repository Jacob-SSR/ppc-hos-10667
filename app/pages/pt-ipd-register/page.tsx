"use client";

// รายงาน "ทะเบียนผู้ป่วยในสำหรับงานกายภาพ"
// filter: ช่วงวัน (เลือกเอง) / ปีงบประมาณ / รายเดือน / เวร (เช้า-บ่าย-ดึก) /
//         หมวดหมู่รายละเอียดการให้บริการ (เลือกได้หลายหมวด + ค้นหาได้)
// ข้อมูลจาก /api/pt-ipd-register — ดึงทั้งช่วงมาครั้งเดียว แล้วกรองหมวด/คำค้นฝั่ง client
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Activity, BedDouble, ClipboardList, Clock, Download, Dumbbell, HeartPulse,
    Layers, PieChart as PieIcon, RefreshCw, Search, Stethoscope, TrendingUp,
    UserRound, Users,
} from "lucide-react";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { SectionCard, LiveBadge, HBarList, MiniPagination } from "@/app/components/dashboard/live";
import { Dropdown } from "@/app/pages/rdu-dashboard/_components/Dropdown";
import { CategoryPicker } from "./_components/CategoryPicker";
import { exportToExcel } from "@/lib/exportExcel";
import { formatThaiDate } from "@/lib/dateUtils";
import {
    fmtDate, getBangkokToday, getCurrentFiscalYear, recentFiscalYears,
    THAI_MONTHS_SHORT, toThaiDateLabel,
} from "@/lib/thaiDate";
import { usePagination } from "@/hooks/usePagination";
import type { PtIpdRegisterData, PtIpdRow } from "@/lib/ptIpdRegister.service";
import { PT_SERVICE_CATEGORIES } from "@/lib/ptIpdCategories";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── ธีมมิ้นต์ (เดียวกับทั้งเว็บ) ──────────────────────────────────────────────
const MINT = { 300: "#7ec8a0", 500: "#3aa36a", 700: "#236b43", 800: "#1a5233" };

const fmt = (n: number) => n.toLocaleString("th-TH");
const sexLabel = (s: string) => (s === "1" ? "ชาย" : s === "2" ? "หญิง" : "-");
const PAGE_SIZE = 25;

// ชื่อหมวดรายละเอียดการให้บริการ — ใช้ทั้งกราฟ ตาราง และ Excel
const SERVICE_LABEL = new Map<string, string>(
    PT_SERVICE_CATEGORIES.map((c) => [c.key, c.label]),
);

// ─── ตัวเลือกช่วงเวลา ─────────────────────────────────────────────────────────
type Mode = "fiscal" | "month" | "custom";
const MODES: { key: Mode; label: string }[] = [
    { key: "fiscal", label: "ทั้งปีงบประมาณ" },
    { key: "month", label: "รายเดือน" },
    { key: "custom", label: "เลือกวันเอง" },
];

// ─── เวร (จัดจากเวลาที่ให้บริการกายภาพ physic_main_ipd.service_time) ─────────
// ขอบเขตเดียวกับ lib/servicetime.queries.ts และหน้า "สถิติเวร":
// เช้า 08:30–16:30 · บ่าย 16:30–00:30 · ดึก 00:30–08:30 (ดึกคาบเที่ยงคืน จึง +1440)
type Shift = "all" | "morning" | "evening" | "night";
const SHIFT_OPTIONS: { key: Shift; label: string }[] = [
    { key: "all", label: "ทุกเวร" },
    { key: "morning", label: "เวรเช้า (08:30–16:30)" },
    { key: "evening", label: "เวรบ่าย (16:30–00:30)" },
    { key: "night", label: "เวรดึก (00:30–08:30)" },
];
const SHIFT_NAME: Record<string, string> = { morning: "เช้า", evening: "บ่าย", night: "ดึก" };
const SHIFT_STYLE: Record<string, { color: string; bg: string }> = {
    morning: { color: "#854F0B", bg: "#FAEEDA" },
    evening: { color: "#185FA5", bg: "#E6F1FB" },
    night: { color: "#7C3AED", bg: "#EDE9FE" },
};
const SHIFT_KEYS = ["morning", "evening", "night"] as const;

/** "HH:MM" → เวรที่ตรงกับเวลานั้น (null = ไม่ได้บันทึกเวลา) */
function shiftOf(t: string): "morning" | "evening" | "night" | null {
    const [h, m] = (t ?? "").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const min = h * 60 + m;
    const mm = min < 510 ? min + 1440 : min; // ก่อน 08:30 = ช่วงดึกของ "วันถัดไป"
    if (mm < 990) return "morning";
    if (mm < 1470) return "evening";
    return "night";
}

/** "HH:MM" → "เช้า"/"บ่าย"/"ดึก" (ว่าง = ไม่มีเวลา) */
function shiftLabelOf(t: string): string {
    const sh = shiftOf(t);
    return sh ? SHIFT_NAME[sh] : "";
}

// สีโดนัท "สิทธิ์การรักษา" — ชุดเดียวกับหน้าหัตถการ ER (ผ่านเกณฑ์ตาบอดสีทุกคู่ที่ติดกัน)
const PTTYPE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const PTTYPE_TOP = 5;

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

/** "3 ปี 2 เดือน" — เด็กเล็กต้องเห็นเดือนด้วย ผู้ใหญ่แสดงแค่ปี */
function ageLabel(y: number, m: number): string {
    if (!y && !m) return "-";
    return y < 5 && m ? `${y} ปี ${m} ด.` : `${y} ปี`;
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
export default function PtIpdRegisterPage() {
    const [mode, setMode] = useState<Mode>("fiscal");
    const [fiscalYear, setFiscalYear] = useState<number>(() => getCurrentFiscalYear());
    const [monthIdx, setMonthIdx] = useState<string>(() => String(currentFiscalMonthIdx()));
    const [customStart, setCustomStart] = useState<Date>(
        () => rangeOf("fiscal", getCurrentFiscalYear(), 0, new Date(), new Date()).start,
    );
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());

    const [data, setData] = useState<PtIpdRegisterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<string[]>([]); // หมวดที่เลือก (ว่าง = ทุกหมวด)
    const [shift, setShift] = useState<Shift>("all");
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
                `/api/pt-ipd-register?start=${fmtDate(range.start)}&end=${fmtDate(range.end)}`,
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

    // ── กรองฝั่ง client: คำค้นอย่างเดียว (ยังไม่กรองหมวด) ───────────────────
    // แยกสองชั้นเพื่อให้การ์ดหมวดยังเห็นยอดของหมวดที่ไม่ได้เลือกอยู่
    const baseRows = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        if (!kw) return data?.rows ?? [];
        return (data?.rows ?? []).filter(
            (r) =>
                r.patientName.toLowerCase().includes(kw) ||
                r.hn.toLowerCase().includes(kw) ||
                r.an.toLowerCase().includes(kw) ||
                r.pdx.toLowerCase().includes(kw) ||
                r.pdxName.toLowerCase().includes(kw) ||
                r.serviceText.toLowerCase().includes(kw) ||
                r.staffName.toLowerCase().includes(kw),
        );
    }, [data, keyword]);

    // แถวหลังกรองหมวด (ยังไม่กรองเวร) — ใช้นับยอดของแต่ละเวร
    const catRows = useMemo(() => {
        const set = new Set(picked);
        return set.size ? baseRows.filter((r) => set.has(r.categoryKey)) : baseRows;
    }, [baseRows, picked]);

    // แถวหลังกรองเวร (ยังไม่กรองหมวด) — ใช้นับยอดของแต่ละหมวด
    const shiftRows = useMemo(
        () => (shift === "all" ? baseRows : baseRows.filter((r) => shiftOf(r.serviceTime) === shift)),
        [baseRows, shift],
    );

    // ยอดของแต่ละหมวด/เวร คิดจากอีกฝั่งที่กรองแล้วเสมอ → กดสลับได้โดยยังเห็นยอดตัวอื่น
    const catCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of shiftRows) m.set(r.categoryKey, (m.get(r.categoryKey) ?? 0) + 1);
        return m;
    }, [shiftRows]);

    const shiftCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of catRows) {
            const sh = shiftOf(r.serviceTime);
            if (sh) m.set(sh, (m.get(sh) ?? 0) + 1);
        }
        return m;
    }, [catRows]);

    // ── แถวที่ผ่านทุก filter (ตาราง/KPI/กราฟ ใช้ชุดนี้) ──
    const rows = useMemo(
        () => (shift === "all" ? catRows : catRows.filter((r) => shiftOf(r.serviceTime) === shift)),
        [catRows, shift],
    );

    // ── สรุปจากแถวที่กรองแล้ว (KPI/กราฟจึงตรงกับ filter เสมอ) ────────────────
    const stats = useMemo(() => {
        const byCat = new Map<string, { count: number; an: Set<string> }>();
        const byPttype = new Map<string, number>();
        const byPdx = new Map<string, { code: string; name: string; count: number }>();
        const byTag = new Map<string, number>();
        // ข้อความรายละเอียดการให้บริการดิบ — รวมข้อความที่ต่างกันแค่ช่องว่าง/ตัวพิมพ์
        const byText = new Map<string, { label: string; count: number }>();
        const byStaff = new Map<string, { count: number; isPt: boolean }>();
        const an = new Set<string>();
        const hn = new Set<string>();
        const losByAn = new Map<string, number>();

        for (const r of rows) {
            const c = byCat.get(r.categoryKey) ?? { count: 0, an: new Set<string>() };
            c.count += 1;
            if (r.an) c.an.add(r.an);
            byCat.set(r.categoryKey, c);

            const pt = r.pttypeName || "ไม่ระบุสิทธิ์";
            byPttype.set(pt, (byPttype.get(pt) ?? 0) + 1);

            if (r.pdx) {
                const p = byPdx.get(r.pdx) ?? { code: r.pdx, name: r.pdxName, count: 0 };
                p.count += 1;
                byPdx.set(r.pdx, p);
            }

            // 1 ครั้งทำได้หลายอย่าง → นับทุกหมวดที่จับได้ (ผลรวมเกินจำนวนครั้งได้)
            for (const t of r.serviceTags) byTag.set(t, (byTag.get(t) ?? 0) + 1);

            const text = r.serviceText.replace(/\s+/g, " ").trim();
            if (text) {
                const key = text.toLowerCase();
                const e = byText.get(key) ?? { label: text, count: 0 };
                e.count += 1;
                byText.set(key, e);
            }

            if (r.staffName) {
                const st = byStaff.get(r.staffName) ?? { count: 0, isPt: false };
                st.count += 1;
                st.isPt = st.isPt || r.staffIsPt;
                byStaff.set(r.staffName, st);
            }

            if (r.an) {
                an.add(r.an);
                if (r.los != null) losByAn.set(r.an, r.los); // วันนอนนับ 1 ครั้งต่อ 1 AN
            }
            if (r.hn) hn.add(r.hn);
        }

        const los = [...losByAn.values()];
        const catMeta = new Map((data?.categories ?? []).map((c) => [c.key, c]));

        return {
            total: rows.length,
            admissions: an.size,
            patients: hn.size,
            avgPerAdmission: an.size ? Math.round((rows.length / an.size) * 10) / 10 : 0,
            avgLos: los.length ? Math.round((los.reduce((s, v) => s + v, 0) / los.length) * 10) / 10 : 0,
            byCategory: [...byCat.entries()]
                .map(([key, v]) => ({
                    key,
                    label: catMeta.get(key)?.label ?? key,
                    color: catMeta.get(key)?.color ?? MINT[500],
                    count: v.count,
                    admissions: v.an.size,
                }))
                .sort((a, b) => b.count - a.count),
            byPttype: [...byPttype.entries()]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")),
            byPdx: [...byPdx.values()].sort((a, b) => b.count - a.count).slice(0, 10),
            byServiceText: [...byText.values()]
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"))
                .slice(0, 10),
            byServiceTag: [...byTag.entries()]
                .map(([key, count]) => ({ label: SERVICE_LABEL.get(key) ?? key, count }))
                .sort((a, b) => b.count - a.count),
            // เฉพาะเจ้าหน้าที่กายภาพ — ถ้าทั้งช่วงยังไม่มีใครถูกตั้งตำแหน่งกายภาพใน
            // ทะเบียน doctor ก็แสดงทุกคนที่บันทึกไว้แทน พร้อมหมายเหตุใต้กราฟ
            byStaff: (() => {
                const all = [...byStaff.entries()];
                const pt = all.filter(([, v]) => v.isPt);
                const use = pt.length ? pt : all;
                return {
                    unset: all.length > 0 && pt.length === 0,
                    list: use
                        .map(([label, v]) => ({ label, count: v.count }))
                        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th")),
                };
            })(),
        };
    }, [rows, data]);

    // การ์ดหมวด — แสดงเฉพาะหมวดที่มีข้อมูลในช่วงนี้ (หมวดยอด 0 ยังเลือกได้จาก dropdown)
    const categoryCards = useMemo(
        () =>
            (data?.categories ?? [])
                .map((c) => ({ ...c, count: catCounts.get(c.key) ?? 0 }))
                .filter((c) => c.count > 0)
                .sort((a, b) => b.count - a.count),
        [data, catCounts],
    );

    // แนวโน้มรายเดือนแยกเวร — นับจาก catRows เพื่อให้เทียบ 3 เวรกันได้
    // (เลือกเวรใดเวรหนึ่งอยู่ → แสดงเฉพาะแท่งนั้น ตัวเลขตรงกับตารางเสมอ)
    const monthShift = useMemo(() => {
        const m = new Map<string, { morning: number; evening: number; night: number }>();
        for (const r of catRows) {
            const key = r.serviceDate.slice(0, 7);
            if (!key) continue;
            const sh = shiftOf(r.serviceTime);
            if (!sh) continue;
            const cur = m.get(key) ?? { morning: 0, evening: 0, night: 0 };
            cur[sh] += 1;
            m.set(key, cur);
        }
        return [...m.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, v]) => ({ month, label: monthLabel(month), ...v }));
    }, [catRows]);

    const shownShifts = shift === "all" ? [...SHIFT_KEYS] : [shift];

    // เวรที่ให้บริการมากที่สุดตลอดช่วง — ใช้พาดหัวการ์ดให้ตอบได้โดยไม่ต้องอ่านกราฟ
    const busiestShift = useMemo(() => {
        let best: { key: string; n: number } | null = null;
        for (const k of SHIFT_KEYS) {
            const n = shiftCounts.get(k) ?? 0;
            if (!best || n > best.n) best = { key: k, n };
        }
        return best && best.n > 0 ? best : null;
    }, [shiftCounts]);

    // โดนัทสิทธิ์การรักษา — 5 อันดับแรก + รวมที่เหลือเป็น "อื่นๆ" (ไม่เกิน 6 ชิ้น)
    const pttypeSlices = useMemo(() => {
        const all = stats.byPttype;
        const top = all.slice(0, PTTYPE_TOP);
        const restTotal = all.slice(PTTYPE_TOP).reduce((sum, x) => sum + x.count, 0);
        const slices = top.map((x) => ({ name: x.name, count: x.count }));
        if (restTotal > 0) {
            slices.push({ name: `อื่นๆ (${all.length - PTTYPE_TOP} สิทธิ์)`, count: restTotal });
        }
        return slices;
    }, [stats]);

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
            rows.map((r: PtIpdRow, i) => ({
                "ลำดับ": i + 1,
                "วันที่ให้บริการ": formatThaiDate(r.serviceDate),
                "เวลา": r.serviceTime || "",
                "เวร": shiftLabelOf(r.serviceTime),
                AN: r.an,
                HN: r.hn,
                "ชื่อ-นามสกุล": r.patientName,
                "อายุ": ageLabel(r.ageY, r.ageM),
                "เพศ": sexLabel(r.sex),
                "สิทธิ์การรักษา": r.pttypeName,
                "หมวดการให้บริการ": r.categoryLabel,
                "หมวดการให้บริการ (ทั้งหมด)": r.serviceTags.map((t) => SERVICE_LABEL.get(t) ?? t).join(", "),
                "กลุ่มโรค": r.dxGroupLabel,
                "การวินิจฉัยหลัก (pdx)": r.pdx,
                "ชื่อการวินิจฉัยหลัก": r.pdxName,
                "การวินิจฉัยอื่น (dx0-dx5)": r.dxList.join(", "),
                "วันที่รับไว้": r.regdate ? formatThaiDate(r.regdate) : "",
                "วันที่จำหน่าย": r.dchdate ? formatThaiDate(r.dchdate) : "",
                "วันนอน": r.los ?? "",
                "รายละเอียดการให้บริการ": r.serviceText,
                "ผู้ทำหัตถการ": r.staffName,
                "ที่อยู่": r.address,
            })),
            { filePrefix: "ทะเบียนผู้ป่วยในงานกายภาพ", sheetName: "PT IPD Register" },
        );
    };

    const pickedLabel =
        picked.length === 0
            ? "ทุกหมวดหมู่"
            : picked
                .map((k) => data?.categories.find((c) => c.key === k)?.label ?? k)
                .join(", ");

    return (
        <div className="space-y-4 text-gray-800">
            {/* ── Header + filter ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Dumbbell size={18} style={{ color: MINT[800] }} />
                            <h1 className="text-lg font-bold text-gray-800">
                                ทะเบียนผู้ป่วยในสำหรับงานกายภาพ
                            </h1>
                            <LiveBadge />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-2">
                            <span>ผู้ป่วยในที่ได้รับบริการกายภาพบำบัด (นับ 1 ครั้งที่ให้บริการ ต่อ 1 แถว)</span>
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

                        <CategoryPicker
                            categories={data?.categories ?? []}
                            selected={picked}
                            onChange={setPicked}
                            disabled={!data}
                        />

                        <Dropdown<Shift> value={shift} options={SHIFT_OPTIONS} onChange={setShift} />
                    </div>
                </div>

                {picked.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 flex items-start gap-1.5">
                        <Layers size={13} className="mt-0.5 flex-shrink-0" style={{ color: MINT[500] }} />
                        <span>
                            <span className="font-semibold text-gray-600">หมวดการให้บริการที่เลือก:</span> {pickedLabel}
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
                    <KpiBox Icon={Activity} label="ให้บริการกายภาพ" value={fmt(stats.total)} sub="ครั้ง" color={MINT[800]} bg="#EAF3DE" />
                    <KpiBox Icon={BedDouble} label="ผู้ป่วยใน (AN)" value={fmt(stats.admissions)} sub="admission ที่ได้รับกายภาพ" color="#185FA5" bg="#E6F1FB" />
                    <KpiBox Icon={Users} label="ผู้ป่วย" value={fmt(stats.patients)} sub="คน (HN ไม่ซ้ำ)" color="#6B21A8" bg="#F3E8FF" />
                    <KpiBox Icon={Dumbbell} label="เฉลี่ยต่อ 1 AN" value={fmt(stats.avgPerAdmission)} sub="ครั้ง/admission" color="#854F0B" bg="#FAEEDA" />
                    <KpiBox Icon={HeartPulse} label="วันนอนเฉลี่ย" value={fmt(stats.avgLos)} sub="วัน (เฉพาะที่จำหน่ายแล้ว)" color="#A32D2D" bg="#FCEBEB" />
                </div>
            )}

            {/* ── แยกตามเวร (กดเพื่อกรองได้ กดซ้ำ = ทุกเวร) ── */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SHIFT_OPTIONS.filter((o) => o.key !== "all").map((o) => {
                        const n = shiftCounts.get(o.key) ?? 0;
                        const st = SHIFT_STYLE[o.key];
                        const active = shift === o.key;
                        const pct = catRows.length ? Math.round((n / catRows.length) * 100) : 0;
                        return (
                            <button
                                key={o.key}
                                onClick={() => setShift(active ? "all" : o.key)}
                                className={`text-left rounded-2xl border px-4 py-3 transition-all ${active ? "shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                                style={active ? { backgroundColor: st.bg, borderColor: st.color } : undefined}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold" style={{ color: st.color }}>
                                        {o.label}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{pct}%</span>
                                </div>
                                <div className="flex items-end gap-1.5 mt-1">
                                    <span className="text-2xl font-extrabold tabular-nums" style={{ color: st.color }}>
                                        {fmt(n)}
                                    </span>
                                    <span className="text-[11px] text-gray-400 mb-1">ครั้ง</span>
                                </div>
                                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: st.color }} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── หมวดหมู่รายละเอียดการให้บริการ (กดเพื่อกรองได้ กดซ้ำ = เอาออก) ── */}
            {data && categoryCards.length > 0 && (
                <SectionCard
                    title="หมวดหมู่รายละเอียดการให้บริการ (จากบันทึกของนักกายภาพ)"
                    icon={Layers}
                    titleColor={MINT[800]}
                >
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {categoryCards.map((c) => {
                            const active = picked.includes(c.key);
                            const pct = baseRows.length ? Math.round((c.count / baseRows.length) * 100) : 0;
                            return (
                                <button
                                    key={c.key}
                                    onClick={() =>
                                        setPicked(active ? picked.filter((k) => k !== c.key) : [...picked, c.key])
                                    }
                                    title={`คำที่ใช้จับหมวดนี้: ${c.hint}`}
                                    className={`text-left rounded-2xl border px-4 py-3 transition-all ${active ? "shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                                    style={active ? { backgroundColor: c.bg, borderColor: c.color } : undefined}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs font-bold leading-snug" style={{ color: c.color }}>
                                            {c.label}
                                        </span>
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">{pct}%</span>
                                    </div>
                                    <div className="flex items-end gap-1.5 mt-1">
                                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: c.color }}>
                                            {fmt(c.count)}
                                        </span>
                                        <span className="text-[11px] text-gray-400 mb-1">ครั้ง · {fmt(c.admissions)} AN</span>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-[11px] text-gray-400">
                        * จับหมวดจากข้อความที่นักกายภาพบันทึกไว้ (รายละเอียดการให้บริการ) —
                        1 ครั้งที่ทำหลายอย่างจะนับเข้า “หมวดหลัก” ตามงานหลักของครั้งนั้น
                        ส่วนหมวดที่เหลือแสดงไว้ในตารางและกราฟด้านล่าง
                    </p>
                </SectionCard>
            )}

            {/* ── กราฟ: แนวโน้มรายเดือน + สิทธิ์การรักษา ── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <SectionCard
                            // พาดหัวสรุป "เดือนไหนเยอะสุด" ให้เลย ไม่ต้องอ่านกราฟก่อน
                            title={`แนวโน้มรายเดือน แยกตามเวร${shift === "all" && busiestShift ? ` — เวร${SHIFT_NAME[busiestShift.key]}ให้บริการมากที่สุด ${fmt(busiestShift.n)} ครั้ง` : ""}`}
                            icon={TrendingUp}
                            titleColor={MINT[800]}
                        >
                            {monthShift.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูลในช่วงเวลานี้</p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 mb-2">
                                        {shownShifts.map((k) => (
                                            <span key={k} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SHIFT_STYLE[k].color }} />
                                                เวร{SHIFT_NAME[k]}
                                            </span>
                                        ))}
                                    </div>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart
                                            data={monthShift}
                                            margin={{ top: 8, right: 16, left: -14, bottom: 0 }}
                                            barGap={2}
                                            barCategoryGap="22%"
                                        >
                                            <CartesianGrid vertical={false} stroke="#eef2f7" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                cursor={{ fill: "#f6f8f7" }}
                                                formatter={(v: number | undefined, n) => [`${fmt(v ?? 0)} ครั้ง`, n]}
                                                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                            />
                                            {shownShifts.map((k) => (
                                                <Bar
                                                    key={k}
                                                    dataKey={k}
                                                    name={`เวร${SHIFT_NAME[k]}`}
                                                    fill={SHIFT_STYLE[k].color}
                                                    radius={[4, 4, 0, 0]}
                                                    maxBarSize={22}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </SectionCard>
                    </div>

                    {/* โดนัทสัดส่วนสิทธิ์การรักษา — จำกัด 6 ชิ้น พร้อมตัวเลขกำกับในคำอธิบาย */}
                    <SectionCard title="สัดส่วนสิทธิ์การรักษา" icon={PieIcon} titleColor={MINT[800]}>
                        {pttypeSlices.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูล</p>
                        ) : (
                            <>
                                <div className="relative">
                                    <ResponsiveContainer width="100%" height={190}>
                                        <PieChart>
                                            <Pie
                                                data={pttypeSlices}
                                                dataKey="count"
                                                nameKey="name"
                                                innerRadius={58}
                                                outerRadius={86}
                                                paddingAngle={2}
                                                stroke="#ffffff"
                                                strokeWidth={2}
                                                isAnimationActive={false}
                                            >
                                                {pttypeSlices.map((_, i) => (
                                                    <Cell key={i} fill={PTTYPE_COLORS[i % PTTYPE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(v: number | undefined, n) => [`${fmt(v ?? 0)} ครั้ง`, n]}
                                                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xl font-extrabold tabular-nums text-gray-700">{fmt(stats.total)}</span>
                                        <span className="text-[10px] text-gray-400">ครั้ง</span>
                                    </div>
                                </div>
                                <ul className="mt-3 space-y-1.5">
                                    {pttypeSlices.map((sl, i) => (
                                        <li key={sl.name} className="flex items-center gap-2 text-xs">
                                            <span
                                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                                style={{ backgroundColor: PTTYPE_COLORS[i % PTTYPE_COLORS.length] }}
                                            />
                                            <span className="flex-1 min-w-0 truncate text-gray-600" title={sl.name}>
                                                {sl.name}
                                            </span>
                                            <span className="font-bold text-gray-700 tabular-nums">{fmt(sl.count)}</span>
                                            <span className="text-gray-400 tabular-nums w-9 text-right">
                                                {stats.total ? Math.round((sl.count / stats.total) * 100) : 0}%
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ── 10 อันดับรายละเอียดการให้บริการ (ข้อความที่บันทึกจริง ไม่ใช่หมวด) ── */}
            {data && (
                <SectionCard
                    title={`รายละเอียดการให้บริการที่บันทึกบ่อยที่สุด${stats.byServiceText.length >= 10 ? " (10 อันดับแรก)" : ""}`}
                    icon={ClipboardList}
                    titleColor={MINT[800]}
                >
                    {stats.byServiceText.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-10">
                            ไม่พบรายละเอียดการให้บริการที่บันทึกไว้ในช่วงนี้
                        </p>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={Math.max(220, stats.byServiceText.length * 34)}>
                                <BarChart
                                    data={stats.byServiceText}
                                    layout="vertical"
                                    margin={{ top: 4, right: 40, left: 12, bottom: 4 }}
                                >
                                    <CartesianGrid horizontal={false} stroke="#eef2f7" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis
                                        type="category" dataKey="label" width={260}
                                        tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false}
                                        // ข้อความยาว ๆ ตัดท้ายด้วย … ตัวเต็มดูได้ที่ tooltip และตารางด้านล่าง
                                        tickFormatter={(v: string) => (v.length > 40 ? `${v.slice(0, 40)}…` : v)}
                                    />
                                    <Tooltip
                                        formatter={(v: number | undefined) => [`${fmt(v ?? 0)} ครั้ง`, "จำนวน"]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", maxWidth: 420, whiteSpace: "normal" }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} fill={MINT[500]}>
                                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#4b5563" }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="mt-3 text-[11px] text-gray-400">
                                * นับจากข้อความที่พิมพ์ไว้ตรง ๆ — ข้อความที่ต่างกันแม้แต่คำเดียวจะนับแยกกัน
                                (ถ้าอยากดูภาพรวม ให้ดูที่การ์ด “หมวดหมู่รายละเอียดการให้บริการ” ด้านบน)
                            </p>
                        </>
                    )}
                </SectionCard>
            )}

            {/* ── การวินิจฉัยหลัก + กิจกรรมกายภาพ ── */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionCard
                        title={`การวินิจฉัยหลัก${stats.byPdx.length >= 10 ? " (10 อันดับแรก)" : ""}`}
                        icon={Stethoscope}
                        titleColor={MINT[800]}
                    >
                        {stats.byPdx.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-10">ไม่พบข้อมูล</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(220, stats.byPdx.length * 34)}>
                                <BarChart
                                    data={stats.byPdx.map((p) => ({
                                        ...p,
                                        label: p.name ? `${p.code} ${p.name}` : p.code,
                                    }))}
                                    layout="vertical"
                                    margin={{ top: 4, right: 40, left: 12, bottom: 4 }}
                                >
                                    <CartesianGrid horizontal={false} stroke="#eef2f7" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis
                                        type="category" dataKey="label" width={190}
                                        tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={(v: number | undefined) => [`${fmt(v ?? 0)} ครั้ง`, "จำนวน"]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} fill={MINT[500]}>
                                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#4b5563" }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </SectionCard>

                    {/* ผู้ทำหัตถการ — เฉพาะเจ้าหน้าที่กายภาพ (ตำแหน่งกายภาพในทะเบียน doctor) */}
                    <SectionCard
                        title={`ผู้ทำหัตถการ${stats.byStaff.list.length > 10 ? " (10 อันดับแรก)" : ""}`}
                        icon={UserRound}
                        titleColor={MINT[800]}
                    >
                        {stats.byStaff.list.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-10">
                                ไม่พบผู้ทำหัตถการ — ทั้งทะเบียนกายภาพและรายการค่าบริการ
                                ของ admission ในช่วงนี้ไม่มีชื่อเจ้าหน้าที่กายภาพบันทึกไว้
                            </p>
                        ) : (
                            <>
                                <HBarList
                                    data={stats.byStaff.list.slice(0, 10)}
                                    colors={[MINT[500]]}
                                    total={stats.total}
                                    labelWidth={170}
                                />
                                <p className="mt-3 text-[11px] text-gray-400">
                                    {stats.byStaff.unset
                                        ? "* ยังไม่มีใครถูกตั้งตำแหน่งเจ้าหน้าที่กายภาพในทะเบียน doctor — ตอนนี้จึงแสดงทุกคนที่บันทึกไว้"
                                        : "* นับเฉพาะเจ้าหน้าที่กายภาพ — ถ้าทะเบียนกายภาพไม่ได้ลงชื่อไว้ จะใช้เจ้าหน้าที่กายภาพที่ลงค่าบริการของ AN นั้นแทน (เกณฑ์เดียวกับ dashboard กายภาพ)"}
                                </p>
                            </>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ── ตารางทะเบียน ── */}
            {data && (
                <SectionCard
                    title={`ทะเบียนผู้ป่วยใน — ${fmt(rows.length)}${rows.length !== data.rows.length ? `/${fmt(data.rows.length)}` : ""} ครั้ง`}
                    icon={ClipboardList}
                    titleColor={MINT[800]}
                >
                    <div className="flex flex-wrap justify-end items-center gap-2 mb-3">
                        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="ค้นหา ชื่อ / HN / AN / การวินิจฉัย / รายละเอียด / ผู้ทำหัตถการ"
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
                                            <Th>วันที่ให้บริการ</Th>
                                            <Th>เวลา</Th>
                                            <Th>เวร</Th>
                                            <Th>AN</Th>
                                            <Th>HN</Th>
                                            <Th>ชื่อ-นามสกุล</Th>
                                            <Th right>อายุ</Th>
                                            <Th>เพศ</Th>
                                            <Th>สิทธิ์</Th>
                                            <Th>หมวดหมู่กายภาพ</Th>
                                            <Th>การวินิจฉัยหลัก</Th>
                                            <Th>รับไว้ / จำหน่าย</Th>
                                            <Th right>วันนอน</Th>
                                            <Th>รายละเอียดการให้บริการ</Th>
                                            <Th>ผู้ทำหัตถการ</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.map((r, i) => {
                                            const cat = data.categories.find((c) => c.key === r.categoryKey);
                                            return (
                                                <tr
                                                    key={`${r.an}-${r.serviceDate}-${r.serviceTime}-${i}`}
                                                    className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50" : "bg-white"} hover:bg-[#f0faf4]`}
                                                >
                                                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                                                        {(page - 1) * PAGE_SIZE + i + 1}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatThaiDate(r.serviceDate)}</td>
                                                    <td className="px-3 py-2 text-gray-500">{r.serviceTime || "-"}</td>
                                                    <td className="px-3 py-2"><ShiftBadge time={r.serviceTime} /></td>
                                                    <td className="px-3 py-2 font-mono text-gray-700">{r.an}</td>
                                                    <td className="px-3 py-2 font-mono text-gray-700">{r.hn}</td>
                                                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.patientName || "-"}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{ageLabel(r.ageY, r.ageM)}</td>
                                                    <td className="px-3 py-2 text-gray-600">{sexLabel(r.sex)}</td>
                                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.pttypeName || "-"}</td>
                                                    <td className="px-3 py-2">
                                                        <span
                                                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                                                            style={{ backgroundColor: cat?.bg ?? "#F3F4F6", color: cat?.color ?? "#6B7280" }}
                                                            title={r.serviceText || undefined}
                                                        >
                                                            {r.categoryLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 max-w-[220px]">
                                                        {r.pdx ? (
                                                            <>
                                                                <span className="font-mono font-semibold text-gray-700">{r.pdx}</span>
                                                                {r.pdxName && (
                                                                    <span className="block text-[11px] text-gray-400 truncate" title={r.pdxName}>
                                                                        {r.pdxName}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-[11px] text-gray-500 whitespace-nowrap">
                                                        {r.regdate ? formatThaiDate(r.regdate) : "-"}
                                                        <span className="block text-gray-400">
                                                            {r.dchdate ? formatThaiDate(r.dchdate) : "ยังไม่จำหน่าย"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                                                        {r.los ?? "-"}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600 max-w-[280px]">
                                                        <span className="block truncate" title={r.serviceText}>
                                                            {r.serviceText || "-"}
                                                        </span>
                                                        {r.serviceTags.length > 1 && (
                                                            <span className="block text-[10px] text-gray-400 truncate">
                                                                {r.serviceTags.map((t) => SERVICE_LABEL.get(t) ?? t).join(" · ")}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                                        {r.staffName || <span className="text-gray-300">-</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
                            หมวดหมู่ที่เลือก: pickedLabel,
                            จำนวนครั้งที่ให้บริการกายภาพ: stats.total,
                            จำนวน_admission_AN: stats.admissions,
                            จำนวนผู้ป่วย_HN: stats.patients,
                            ครั้งเฉลี่ยต่อ_admission: stats.avgPerAdmission,
                            วันนอนเฉลี่ย: stats.avgLos,
                            แยกตามหมวดหมู่กายภาพ: stats.byCategory.map((c) => ({
                                หมวดหมู่: c.label,
                                จำนวนครั้ง: c.count,
                                จำนวน_AN: c.admissions,
                            })),
                            รายเดือนแยกเวร: monthShift.map((m) => ({
                                เดือน: m.label,
                                เช้า: m.morning,
                                บ่าย: m.evening,
                                ดึก: m.night,
                                รวม: m.morning + m.evening + m.night,
                            })),
                            เวรที่เลือก: SHIFT_OPTIONS.find((o) => o.key === shift)?.label ?? "ทุกเวร",
                            แยกตามเวร: SHIFT_OPTIONS.filter((o) => o.key !== "all").map((o) => ({
                                เวร: SHIFT_NAME[o.key],
                                จำนวนครั้ง: shiftCounts.get(o.key) ?? 0,
                            })),
                            เวรที่ให้บริการมากที่สุด: busiestShift
                                ? `เวร${SHIFT_NAME[busiestShift.key]} (${busiestShift.n} ครั้ง)`
                                : "-",
                            การวินิจฉัยหลัก: stats.byPdx.map((p) => ({
                                รหัส: p.code,
                                ชื่อ: p.name,
                                จำนวนครั้ง: p.count,
                            })),
                            รายละเอียดการให้บริการที่บันทึกบ่อยที่สุด: stats.byServiceText.map((t) => ({
                                รายละเอียด: t.label,
                                จำนวนครั้ง: t.count,
                            })),
                            หมวดการให้บริการ_นับทุกหมวดที่ทำ: stats.byServiceTag.map((t) => ({
                                หมวด: t.label,
                                จำนวนครั้ง: t.count,
                            })),
                            ผู้ทำหัตถการ: stats.byStaff.list.slice(0, 10).map((st) => ({
                                ชื่อ: st.label,
                                จำนวนครั้ง: st.count,
                            })),
                            แยกตามสิทธิ์การรักษา: pttypeSlices.map((sl) => ({
                                สิทธิ์: sl.name,
                                จำนวนครั้ง: sl.count,
                            })),
                        }
                        : null
                }
                context="ทะเบียนผู้ป่วยในสำหรับงานกายภาพบำบัด โรงพยาบาลพลับพลาชัย — นับจากบันทึกการให้บริการกายภาพของผู้ป่วยใน (physic_main_ipd) หมวดหมู่หลักแยกตาม 'รายละเอียดการให้บริการ' ที่นักกายภาพบันทึกไว้ (เคาะปอด/ฝึกเดิน/บริหารข้อ ฯลฯ) ส่วนกลุ่มโรคจัดจากรหัสวินิจฉัย ICD-10 เป็นข้อมูลประกอบ"
                disabled={!data}
            />
        </div>
    );
}

// ─── ป้ายเวร ─────────────────────────────────────────────────────────────────
function ShiftBadge({ time }: { time: string }) {
    const sh = shiftOf(time);
    if (!sh) return <span className="text-gray-300">-</span>;
    const st = SHIFT_STYLE[sh];
    return (
        <span
            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ backgroundColor: st.bg, color: st.color }}
        >
            {SHIFT_NAME[sh]}
        </span>
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
