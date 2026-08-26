"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
    Pill, Syringe, FlaskConical, Coins, Boxes, Users, Receipt, Building2, Stethoscope, ShieldCheck,
    TrendingUp, Table2, Download, Search, ChevronUp, ChevronDown, ChevronsUpDown,
    ChevronLeft, ChevronRight, Layers,
} from "lucide-react";
import {
    HBarList, KpiCard, LiveBadge, RefreshButton, SectionCard,
} from "@/app/components/dashboard/live";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Shimmer } from "@/app/components/ui/Shimmer";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";
import { exportToExcel } from "@/lib/exportExcel";
import { THAI_MONTHS_SHORT, toThaiDateLabel } from "@/lib/thaiDate";

// ─── Types (ตรงกับ lib/drugUsage.service.ts) ─────────────────────────────────
type Kind = "drug" | "nondrug" | "lab";

interface ItemRow {
    fiscal_year: number;
    icode: string; name: string; strength: string; units: string;
    order_count: number; qty: number; vn_count: number; hn_count: number;
    value: number; opd_value: number; ipd_value: number;
}
interface TrendRow { date: string; value: number; qty: number; vn_count: number }
interface DimRow {
    key: string; label: string; value: number; qty: number;
    order_count: number; vn_count: number;
}
interface Totals {
    value: number; qty: number; order_count: number; item_count: number;
    vn_count: number; hn_count: number; opd_value: number; ipd_value: number;
}
interface DashData {
    updatedAt: string; kind: Kind; kindLabel: string; start: string; end: string;
    fiscalYears: number[];
    totals: Totals; items: ItemRow[]; trend: TrendRow[];
    departments: DimRow[]; prescribers: DimRow[]; rights: DimRow[];
}

type Preset = "today" | "thismonth" | "fiscal" | "custom";
type SortKey = "value" | "qty" | "order_count" | "vn_count" | "name";
type AbcClass = "A" | "B" | "C";

// ─── Theme / constants ────────────────────────────────────────────────────────
const MINT = {
    50: "#f0faf4", 100: "#d6f0e0", 200: "#a8d5ba", 300: "#7ec8a0",
    400: "#55b882", 500: "#3aa36a", 600: "#2d8a56", 700: "#236b43", 800: "#1a5233",
};
const PALETTE = ["#3aa36a", "#185FA5", "#6a1b9a", "#e65100", "#00695c", "#880e4f", "#5b21b6", "#b45309"];

const PRESETS: { key: Preset; label: string }[] = [
    { key: "fiscal", label: "ปีงบประมาณ" },
    { key: "thismonth", label: "เดือนนี้" },
    { key: "today", label: "วันนี้" },
    { key: "custom", label: "กำหนดเอง" },
];

/** ปีงบประมาณ พ.ศ. ปัจจุบัน — ปีงบเริ่ม 1 ต.ค. */
function currentFiscalYear(): number {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);
}

/** 5 ปีงบล่าสุด (ปีปัจจุบันก่อน) เช่น 2569 2568 2567 2566 2565 */
const FISCAL_YEARS: number[] = Array.from({ length: 5 }, (_, i) => currentFiscalYear() - i);

const PAGE_SIZE = 25;

