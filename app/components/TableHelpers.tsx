// components/TableHelpers.tsx
// ใช้ร่วมกันทุกหน้า: report, no-endpoint, uc-outside-dental, uc-outside

"use client";

import { useMemo } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ── ShimmerRow ─────────────────────────────────────────────────────────────────
/** แถว skeleton ตอน loading */
export function ShimmerRow({ cols }: { cols: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3 border-r border-gray-100">
                    <motion.div
                        className="h-4 rounded-md bg-gray-200"
                        animate={{ opacity: [0.4, 0.9, 0.4] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.06 }}
                    />
                </td>
            ))}
        </tr>
    );
}

// ── AnimatedCount ──────────────────────────────────────────────────────────────
/** ตัวเลขที่นับขึ้นแบบ animate เมื่อค่าเปลี่ยน */
export function AnimatedCount({ value }: { value: number }) {
    const motionVal = useMotionValue(0);
    const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString());

    useMemo(() => {
        const ctrl = animate(motionVal, value, { duration: 0.7, ease: "easeOut" });
        return ctrl.stop;
    }, [value]);

    return (
        <motion.span className="text-green-800 font-bold">
            {rounded}
        </motion.span>
    );
}