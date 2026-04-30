"use client";

import { motion } from "framer-motion";

// ── ShimmerBar (inline — ไม่ import จาก ui/Shimmer เพื่อหลีกเลี่ยง circular path) ──
function ShimmerBar() {
    return (
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-4">
            <motion.div
                className="h-full bg-green-500 rounded-full"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "40%" }}
            />
        </div>
    );
}

// ── ShimmerRow ────────────────────────────────────────────────────────────────
function ShimmerRow({ cols }: { cols: number }) {
    return (
        <tr className="border-b border-gray-100">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3 border-r border-gray-100">
                    <div
                        className="h-4 rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer"
                        style={{ animationDelay: `${i * 0.05}s` }}
                    />
                </td>
            ))}
        </tr>
    );
}

// ── TableShimmer (main export) ────────────────────────────────────────────────
interface TableShimmerProps {
    cols?: number;
    rows?: number;
}

export function TableShimmer({ cols = 6, rows = 8 }: TableShimmerProps) {
    return (
        <div>
            <ShimmerBar />

            <motion.div
                className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <motion.span
                    className="inline-block w-4 h-4 border-2 rounded-full"
                    style={{ borderColor: "#a8d5ba", borderTopColor: "#3aa36a" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                กำลังโหลดข้อมูล...
            </motion.div>

            <div className="overflow-hidden border border-gray-200 rounded-xl">
                <table className="min-w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            {Array.from({ length: cols }).map((_, i) => (
                                <th
                                    key={i}
                                    className="px-4 py-3 border-r border-[#a8d5ba]"
                                    style={{ backgroundColor: "#7ec8a0" }}
                                >
                                    <div className="h-3 rounded w-16" style={{ backgroundColor: "#a8d5ba" }} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, i) => (
                            <ShimmerRow key={i} cols={cols} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}