"use client";

import { motion } from "framer-motion";
import { FolderClosed, Search } from "lucide-react";

type EmptyStateVariant = "noData" | "noResult" | "noSearch";

interface EmptyStateProps {
    variant?: EmptyStateVariant;
    message?: string;
    onClear?: () => void;
}

const CONFIG: Record<
    EmptyStateVariant,
    { Icon: React.ElementType; bg: string; defaultMsg: string }
> = {
    noSearch: {
        Icon: FolderClosed,
        bg: "#f0faf4",
        defaultMsg: "ไม่พบข้อมูล กรุณาเลือกช่วงวันที่แล้วกด Search",
    },
    noData: {
        Icon: FolderClosed,
        bg: "#f0faf4",
        defaultMsg: "ไม่พบข้อมูลในช่วงเวลานี้",
    },
    noResult: {
        Icon: Search,
        bg: "#fffbeb",
        defaultMsg: "ไม่พบข้อมูลที่ตรงกับ Filter ที่เลือก",
    },
};

export function EmptyState({ variant = "noData", message, onClear }: EmptyStateProps) {
    const { Icon, bg, defaultMsg } = CONFIG[variant];

    return (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
            <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: bg }}
                animate={variant !== "noResult" ? { y: [0, -6, 0] } : {}}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
                <Icon size={28} className="text-gray-400" />
            </motion.div>

            <p className="text-gray-500 font-medium text-sm text-center max-w-xs">
                {message ?? defaultMsg}
            </p>

            {variant === "noResult" && onClear && (
                <button
                    onClick={onClear}
                    className="text-sm underline font-semibold"
                    style={{ color: "#3aa36a" }}
                >
                    ล้าง Filter ทั้งหมด
                </button>
            )}
        </div>
    );
}