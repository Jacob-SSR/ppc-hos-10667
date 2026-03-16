"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ── ShimmerRow ─────────────────────────────────────────────────────────────────
export function ShimmerRow({ cols }: { cols: number }) {
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

// ── LoadingBar ─────────────────────────────────────────────────────────────────
// แสดงขณะ fetch ข้อมูล (ใช้ใน ReportTable / PpaTable)
export function LoadingBar() {
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

// ── AnimatedCount ──────────────────────────────────────────────────────────────
export function AnimatedCount({ value }: { value: number }) {
    const motionVal = useMotionValue(0);
    const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString());

    useEffect(() => {
        const ctrl = animate(motionVal, value, { duration: 0.5, ease: "easeOut" });
        return () => ctrl.stop();
    }, [value]);

    return (
        <motion.span className="text-green-800 font-bold">
            {rounded}
        </motion.span>
    );
}