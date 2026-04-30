"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown } from "react-icons/fi";
import { LuFilterX } from "react-icons/lu";
import { filterItemVariants } from "@/lib/variants";

interface ColumnFilterBarProps {
    filterKeys: string[];
    filterLabels?: Record<string, string>;
    filterOptions: Record<string, string[]>;
    columnFilters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    onClearAll: () => void;
    activeFilterCount: number;
    visible?: boolean;
}

export function ColumnFilterBar({
    filterKeys,
    filterLabels = {},
    filterOptions,
    columnFilters,
    onFilterChange,
    onClearAll,
    activeFilterCount,
    visible = true,
}: ColumnFilterBarProps) {
    if (!visible || filterKeys.length === 0) return null;

    const getLabel = (key: string) => filterLabels[key] ?? key;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
            >
                <div className="border-t border-gray-100 pt-4 flex flex-wrap items-end gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 self-center">
                        <FiChevronDown size={13} />
                        กรองข้อมูล
                    </div>

                    {filterKeys.map((key, i) => {
                        const options = filterOptions[key] ?? [];
                        const isActive = !!columnFilters[key];

                        return (
                            <motion.div
                                key={key}
                                custom={i}
                                variants={filterItemVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                                    {getLabel(key)}
                                </label>
                                <div className="relative">
                                    <select
                                        value={columnFilters[key] ?? ""}
                                        onChange={(e) => onFilterChange(key, e.target.value)}
                                        className={[
                                            "appearance-none pr-7 pl-3 py-2 rounded-lg border-2 text-sm font-medium cursor-pointer focus:outline-none transition-all duration-150",
                                            isActive
                                                ? "border-[#7ec8a0] bg-[#f0faf4] text-[#1a5233]"
                                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                                        ].join(" ")}
                                        style={{ minWidth: "140px" }}
                                    >
                                        <option value="">ทั้งหมด</option>
                                        {options.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                                        <FiChevronDown size={13} />
                                    </span>
                                    {isActive && (
                                        <motion.span
                                            layoutId={`dot-${key}`}
                                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                                            style={{ backgroundColor: "#3aa36a" }}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    <AnimatePresence>
                        {activeFilterCount > 0 && (
                            <motion.button
                                onClick={onClearAll}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-red-200 bg-red-50 text-red-600 text-xs font-bold self-end mb-0.5 hover:bg-red-100 transition-colors"
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.85 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <LuFilterX size={13} />
                                ล้าง ({activeFilterCount})
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}