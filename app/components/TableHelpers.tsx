"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ── ShimmerRow ─────────────────────────────────────────────────────────────────
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