// มุมมองที่สลับกันได้บน top bar — โครงรายงานเหมือนกัน ต่างแค่ตารางต้นทาง
const KINDS: {
    key: Kind; label: string; short: string; icon: React.ElementType;
    /** หัวเรื่องหน้า + คำอธิบายใต้หัวเรื่อง */
    title: string; desc: string;
    /** ป้าย KPI ที่ต้องเลี่ยงคำว่า "การใช้" ให้อ่านลื่นในภาษาไทย */
    unitWord: string; valueKpi: string; qtyKpi: string; qtySub: string;
}[] = [
        {
            key: "drug", label: "เวชภัณฑ์ยา", short: "ยา", icon: Pill,
            title: "สรุปการใช้เวชภัณฑ์ยาตามมูลค่า",
            desc: "มูลค่าการใช้เวชภัณฑ์ยาทั้งหมดในสถานบริการ (HOSxP)",
            unitWord: "รายการยา", valueKpi: "มูลค่าการใช้ยารวม",
            qtyKpi: "จำนวนที่จ่ายรวม", qtySub: "หน่วยจ่ายรวมทุกรายการ",
        },
        {
            key: "nondrug", label: "เวชภัณฑ์ที่ไม่ใช่ยา", short: "ไม่ใช่ยา", icon: Syringe,
            title: "สรุปการใช้เวชภัณฑ์ที่ไม่ใช่ยาตามมูลค่า",
            desc: "มูลค่าการใช้เวชภัณฑ์ที่ไม่ใช่ยาทั้งหมดในสถานบริการ (HOSxP)",
            unitWord: "รายการเวชภัณฑ์", valueKpi: "มูลค่าการใช้เวชภัณฑ์รวม",
            qtyKpi: "จำนวนที่จ่ายรวม", qtySub: "หน่วยจ่ายรวมทุกรายการ",
        },
        {
            key: "lab", label: "ตรวจทางห้องปฏิบัติการ", short: "Lab", icon: FlaskConical,
            title: "สรุปการตรวจทางห้องปฏิบัติการตามมูลค่า",
            desc: "มูลค่าการส่งตรวจทางห้องปฏิบัติการทั้งหมดในสถานบริการ (HOSxP)",
            unitWord: "รายการตรวจ", valueKpi: "มูลค่าการตรวจรวม",
            qtyKpi: "จำนวนที่ตรวจรวม", qtySub: "จำนวนรวมทุกรายการตรวจ",
        },
    ];

