// app/components/dashboard/components/PatientSummaryCards.tsx
// แยกออกจาก PatientDetailModal.tsx
// มี 2 component: TotalsCard และ PttypeRow

"use client";

import { motion } from "framer-motion";
import { Mars, Venus, Shield } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PttypeSummary {
    pttype: string;
    pttype_name: string;
    total: number;
    male: number;
    female: number;
}

// ── TotalsCard ────────────────────────────────────────────────────────────────

interface TotalsCardProps {
    total: number;
    male: number;
    female: number;
}

export function TotalsCard({ total, male, female }: TotalsCardProps) {
    const malePct = total > 0 ? Math.round((male / total) * 100) : 0;
    const femalePct = total > 0 ? 100 - malePct : 0;

    return (
        <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-2xl px-5 py-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200 mb-1">
                รวมทั้งหมด
            </p>
            <p className="text-3xl font-extrabold tabular-nums leading-tight">
                {total.toLocaleString()}
                <span className="text-sm font-medium text-green-200 ml-1.5">ราย</span>
            </p>

            <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Mars size={13} className="text-blue-200" />
                    <span className="text-[11px] text-green-100">ชาย</span>
                    <span className="text-sm font-bold tabular-nums ml-auto">
                        {male.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-green-200">({malePct}%)</span>
                </div>
                <div className="flex-1 flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Venus size={13} className="text-pink-200" />
                    <span className="text-[11px] text-green-100">หญิง</span>
                    <span className="text-sm font-bold tabular-nums ml-auto">
                        {female.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-green-200">({femalePct}%)</span>
                </div>
            </div>
        </div>
    );
}

// ── PttypeRow ─────────────────────────────────────────────────────────────────

interface PttypeRowProps {
    row: PttypeSummary;
    maxTotal: number;
    index: number;
}

export function PttypeRow({ row, maxTotal, index }: PttypeRowProps) {
    const widthPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
    const malePct = row.total > 0 ? (row.male / row.total) * 100 : 0;

    return (
        <motion.div
            className="bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-green-300 hover:shadow-sm transition-all duration-150"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.2 }}
        >
            {/* ชื่อสิทธิ์ + จำนวน */}
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <Shield size={13} className="text-green-700" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 truncate">
                        {row.pttype_name || "ไม่ระบุสิทธิ์"}
                    </span>
                </div>
                <span className="text-sm font-extrabold text-gray-900 tabular-nums shrink-0">
                    {row.total.toLocaleString()}
                    <span className="text-[10px] font-medium text-gray-400 ml-1">ราย</span>
                </span>
            </div>

            {/* Proportion bar */}
            <div className="relative h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(widthPct * malePct) / 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <motion.div
                    className="absolute inset-y-0 bg-gradient-to-r from-pink-400 to-pink-500"
                    initial={{ left: 0, width: 0 }}
                    animate={{
                        left: `${(widthPct * malePct) / 100}%`,
                        width: `${widthPct - (widthPct * malePct) / 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>

            {/* ช/ญ counts */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <Mars size={11} className="text-blue-500" />
                    <span className="text-gray-500">ชาย</span>
                    <span className="font-bold text-blue-600 tabular-nums">
                        {row.male.toLocaleString()}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Venus size={11} className="text-pink-500" />
                    <span className="text-gray-500">หญิง</span>
                    <span className="font-bold text-pink-600 tabular-nums">
                        {row.female.toLocaleString()}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}