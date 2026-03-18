"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { motion } from "framer-motion";
import ThaiDateInput from "@/app/components/ThaiDateInput";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Types ───────────────────────────────────────────────────────────────────
interface SlotStat {
    shiftName: string;
    slotLabel: string;
    visits: number;
    patients: number;
}

interface ShiftSummary {
    shiftName: string;
    totalVisits: number;
    totalPatients: number;
}

interface ShiftStatsResult {
    month: string;
    slots: SlotStat[];
    summary: ShiftSummary[];
}

// ── สีต่อเวร ────────────────────────────────────────────────────────────────
const SHIFT_COLORS: Record<string, { patients: string; visits: string; border: string; bg: string; text: string }> = {
    "เวรเช้า": {
        patients: "rgba(37,99,235,0.8)",
        visits: "rgba(96,165,250,0.8)",
        border: "#2563eb",
        bg: "bg-blue-50",
        text: "text-blue-700",
    },
    "เวรบ่าย": {
        patients: "rgba(234,88,12,0.8)",
        visits: "rgba(251,146,60,0.8)",
        border: "#ea580c",
        bg: "bg-orange-50",
        text: "text-orange-700",
    },
    "เวรดึก": {
        patients: "rgba(109,40,217,0.8)",
        visits: "rgba(167,139,250,0.8)",
        border: "#6d28d9",
        bg: "bg-purple-50",
        text: "text-purple-700",
    },
    "รวมทั้งหมด": {
        patients: "rgba(22,101,52,0.8)",
        visits: "rgba(74,222,128,0.8)",
        border: "#166534",
        bg: "bg-green-50",
        text: "text-green-800",
    },
};

// ── formatDate helper ────────────────────────────────────────────────────────
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// ── Shimmer ─────────────────────────────────────────────────────────────────
function Shimmer({ h = "h-64" }: { h?: string }) {
    return <div className={`${h} rounded-2xl bg-gray-200 animate-pulse`} />;
}