// ABC analysis: A = ยาที่รวมกันแล้วกินมูลค่า 80% แรก, B = ถึง 95%, ที่เหลือ C
const ABC_META: Record<AbcClass, { label: string; color: string; bg: string; hint: string }> = {
    A: { label: "กลุ่ม A", color: "#b91c1c", bg: "#fef2f2", hint: "มูลค่าสะสม 80% แรก — ควบคุมสต๊อกเข้ม" },
    B: { label: "กลุ่ม B", color: "#b45309", bg: "#fffbeb", hint: "มูลค่าสะสม 80–95% — ควบคุมปานกลาง" },
    C: { label: "กลุ่ม C", color: "#1a5233", bg: "#f0faf4", hint: "มูลค่าสะสม 95–100% — ควบคุมตามปกติ" },
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmtB = (n: number) =>
    Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

/** ย่อจำนวนเงินสำหรับ KPI: 1,234,567 → 1.23 ล้าน */
function fmtMoneyShort(n: number): string {
    const v = Number(n) || 0;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} ล้าน`;
    if (v >= 100_000) return `${(v / 1_000).toFixed(1)} พัน`;
    return fmtB(v);
}

/** "YYYY-MM-DD" → "24 ก.ค." */
const thaiTick = (iso: string) => {
    const [, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!m || !d || m < 1 || m > 12) return String(iso);
    return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
};

function bangkokToday(): string {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
}

/** ชื่อยาแบบสั้นสำหรับป้ายกราฟ */
const shortName = (r: ItemRow) => {
    const n = `${r.name}${r.strength ? ` ${r.strength}` : ""}`.trim();
    return n.length > 28 ? `${n.slice(0, 27)}…` : n;
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function Th({
    children, className = "", onClick, active, asc,
}: {
    children: React.ReactNode; className?: string;
    onClick?: () => void; active?: boolean; asc?: boolean;
}) {
    return (
        <th
            onClick={onClick}
            className={`text-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-left ${onClick ? "cursor-pointer select-none" : ""} ${className}`}
            style={{ backgroundColor: MINT[300] }}
        >
            {children}
            {onClick &&
                (!active ? (
                    <ChevronsUpDown size={12} className="inline opacity-50 ml-0.5" />
                ) : asc ? (
                    <ChevronUp size={12} className="inline ml-0.5" />
                ) : (
                    <ChevronDown size={12} className="inline ml-0.5" />
                ))}
        </th>
    );
}

function AbcBadge({ cls }: { cls: AbcClass }) {
    const m = ABC_META[cls];
    return (
        <span
            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ backgroundColor: m.bg, color: m.color }}
        >
            {cls}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DrugUsageDashboardPage() {
    const [data, setData] = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [kind, setKind] = useState<Kind>("drug");
    const [preset, setPreset] = useState<Preset>("fiscal");
    const [fiscalYear, setFiscalYear] = useState<number>(FISCAL_YEARS[0]);
    const [customStart, setCustomStart] = useState(bangkokToday);
    const [customEnd, setCustomEnd] = useState(bangkokToday);

    const [search, setSearch] = useState("");
    const [abcFilter, setAbcFilter] = useState<"" | AbcClass>("");
    const [yearFilter, setYearFilter] = useState<number | "">("");
    const [sortKey, setSortKey] = useState<SortKey>("value");
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(1);

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
                if (preset === "fiscal") params.set("fy", String(fiscalYear));
            }
            params.set("kind", kind);
            const res = await fetch(`/api/drug-usage?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData((await res.json()) as DashData);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [kind, preset, fiscalYear, customStart, customEnd]);

    // preset อื่นดึงทันที — custom รอผู้ใช้กด "ค้นหา" (แต่สลับชนิดเวชภัณฑ์ให้ดึงใหม่เสมอ)
    useEffect(() => {
        if (preset !== "custom") fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preset, kind, fiscalYear]);

    // เปลี่ยนตัวกรอง → กลับหน้าแรกเสมอ
    useEffect(() => { setPage(1); }, [search, abcFilter, yearFilter, sortKey, sortAsc, data]);

    // ── derived ──
    const totals = data?.totals;
    const items = useMemo(() => data?.items ?? [], [data]);
    const periodLabel = data ? toThaiDateLabel(data.start, data.end) : "—";
    const kindMeta = KINDS.find((k) => k.key === kind) ?? KINDS[0];
    // ปีงบที่มีข้อมูลจริงในชุดนี้ — ปกติ 1 ปี ยกเว้นเลือกช่วง "กำหนดเอง" ที่คร่อมปีงบ
    const dataYears = useMemo(() => data?.fiscalYears ?? [], [data]);
    const multiYear = dataYears.length > 1;

    /** ทุกรายการ + %สัดส่วน, %สะสม และ ABC class (เรียงตามมูลค่าจาก API อยู่แล้ว) */
    const ranked = useMemo(() => {
        const total = items.reduce((s, r) => s + r.value, 0);
        let cum = 0;
        return items.map((r, i) => {
            cum += r.value;
            const cumPct = total > 0 ? (cum / total) * 100 : 0;
            const abc: AbcClass = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
            return {
                ...r,
                rank: i + 1,
                share: total > 0 ? (r.value / total) * 100 : 0,
                cumPct,
                abc,
            };
        });
    }, [items]);

    type RankedRow = (typeof ranked)[number];

    const abcSummary = useMemo(() => {
        const base: Record<AbcClass, { items: number; value: number }> = {
            A: { items: 0, value: 0 }, B: { items: 0, value: 0 }, C: { items: 0, value: 0 },
        };
        ranked.forEach((r) => { base[r.abc].items++; base[r.abc].value += r.value; });
        return base;
    }, [ranked]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        const rows = ranked.filter((r) => {
            if (yearFilter !== "" && r.fiscal_year !== yearFilter) return false;
            if (abcFilter && r.abc !== abcFilter) return false;
            if (!q) return true;
            return `${r.icode} ${r.name} ${r.strength} ${r.units}`.toLowerCase().includes(q);
        });
        return rows.slice().sort((a, b) => {
            if (sortKey === "name") {
                return sortAsc ? a.name.localeCompare(b.name, "th") : b.name.localeCompare(a.name, "th");
            }
            const va = a[sortKey] as number;
            const vb = b[sortKey] as number;
            return sortAsc ? va - vb : vb - va;
        });
    }, [ranked, search, abcFilter, yearFilter, sortKey, sortAsc]);

    const filteredValue = useMemo(() => filtered.reduce((s, r) => s + r.value, 0), [filtered]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page],
    );

    // ── charts ──
    const topDrugs = useMemo(
        () => ranked.slice(0, 10).map((r) => ({ name: shortName(r), value: r.value })),
        [ranked],
    );
    const trendData = useMemo(
        () => (data?.trend ?? []).map((t) => ({ ...t, label: thaiTick(t.date) })),
        [data],
    );
    const typePie = useMemo(() => {
        if (!totals) return [];
        return [
            { name: "ผู้ป่วยนอก (OPD)", value: totals.opd_value, color: PALETTE[0] },
            { name: "ผู้ป่วยใน (IPD)", value: totals.ipd_value, color: PALETTE[1] },
        ].filter((s) => s.value > 0);
    }, [totals]);
    const rightPie = useMemo(
        () =>
            (data?.rights ?? []).slice(0, 6).map((r, i) => ({
                name: r.label, value: r.value, color: PALETTE[i % PALETTE.length],
            })),
        [data],
    );
    const deptBars = useMemo(
        () => (data?.departments ?? []).slice(0, 10).map((r) => ({ label: r.label, count: r.value })),
        [data],
    );
    const prescriberBars = useMemo(
        () => (data?.prescribers ?? []).slice(0, 10).map((r) => ({ label: r.label, count: r.value })),
        [data],
    );

    // ── export ──
    const handleExport = () => {
        if (!filtered.length) return;
        exportToExcel(
            filtered.map((r) => ({
                อันดับ: r.rank,
                ปีงบประมาณ: r.fiscal_year,
                รหัสเวชภัณฑ์: r.icode,
                ชื่อเวชภัณฑ์: r.name,
                ความแรง: r.strength,
                หน่วย: r.units,
                จำนวนที่จ่าย: r.qty,
                ครั้งที่สั่งใช้: r.order_count,
                จำนวน_visit: r.vn_count,
                ผู้ป่วยไม่ซ้ำ: r.hn_count,
                มูลค่า_บาท: Number(r.value.toFixed(2)),
                มูลค่า_OPD: Number(r.opd_value.toFixed(2)),
                มูลค่า_IPD: Number(r.ipd_value.toFixed(2)),
                สัดส่วน_ร้อยละ: Number(r.share.toFixed(2)),
                สะสม_ร้อยละ: Number(r.cumPct.toFixed(2)),
                กลุ่ม_ABC: r.abc,
            })),
            {
                sheetName:
                    kind === "drug" ? "DrugUsage" : kind === "nondrug" ? "NonDrugUsage" : "LabUsage",
                filePrefix: `${kind}_usage_${
                    preset === "fiscal" ? `fy${fiscalYear}` : `${data?.start ?? ""}_${data?.end ?? ""}`
                }`,
                dateKeys: [],
            },
        );
    };

    // ── สรุปสำหรับ AI (สถิติรวมเท่านั้น ไม่มีข้อมูลผู้ป่วยรายบุคคล) ──
    const aiSummary = useMemo(() => {
        if (!data || !totals) return null;
        return {
            ประเภทเวชภัณฑ์: kindMeta.label,
            ปีงบประมาณ: dataYears.join(", "),
            ช่วงข้อมูล: periodLabel,
            มูลค่ายารวม_บาท: Math.round(totals.value),
            มูลค่า_OPD: Math.round(totals.opd_value),
            มูลค่า_IPD: Math.round(totals.ipd_value),
            รายการที่มีการใช้: totals.item_count,
            ครั้งที่สั่งใช้: totals.order_count,
            จำนวน_visit: totals.vn_count,
            ผู้ป่วยไม่ซ้ำ: totals.hn_count,
            มูลค่าเฉลี่ยต่อ_visit: totals.vn_count ? Math.round(totals.value / totals.vn_count) : 0,
            ABC: {
                A: { รายการ: abcSummary.A.items, มูลค่า: Math.round(abcSummary.A.value) },
                B: { รายการ: abcSummary.B.items, มูลค่า: Math.round(abcSummary.B.value) },
                C: { รายการ: abcSummary.C.items, มูลค่า: Math.round(abcSummary.C.value) },
            },
            รายการ_20_อันดับแรกตามมูลค่า: ranked.slice(0, 20).map((r) => ({
                ปีงบ: r.fiscal_year, ชื่อ: r.name, ความแรง: r.strength, จำนวน: r.qty,
                มูลค่า: Math.round(r.value), สัดส่วน_ร้อยละ: Number(r.share.toFixed(2)),
            })),
            แยกตามแผนก: (data.departments ?? []).slice(0, 10).map((r) => ({
                แผนก: r.label, มูลค่า: Math.round(r.value),
            })),
            แยกตามสิทธิ์: (data.rights ?? []).slice(0, 10).map((r) => ({
                สิทธิ์: r.label, มูลค่า: Math.round(r.value),
            })),
            แยกตามผู้สั่งใช้: (data.prescribers ?? []).slice(0, 10).map((r) => ({
                ผู้สั่ง: r.label, มูลค่า: Math.round(r.value),
            })),
        };
    }, [data, totals, periodLabel, abcSummary, ranked, kindMeta, dataYears]);

    const sortBy = (key: SortKey) => {
        if (sortKey === key) setSortAsc((p) => !p);
        else { setSortKey(key); setSortAsc(key === "name"); }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 text-gray-800">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <kindMeta.icon size={18} style={{ color: MINT[800] }} />
                        <h1 className="text-lg font-bold text-gray-800">{kindMeta.title}</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {kindMeta.desc} · ช่วงข้อมูล{" "}
                        <span className="font-semibold" style={{ color: MINT[700] }}>{periodLabel}</span>
                        {dataYears.length > 0 && (
                            <>
                                {" · ปีงบ "}
                                <span className="font-semibold" style={{ color: MINT[700] }}>
                                    {dataYears.join(", ")}
                                </span>
                            </>
                        )}
                    </p>
                </div>

                {/* สลับ ยา / ไม่ใช่ยา — โครงรายงานเดียวกัน */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 order-last w-full sm:order-none sm:w-auto">
                    {KINDS.map((k) => {
                        const active = k.key === kind;
                        return (
                            <button
                                key={k.key}
                                onClick={() => setKind(k.key)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${active ? "shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                                style={active ? { backgroundColor: "#ffffff", color: MINT[700] } : undefined}
                            >
                                <k.icon size={14} />
                                {k.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as Preset)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white"
                    >
                        {PRESETS.map((p) => (
                            <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                    </select>

                    {/* ปีงบประมาณ 5 ปีล่าสุด */}
                    {preset === "fiscal" && (
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100">
                            {FISCAL_YEARS.map((y) => {
                                const active = y === fiscalYear;
                                return (
                                    <button
                                        key={y}
                                        onClick={() => setFiscalYear(y)}
                                        className={`px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums transition-all ${active ? "shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                                        style={active ? { backgroundColor: "#ffffff", color: MINT[700] } : undefined}
                                    >
                                        {y}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {preset === "custom" && (
                        <>
                            <input
                                type="date" value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600"
                            />
                            <span className="text-gray-400 text-sm">ถึง</span>
                            <input
                                type="date" value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600"
                            />
                            <button
                                onClick={fetchData}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white"
                                style={{ backgroundColor: MINT[500] }}
                            >
                                <Search size={14} /> ค้นหา
                            </button>
                        </>
                    )}

                    <RefreshButton loading={loading} onClick={fetchData} />

                    <button
                        onClick={handleExport}
                        disabled={!filtered.length}
                        className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                        <Download size={14} /> Excel
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                    โหลดข้อมูลไม่สำเร็จ: {error}
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Shimmer key={i} h="h-28" />
                    ))}
                </div>
            ) : !totals || totals.order_count === 0 ? (
                <EmptyState variant="noData" message={`ไม่พบข้อมูล${kindMeta.label}ในช่วงเวลานี้`} />
            ) : (
                <>
                    {/* KPI */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        <KpiCard
                            icon={Coins} label={kindMeta.valueKpi}
                            value={`${fmtMoneyShort(totals.value)} ฿`}
                            sub={`${fmtB(totals.value)} บาท`}
                            accent="#1a5233" bg={MINT[50]}
                        />
                        <KpiCard
                            icon={kindMeta.icon} label={`${kindMeta.unitWord}ที่มีการใช้`}
                            value={fmt(totals.item_count)} sub="รายการ (icode)"
                            accent="#185FA5" bg="#eff6ff"
                        />
                        <KpiCard
                            icon={Receipt} label="ครั้งที่สั่งใช้"
                            value={fmt(totals.order_count)} sub="บรรทัดรายการ"
                            accent="#6a1b9a" bg="#faf5ff"
                        />
                        <KpiCard
                            icon={Boxes} label={kindMeta.qtyKpi}
                            value={fmt(totals.qty)} sub={kindMeta.qtySub}
                            accent="#b45309" bg="#fffbeb"
                        />
                        <KpiCard
                            icon={Users}
                            label={kind === "lab" ? "ผู้ป่วยที่ได้รับการตรวจ" : `ผู้ป่วยที่ได้รับ${kindMeta.short}`}
                            value={fmt(totals.hn_count)}
                            sub={`${fmt(totals.vn_count)} visit`}
                            accent="#00695c" bg="#ecfdf5"
                        />
                        <KpiCard
                            icon={TrendingUp} label="มูลค่าเฉลี่ยต่อ visit"
                            value={`${fmtB(totals.vn_count ? totals.value / totals.vn_count : 0)} ฿`}
                            sub={`OPD ${fmtPct(totals.value ? (totals.opd_value / totals.value) * 100 : 0)} · IPD ${fmtPct(totals.value ? (totals.ipd_value / totals.value) * 100 : 0)}`}
                            accent="#880e4f" bg="#fdf2f8"
                        />
                    </div>

                    {/* ABC analysis */}
                    <SectionCard title="การวิเคราะห์ ABC ตามมูลค่าการใช้" icon={Layers} titleColor={MINT[800]}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(["A", "B", "C"] as AbcClass[]).map((cls) => {
                                const m = ABC_META[cls];
                                const s = abcSummary[cls];
                                const pct = totals.value ? (s.value / totals.value) * 100 : 0;
                                return (
                                    <button
                                        key={cls}
                                        onClick={() => setAbcFilter((p) => (p === cls ? "" : cls))}
                                        className={`text-left rounded-2xl p-4 border transition-all ${abcFilter === cls ? "ring-2" : ""}`}
                                        style={{
                                            backgroundColor: m.bg,
                                            borderColor: m.color + "33",
                                            // @ts-expect-error — CSS custom property สำหรับ ring color
                                            "--tw-ring-color": m.color,
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold" style={{ color: m.color }}>
                                                {m.label}
                                            </span>
                                            <span className="text-xs font-semibold" style={{ color: m.color }}>
                                                {fmt(s.items)} รายการ
                                            </span>
                                        </div>
                                        <p className="text-xl font-extrabold tabular-nums mt-1" style={{ color: m.color }}>
                                            {fmtB(s.value)} ฿
                                        </p>
                                        <div className="h-1.5 rounded-full bg-white/70 mt-2 overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${pct}%`, backgroundColor: m.color }}
                                            />
                                        </div>
                                        <p className="text-[11px] mt-1.5" style={{ color: m.color + "cc" }}>
                                            {fmtPct(pct)} ของมูลค่ารวม · {m.hint}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                        {abcFilter && (
                            <p className="text-xs text-gray-500 mt-3">
                                กำลังกรองตารางเฉพาะ{" "}
                                <span className="font-semibold">{ABC_META[abcFilter].label}</span> ·{" "}
                                <button onClick={() => setAbcFilter("")} className="underline" style={{ color: MINT[600] }}>
                                    ล้างตัวกรอง
                                </button>
                            </p>
                        )}
                    </SectionCard>

                    {/* Trend + Top 10 */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <SectionCard
                            title={`แนวโน้มมูลค่าการใช้${kindMeta.short}รายวัน`}
                            icon={TrendingUp} titleColor={MINT[800]}
                        >
                            {trendData.length ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} width={70} />
                                        <RTooltip
                                            formatter={(v?: number) => [`${fmtB(Number(v))} บาท`, "มูลค่า"]}
                                            labelFormatter={(l) => `วันที่ ${l}`}
                                        />
                                        <Line
                                            type="monotone" dataKey="value" name="มูลค่า (บาท)"
                                            stroke={MINT[500]} strokeWidth={2}
                                            dot={{ r: 2 }} activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState variant="noData" />
                            )}
                        </SectionCard>

                        <SectionCard
                            title={`10 อันดับ${kindMeta.label}ที่มีมูลค่าการใช้สูงสุด`}
                            icon={kindMeta.icon} titleColor={MINT[800]}
                        >
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart
                                    data={topDrugs} layout="vertical"
                                    margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} />
                                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10 }} />
                                    <RTooltip formatter={(v?: number) => [`${fmtB(Number(v))} บาท`, "มูลค่า"]} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                        {topDrugs.map((_, i) => (
                                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>
                    </div>

                    {/* สัดส่วน OPD/IPD + สิทธิ์ + แผนก */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <SectionCard title="สัดส่วนมูลค่า ผู้ป่วยนอก / ผู้ป่วยใน" icon={Stethoscope} titleColor={MINT[800]}>
                            {typePie.length ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={typePie} dataKey="value" nameKey="name"
                                            innerRadius={50} outerRadius={80} paddingAngle={2}
                                        >
                                            {typePie.map((s, i) => <Cell key={i} fill={s.color} />)}
                                        </Pie>
                                        <RTooltip formatter={(v?: number) => `${fmtB(Number(v))} บาท`} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState variant="noData" />
                            )}
                        </SectionCard>

                        <SectionCard
                            title={`มูลค่า${kindMeta.short}แยกตามสิทธิ์การรักษา`}
                            icon={ShieldCheck} titleColor={MINT[800]}
                        >
                            {rightPie.length ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={rightPie} dataKey="value" nameKey="name"
                                            innerRadius={50} outerRadius={80} paddingAngle={2}
                                        >
                                            {rightPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                                        </Pie>
                                        <RTooltip formatter={(v?: number) => `${fmtB(Number(v))} บาท`} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState variant="noData" />
                            )}
                        </SectionCard>

                        <SectionCard
                            title={`มูลค่า${kindMeta.short}แยกตามแผนกที่รับบริการ`}
                            icon={Building2} titleColor={MINT[800]}
                        >
                            {deptBars.length ? (
                                <HBarList data={deptBars} colors={PALETTE} total={totals.value} labelWidth={120} />
                            ) : (
                                <EmptyState variant="noData" />
                            )}
                        </SectionCard>
                    </div>

                    {/* ผู้สั่งใช้ */}
                    <SectionCard
                        title={
                            kind === "lab"
                                ? "10 อันดับผู้สั่งตรวจ Lab ตามมูลค่า"
                                : `10 อันดับผู้สั่งใช้${kindMeta.short}ตามมูลค่า`
                        }
                        icon={Stethoscope} titleColor={MINT[800]}
                    >
                        {prescriberBars.length ? (
                            <HBarList data={prescriberBars} colors={PALETTE} total={totals.value} labelWidth={180} />
                        ) : (
                            <EmptyState variant="noData" />
                        )}
                    </SectionCard>

                    {/* ตารางรายการยา */}
                    <SectionCard
                        title={`รายการ${kindMeta.label}ทั้งหมด เรียงตามมูลค่าการใช้`}
                        icon={Table2}
                        titleColor={MINT[800]}
                    >
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อเวชภัณฑ์ / รหัส"
                                    className="border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-64"
                                />
                            </div>
                            {multiYear && (
                                <select
                                    value={yearFilter}
                                    onChange={(e) =>
                                        setYearFilter(e.target.value === "" ? "" : Number(e.target.value))
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 bg-white"
                                >
                                    <option value="">ทุกปีงบ</option>
                                    {dataYears.map((y) => (
                                        <option key={y} value={y}>ปีงบ {y}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={abcFilter}
                                onChange={(e) => setAbcFilter(e.target.value as "" | AbcClass)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 bg-white"
                            >
                                <option value="">ทุกกลุ่ม ABC</option>
                                <option value="A">กลุ่ม A</option>
                                <option value="B">กลุ่ม B</option>
                                <option value="C">กลุ่ม C</option>
                            </select>
                            <span className="text-xs text-gray-500">
                                {fmt(filtered.length)} รายการ · รวม{" "}
                                <span className="font-bold" style={{ color: MINT[700] }}>{fmtB(filteredValue)}</span> บาท
                            </span>
                        </div>

                        {filtered.length === 0 ? (
                            <EmptyState
                                variant="noResult"
                                onClear={() => { setSearch(""); setAbcFilter(""); setYearFilter(""); }}
                            />
                        ) : (
                            <>
                                <div className="overflow-x-auto rounded-lg border border-gray-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr>
                                                <Th className="text-right">#</Th>
                                                <Th className="text-center">ปีงบ</Th>
                                                <Th>รหัส</Th>
                                                <Th onClick={() => sortBy("name")} active={sortKey === "name"} asc={sortAsc}>
                                                    ชื่อเวชภัณฑ์
                                                </Th>
                                                <Th>
                                                    {kind === "drug" ? "ความแรง / หน่วย" : "หน่วย"}
                                                </Th>
                                                <Th className="text-right" onClick={() => sortBy("qty")} active={sortKey === "qty"} asc={sortAsc}>
                                                    {kind === "lab" ? "จำนวนตรวจ" : "จำนวนจ่าย"}
                                                </Th>
                                                <Th className="text-right" onClick={() => sortBy("order_count")} active={sortKey === "order_count"} asc={sortAsc}>
                                                    ครั้งที่สั่ง
                                                </Th>
                                                <Th className="text-right" onClick={() => sortBy("vn_count")} active={sortKey === "vn_count"} asc={sortAsc}>
                                                    visit
                                                </Th>
                                                <Th className="text-right" onClick={() => sortBy("value")} active={sortKey === "value"} asc={sortAsc}>
                                                    มูลค่า (บาท)
                                                </Th>
                                                <Th className="text-right">สัดส่วน</Th>
                                                <Th className="text-right">สะสม</Th>
                                                <Th className="text-center">ABC</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((r: RankedRow, i) => (
                                                <tr
                                                    key={`${r.icode}_${r.fiscal_year}`}
                                                    className="border-b border-gray-100"
                                                    style={{ backgroundColor: i % 2 ? "#f9fafb" : "#ffffff" }}
                                                >
                                                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.rank}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span
                                                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
                                                            style={{ backgroundColor: MINT[50], color: MINT[800] }}
                                                        >
                                                            {r.fiscal_year}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.icode}</td>
                                                    <td className="px-3 py-2 font-medium">{r.name}</td>
                                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                                        {[r.strength, r.units].filter(Boolean).join(" / ") || "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.qty)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.order_count)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.vn_count)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: MINT[700] }}>
                                                        {fmtB(r.value)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtPct(r.share)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-gray-400">{fmtPct(r.cumPct)}</td>
                                                    <td className="px-3 py-2 text-center"><AbcBadge cls={r.abc} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {pageCount > 1 && (
                                    <div className="flex items-center justify-end gap-2 mt-3 text-sm text-gray-600">
                                        <button
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="border border-gray-200 rounded-lg p-1.5 disabled:opacity-40 hover:bg-gray-50"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <span className="tabular-nums">
                                            หน้า {page} / {pageCount}
                                        </span>
                                        <button
                                            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                            disabled={page === pageCount}
                                            className="border border-gray-200 rounded-lg p-1.5 disabled:opacity-40 hover:bg-gray-50"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </SectionCard>

                    <AiSummaryCard
                        summary={aiSummary}
                        context={`สรุปการใช้${kindMeta.label}ตามมูลค่าการใช้ทั้งหมดในสถานบริการ (HOSxP)`}
                        disabled={!aiSummary}
                    />
                </>
            )}
        </div>
    );
}
