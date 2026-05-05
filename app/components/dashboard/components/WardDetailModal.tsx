// app/components/dashboard/components/WardDetailModal.tsx
// ดึงข้อมูลจาก /api/ipd/bed-occupancy เหมือน WardCard
// ทำให้ตัวเลขตรงกันแน่นอน
"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BedDouble, GripHorizontal, Shield } from "lucide-react";

interface OccupancyRow {
    ward_code: string;
    label: string;
    total_beds: number;
    current_admit: number;
    occupancy_rate: number;
}

interface PttypeSummaryRow {
    ward_code: string;
    pttype_name: string;
    total: number;
}

interface WardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    wardCode: string;
    wardLabel: string;
    totalBeds: number;
    admit: number;
    date: string;
}

function occupancyColor(rate: number) {
    if (rate >= 90) return { bar: "#ef4444", text: "#dc2626" };
    if (rate >= 70) return { bar: "#f59e0b", text: "#d97706" };
    return { bar: "#16a34a", text: "#15803d" };
}

function OccupancyDonut({ rate, color }: { rate: number; color: string }) {
    const circumference = 2 * Math.PI * 15.9;
    return (
        <div className="relative w-28 h-28 mx-auto shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.2" />
                <motion.circle
                    cx="18" cy="18" r="15.9"
                    fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - (rate / 100) * circumference }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>{rate}%</span>
                <span className="text-[10px] text-gray-400 font-medium">ครองเตียง</span>
            </div>
        </div>
    );
}

function StatBar({ label, count, max, color, index }: {
    label: string; count: number; max: number; color: string; index: number;
}) {
    const pct = max > 0 ? (count / max) * 100 : 0;
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
        >
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 truncate max-w-[75%]">{label}</span>
                <span className="font-bold tabular-nums" style={{ color }}>{count}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                <motion.div
                    className="h-full rounded-full" style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: index * 0.05 + 0.1, duration: 0.5, ease: "easeOut" }}
                />
            </div>
        </motion.div>
    );
}

export default function WardDetailModal({
    isOpen, onClose, wardCode, wardLabel, totalBeds, admit, date,
}: WardDetailModalProps) {
    // ── ดึงจาก bed-occupancy (ไม่มี date = ปัจจุบัน) ────────────────────────
    const [currentAdmit, setCurrentAdmit] = useState<number>(admit);
    const [pttypeSummary, setPttypeSummary] = useState<PttypeSummaryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalSize, setModalSize] = useState({ w: 520, h: 460 });
    const isResizing = useRef(false);
    const resizeStart = useRef({ x: 0, y: 0, w: 520, h: 460 });

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            try {
                // ── 1. ตัวเลข admit ปัจจุบัน จาก bed-occupancy (ไม่ส่ง date = live) ──
                const res1 = await fetch("/api/ipd/bed-occupancy", { credentials: "include" });
                if (res1.ok && !cancelled) {
                    const rows: OccupancyRow[] = await res1.json();
                    const found = rows.find((r) => r.ward_code === wardCode);
                    if (found) setCurrentAdmit(found.current_admit);
                }

                // ── 2. สรุปตามสิทธิ์ จาก ward-census ──────────────────────────────
                const res2 = await fetch(
                    `/api/ipd/ward-census?ward=${encodeURIComponent(wardCode)}`,
                    { credentials: "include" }
                );
                if (res2.ok && !cancelled) {
                    const json = await res2.json();
                    setPttypeSummary(json.summary ?? []);
                }
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        run();
        return () => { cancelled = true; };
    }, [isOpen, wardCode]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        resizeStart.current = { x: e.clientX, y: e.clientY, w: modalSize.w, h: modalSize.h };
        const onMove = (ev: MouseEvent) => {
            if (!isResizing.current) return;
            setModalSize({
                w: Math.max(380, Math.min(700, resizeStart.current.w + ev.clientX - resizeStart.current.x)),
                h: Math.max(340, Math.min(window.innerHeight * 0.9, resizeStart.current.h + ev.clientY - resizeStart.current.y)),
            });
        };
        const onUp = () => {
            isResizing.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const vacant = Math.max(0, totalBeds - currentAdmit);
    const rate = totalBeds > 0 ? Math.round((currentAdmit / totalBeds) * 100) : 0;
    const colors = occupancyColor(rate);
    const maxPttype = useMemo(
        () => Math.max(...pttypeSummary.map((r) => Number(r.total)), 1),
        [pttypeSummary]
    );

    const [y, m, d] = date.split("-");
    const thaiDate = `${d}/${m}/${Number(y) + 543}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            className="relative bg-gray-50 rounded-2xl flex flex-col overflow-hidden"
                            style={{ width: modalSize.w, height: modalSize.h, boxShadow: "0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)" }}
                            initial={{ scale: 0.94, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.94, y: 20, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 360, damping: 32 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* HEADER */}
                            <div className="bg-white border-b border-gray-100 px-5 pt-4 pb-4 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0">
                                        <BedDouble size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-sm font-bold text-gray-900 truncate">{wardLabel}</h2>
                                        <p className="text-[11px] text-gray-400">
                                            ณ ปัจจุบัน · {thaiDate} · เตียงทั้งหมด {totalBeds} เตียง
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                                    >
                                        <X size={12} strokeWidth={2.5} /> ปิด
                                    </button>
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                {loading ? (
                                    <>
                                        <div className="h-36 rounded-2xl bg-gray-200 animate-pulse" />
                                        <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
                                    </>
                                ) : (
                                    <>
                                        {/* Donut + stats */}
                                        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-6">
                                            <OccupancyDonut rate={rate} color={colors.bar} />
                                            <div className="flex-1 grid grid-cols-2 gap-3">
                                                {[
                                                    { label: "Admit ปัจจุบัน", value: currentAdmit, color: "#15803d", bg: "#f0faf4", border: "#a8d5ba" },
                                                    { label: "เตียงว่าง", value: vacant, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
                                                ].map((s) => (
                                                    <div key={s.label} className="rounded-xl px-3 py-3 border text-center"
                                                        style={{ backgroundColor: s.bg, borderColor: s.border }}>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                                                            style={{ color: s.color + "99" }}>{s.label}</p>
                                                        <p className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>
                                                            {s.value}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* สิทธิ์ */}
                                        {pttypeSummary.length > 0 ? (
                                            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Shield size={14} className="text-green-700" />
                                                    <h3 className="text-sm font-bold text-gray-700">แยกตามสิทธิ์การรักษา</h3>
                                                    <span className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full border"
                                                        style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#15803d" }}>
                                                        {currentAdmit} ราย
                                                    </span>
                                                </div>
                                                <div className="space-y-3">
                                                    {pttypeSummary.map((row, i) => (
                                                        <StatBar
                                                            key={`${row.ward_code}-${row.pttype_name}-${i}`}
                                                            label={row.pttype_name}
                                                            count={Number(row.total)}
                                                            max={maxPttype}
                                                            color="#3aa36a"
                                                            index={i}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                                                <BedDouble size={36} strokeWidth={1.2} />
                                                <p className="text-sm font-medium">ไม่มีผู้ป่วย Admit ในขณะนี้</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* RESIZE */}
                            <div onMouseDown={startResize}
                                className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize text-gray-300 hover:text-gray-500 z-40">
                                <GripHorizontal size={14} className="rotate-45" />
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}