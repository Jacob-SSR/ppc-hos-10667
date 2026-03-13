"use client";

import { useEffect, useState } from "react";
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
const SHIFT_COLORS: Record<string, { bar: string; border: string; bg: string; text: string }> = {
    "เวรเช้า": { bar: "rgba(37,99,235,0.75)", border: "#2563eb", bg: "bg-blue-50", text: "text-blue-700" },
    "เวรบ่าย": { bar: "rgba(234,88,12,0.75)", border: "#ea580c", bg: "bg-orange-50", text: "text-orange-700" },
    "เวรดึก": { bar: "rgba(109,40,217,0.75)", border: "#6d28d9", bg: "bg-purple-50", text: "text-purple-700" },
    "รวมทั้งหมด": { bar: "rgba(22,101,52,0.8)", border: "#166534", bg: "bg-green-50", text: "text-green-800" },
};

// ── Chart options ───────────────────────────────────────────────────────────
function chartOptions(title: string) {
    return {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items: any[]) => items[0]?.label ?? "",
                    label: (item: any) => ` ${item.formattedValue} ${title === "คน" ? "คน" : "ครั้ง"}`,
                },
            },
        },
        scales: {
            x: {
                ticks: { color: "#374151", font: { size: 11 } },
                grid: { display: false },
            },
            y: {
                ticks: { color: "#374151", font: { size: 12 } },
                grid: { color: "#f3f4f6" },
                beginAtZero: true,
            },
        },
    };
}

// ── Shimmer placeholder ─────────────────────────────────────────────────────
function Shimmer({ h = "h-64" }: { h?: string }) {
    return (
        <div className={`${h} rounded-2xl bg-gray-200 animate-pulse`} />
    );
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
                    <p className="text-xs text-gray-500">ครั้ง (Visit)</p>
                    <p className={`text-2xl font-extrabold ${c.text}`}>
                        {summary.totalVisits.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">คน (HN unique)</p>
                    <p className={`text-2xl font-extrabold ${c.text}`}>
                        {summary.totalPatients.toLocaleString()}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

// ── Bar Chart Card ───────────────────────────────────────────────────────────
function ShiftBarCard({
    shiftName,
    slots,
    metric,
}: {
    shiftName: string;
    slots: SlotStat[];
    metric: "patients" | "visits";
}) {
    const c = SHIFT_COLORS[shiftName] ?? SHIFT_COLORS["รวมทั้งหมด"];
    const labels = slots.map((s) => s.slotLabel);
    const values = slots.map((s) => s[metric]);
    const metricLabel = metric === "patients" ? "คน (HN unique)" : "ครั้ง (Visit)";

    return (
        <motion.div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
            <p className="text-sm font-bold text-gray-700 mb-4">
                {shiftName}{" "}
                <span className="text-xs font-normal text-gray-400">— {metricLabel}</span>
            </p>
            <Bar
                data={{
                    labels,
                    datasets: [
                        {
                            label: metricLabel,
                            data: values,
                            backgroundColor: c.bar,
                            borderColor: c.border,
                            borderWidth: 1.5,
                            borderRadius: 6,
                        },
                    ],
                }}
                options={chartOptions(metric === "patients" ? "คน" : "ครั้ง") as any}
            />
        </motion.div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ShiftStatsPage() {
    const [data, setData] = useState<ShiftStatsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/shift-stats", { credentials: "include" })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json) => setData(json))
            .catch(() => setError("ไม่สามารถโหลดข้อมูลได้"))
            .finally(() => setLoading(false));
    }, []);

    // Thai month label
    const monthLabel = (() => {
        if (!data?.month) return "";
        const [y, m] = data.month.split("-");
        return new Date(Number(y), Number(m) - 1).toLocaleDateString("th-TH", {
            month: "long",
            year: "numeric",
        });
    })();

    const shifts = ["เวรเช้า", "เวรบ่าย", "เวรดึก"];

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-xl font-bold text-gray-800">
                    📊 สถิติผู้รับบริการแยกตามเวร
                </h1>
                {monthLabel && (
                    <p className="text-sm text-gray-400 mt-0.5">
                        ข้อมูลประจำเดือน{" "}
                        <span className="font-semibold text-gray-600">{monthLabel}</span>
                    </p>
                )}
            </motion.div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />
                    ))
                    : data?.summary.map((s) => (
                        <SummaryCard key={s.shiftName} summary={s} />
                    ))}
            </div>

            {/* ── กราฟ 1: คน (HN unique) ── */}
            <motion.div
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="text-base font-bold text-gray-700 mb-1">
                    กราฟที่ 1 — จำนวน <span className="text-blue-600">คน</span> (HN unique) แยกช่วงเวลา
                </h2>
                <p className="text-xs text-gray-400 mb-5">1 คนมาหลายครั้งนับเป็น 1</p>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => <Shimmer key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shifts.map((shift) => {
                            const slots = data!.slots.filter((s) => s.shiftName === shift);
                            return (
                                <ShiftBarCard
                                    key={shift}
                                    shiftName={shift}
                                    slots={slots}
                                    metric="patients"
                                />
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* ── กราฟ 2: ครั้ง (Visit) ── */}
            <motion.div
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <h2 className="text-base font-bold text-gray-700 mb-1">
                    กราฟที่ 2 — จำนวน <span className="text-orange-600">ครั้ง</span> (Visit) แยกช่วงเวลา
                </h2>
                <p className="text-xs text-gray-400 mb-5">นับทุก Visit ที่เข้ารับบริการ</p>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => <Shimmer key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shifts.map((shift) => {
                            const slots = data!.slots.filter((s) => s.shiftName === shift);
                            return (
                                <ShiftBarCard
                                    key={shift}
                                    shiftName={shift}
                                    slots={slots}
                                    metric="visits"
                                />
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}