// ── Summary Card ────────────────────────────────────────────────────────────
function SummaryCard({ summary }: { summary: ShiftSummary }) {
    const c = SHIFT_COLORS[summary.shiftName] ?? SHIFT_COLORS["รวมทั้งหมด"];
    return (
        <motion.div
            className={`${c.bg} rounded-2xl p-5 border border-gray-100 shadow-sm`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                {summary.shiftName}
            </p>
            <div className="flex gap-6 mt-1">
                <div>
                    <p className="text-xs text-gray-500">คน (HN unique)</p>
                    <p className={`text-2xl font-extrabold ${c.text}`}>
                        {summary.totalPatients.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">ครั้ง (Visit)</p>
                    <p className={`text-2xl font-extrabold ${c.text}`}>
                        {summary.totalVisits.toLocaleString()}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

// ── Grouped Bar Chart Card (คน + ครั้ง รวมกัน) ──────────────────────────────
function ShiftGroupedBarCard({
    shiftName,
    slots,
}: {
    shiftName: string;
    slots: SlotStat[];
}) {
    const c = SHIFT_COLORS[shiftName] ?? SHIFT_COLORS["รวมทั้งหมด"];
    const labels = slots.map((s) => s.slotLabel);

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: "#374151",
                    font: { size: 11, family: "Prompt, sans-serif" },
                    boxWidth: 12,
                    padding: 10,
                },
            },
            tooltip: {
                callbacks: {
                    label: (item: any) =>
                        ` ${item.dataset.label}: ${item.formattedValue}`,
                },
            },
        },
        scales: {
            x: {
                ticks: { color: "#374151", font: { size: 10 } },
                grid: { display: false },
            },
            y: {
                ticks: { color: "#374151", font: { size: 11 } },
                grid: { color: "#f3f4f6" },
                beginAtZero: true,
            },
        },
    };

    return (
        <motion.div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
            <p className="text-sm font-bold text-gray-700 mb-4">{shiftName}</p>
            <Bar
                data={{
                    labels,
                    datasets: [
                        {
                            label: "คน (HN unique)",
                            data: slots.map((s) => s.patients),
                            backgroundColor: c.patients,
                            borderColor: c.border,
                            borderWidth: 1.5,
                            borderRadius: 5,
                        },
                        {
                            label: "ครั้ง (Visit)",
                            data: slots.map((s) => s.visits),
                            backgroundColor: c.visits,
                            borderColor: c.border,
                            borderWidth: 1,
                            borderRadius: 5,
                        },
                    ],
                }}
                options={options as any}
            />
        </motion.div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ShiftStatsPage() {
    // default: เดือนปัจจุบัน
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [start, setStart] = useState<Date | null>(firstDay);
    const [end, setEnd] = useState<Date | null>(lastDay);
    const [data, setData] = useState<ShiftStatsResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetched, setFetched] = useState(false);

    const fetchData = async () => {
        if (!start || !end) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/shift-stats?start=${formatDate(start)}&end=${formatDate(end)}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
            setFetched(true);
        } catch {
            setError("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setLoading(false);
        }
    };

    // auto-load ครั้งแรก
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const shifts = ["เวรเช้า", "เวรบ่าย", "เวรดึก"];

    const dateRangeLabel = start && end
        ? `${start.toLocaleDateString("th-TH")} – ${end.toLocaleDateString("th-TH")}`
        : "";

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-xl font-bold text-gray-800">
                    สถิติผู้รับบริการแยกตามเวร
                </h1>
            </motion.div>

            {/* ── Filter Bar ── */}
            <motion.div
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-5"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 22 }}
            >
                <div className="flex flex-wrap items-end gap-5">
                    {/* วันที่เริ่ม */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            วันที่เริ่ม
                        </label>
                        <DatePicker
                            selected={start}
                            onChange={(d: Date | null) => setStart(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                    </div>

                    {/* วันที่สิ้นสุด */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            วันที่สิ้นสุด
                        </label>
                        <DatePicker
                            selected={end}
                            onChange={(d: Date | null) => setEnd(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            customInput={<ThaiDateInput />}
                        />
                    </div>

                    {/* Search button */}
                    <motion.button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-green-800 text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-lg disabled:opacity-50"
                        whileHover={{ scale: 1.04, boxShadow: "0 8px 28px rgba(22,101,52,0.35)" }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <motion.span
                                    className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                                />
                                กำลังโหลด...
                            </span>
                        ) : "Search"}
                    </motion.button>

                    {/* Date range label */}
                    {fetched && dateRangeLabel && (
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">ช่วงข้อมูล</span>
                            <span className="bg-green-50 border border-green-200 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full">
                                {dateRangeLabel}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />
                    ))
                    : data?.summary.map((s) => (
                        <SummaryCard key={s.shiftName} summary={s} />
                    ))}
            </div>

            {/* ── Grouped Bar Charts (คน + ครั้ง รวมกัน) ── */}
            <motion.div
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="text-base font-bold text-gray-700 mb-1">
                    จำนวน <span className="text-blue-600">คน</span> และ{" "}
                    <span className="text-orange-500">ครั้ง</span> แยกช่วงเวลา
                </h2>
                <p className="text-xs text-gray-400 mb-5">
                    หลอดซ้าย = คน (HN unique) · หลอดขวา = ครั้ง (Visit)
                </p>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => <Shimmer key={i} />)}
                    </div>
                ) : data ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shifts.map((shift) => {
                            const slots = data.slots.filter((s) => s.shiftName === shift);
                            return (
                                <ShiftGroupedBarCard
                                    key={shift}
                                    shiftName={shift}
                                    slots={slots}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-3xl">
                            📅
                        </div>
                        <p className="text-gray-400 text-sm font-medium">
                            เลือกช่วงวันที่แล้วกด Search
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}