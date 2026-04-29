"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiCopy } from "react-icons/fi";
import { FolderClosed } from 'lucide-react';
import toast, { Toaster } from "react-hot-toast";
import { ShimmerRow, LoadingBar, AnimatedCount } from "./TableHelpers";
import { copyToClipboard } from "@/lib/clipboard";
import { formatThaiDate } from "@/lib/dateUtils";
import { exportToExcel } from "@/lib/exportExcel";
import { cardVariants, fadeSlide, pageVariants } from "@/lib/variants";

interface PpaTableProps {
    apiPath: string;
    exportFilePrefix: string;
    dateKeys?: string[];
    sheetName?: string;
    dateRangeLabel: string;
}

const PAGE_SIZE = 50;

export default function PpaTable({
    apiPath,
    exportFilePrefix,
    dateKeys = [],
    sheetName = "Report",
    dateRangeLabel,
}: PpaTableProps) {
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(apiPath, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json: unknown = await res.json();
                setData(Array.isArray(json) ? (json as Record<string, unknown>[]) : []);
            } catch {
                toast.error("โหลดข้อมูลไม่สำเร็จ");
            } finally {
                setLoading(false);
            }
        })();
    }, [apiPath]);

    const searched = useMemo(
        () => data.filter((row) =>
            Object.values(row).some((val) =>
                String(val).toLowerCase().includes(search.toLowerCase()),
            ),
        ),
        [data, search],
    );

    const sorted = useMemo(() => {
        if (!sortKey) return searched;
        return [...searched].sort((a, b) =>
            sortAsc
                ? String(a[sortKey]).localeCompare(String(b[sortKey]), "th")
                : String(b[sortKey]).localeCompare(String(a[sortKey]), "th"),
        );
    }, [searched, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const colCount = paginated[0] ? Object.keys(paginated[0]).length : 8;

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc((p) => !p);
        else { setSortKey(key); setSortAsc(true); }
    };

    const handleExport = () => {
        if (sorted.length === 0) { toast.error("ไม่มีข้อมูลสำหรับ export"); return; }
        exportToExcel(sorted, { filePrefix: exportFilePrefix, sheetName, dateKeys });
    };

    return (
        <motion.div
            className="space-y-5 text-gray-800"
            variants={pageVariants}
            initial="hidden"
            animate="visible"
        >
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { borderRadius: "10px", fontWeight: 600, fontSize: "14px" },
                    success: { iconTheme: { primary: "#3aa36a", secondary: "#fff" } },
                }}
            />

            {/* ── Header bar ── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">ช่วงข้อมูล</span>
                    <span
                        className="text-sm font-semibold px-4 py-1.5 rounded-full border"
                        style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
                    >
                        {dateRangeLabel}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="border-2 border-gray-200 px-5 py-2 rounded-full w-56 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0] shadow-sm transition-colors duration-200"
                    />
                    <AnimatePresence>
                        {data.length > 0 && (
                            <motion.button
                                onClick={handleExport}
                                className="relative overflow-hidden text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md"
                                style={{ backgroundColor: "#7ec8a0" }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.04, backgroundColor: "#55b882" }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Export Excel
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ── Table card ── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-6"
            >
                <AnimatePresence mode="wait">

                    {/* Loading */}
                    {loading && (
                        <motion.div key="loading" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <LoadingBar />
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
                                            {Array.from({ length: colCount }).map((_, i) => (
                                                <th key={i} className="px-4 py-3 border-r border-[#a8d5ba]"
                                                    style={{ backgroundColor: "#7ec8a0" }}>
                                                    <div className="h-3 rounded w-16" style={{ backgroundColor: "#a8d5ba" }} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 8 }).map((_, i) => (
                                            <ShimmerRow key={i} cols={colCount} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {/* Empty */}
                    {!loading && sorted.length === 0 && (
                        <motion.div
                            key="empty"
                            variants={fadeSlide} initial="hidden" animate="visible" exit="exit"
                            className="flex flex-col items-center justify-center py-24 gap-3"
                        >
                            <motion.div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                                style={{ backgroundColor: "#f0faf4" }}
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <FolderClosed />
                            </motion.div>
                            <p className="text-gray-500 font-medium text-sm">ไม่พบข้อมูลในช่วงเวลานี้</p>
                        </motion.div>
                    )}

                    {/* Table */}
                    {!loading && sorted.length > 0 && (
                        <motion.div key="table" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <motion.div
                                className="mb-4 text-sm font-semibold text-gray-600 flex items-center gap-2"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                            >
                                พบทั้งหมด{" "}
                                <span
                                    className="inline-flex items-center justify-center font-bold rounded-full px-3 py-0.5 text-sm min-w-[2.5rem] border"
                                    style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
                                >
                                    <AnimatedCount value={sorted.length} />
                                </span>{" "}
                                รายการ
                                {search && (
                                    <span className="text-xs text-gray-400 font-normal">
                                        จากทั้งหมด {data.length.toLocaleString()} รายการ
                                    </span>
                                )}
                            </motion.div>

                            <motion.div
                                className="overflow-auto max-h-[560px] border border-gray-200 rounded-xl"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Object.keys(paginated[0]).map((key, i) => (
                                                <motion.th
                                                    key={key}
                                                    onClick={() => handleSort(key)}
                                                    className="sticky top-0 text-white px-4 py-3 text-left cursor-pointer whitespace-nowrap border-r select-none"
                                                    style={{ backgroundColor: "#7ec8a0", borderColor: "#a8d5ba" }}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.05 + i * 0.025 }}
                                                    whileHover={{ backgroundColor: "#55b882" }}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {key}
                                                        <AnimatePresence>
                                                            {sortKey === key && (
                                                                <motion.span
                                                                    initial={{ opacity: 0, rotate: -90 }}
                                                                    animate={{ opacity: 1, rotate: 0 }}
                                                                    exit={{ opacity: 0, rotate: 90 }}
                                                                >
                                                                    {sortAsc ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                                                </motion.span>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </motion.th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((row, i) => (
                                            <tr
                                                key={i}
                                                className={`border-b border-gray-100 transition-colors duration-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#ffffff" : "#f9fafb")}
                                            >
                                                {Object.entries(row).map(([key, val], idx) => (
                                                    <td key={idx} className="px-4 py-2.5 text-sm whitespace-nowrap border-r border-gray-100 text-gray-800">
                                                        <div className="flex items-center justify-between gap-2 group">
                                                            <span>
                                                                {dateKeys.includes(key) && val && (String(val).includes("-") || String(val).includes("T"))
                                                                    ? formatThaiDate(val)
                                                                    : String(val ?? "")}
                                                            </span>
                                                            <motion.button
                                                                onClick={() => {
                                                                    copyToClipboard(dateKeys.includes(key) ? formatThaiDate(val) : String(val ?? ""));
                                                                    toast.success("คัดลอกแล้ว");
                                                                }}
                                                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-500"
                                                                whileHover={{ scale: 1.2 }}
                                                                whileTap={{ scale: 0.85 }}
                                                            >
                                                                <FiCopy size={14} />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </motion.div>

                            {/* Pagination */}
                            <motion.div
                                className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <p className="text-sm font-medium text-gray-500">
                                    หน้า <span className="font-bold text-gray-800">{page}</span> / {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors"
                                        whileHover={{ scale: 1.04, borderColor: "#7ec8a0", color: "#1a5233" }}
                                        whileTap={{ scale: 0.94 }}
                                    >
                                        ← ก่อนหน้า
                                    </motion.button>
                                    <motion.span
                                        key={page}
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="rounded-lg px-4 py-2 text-sm font-bold min-w-[3rem] text-center border-2"
                                        style={{ borderColor: "#7ec8a0", color: "#1a5233", backgroundColor: "#f0faf4" }}
                                    >
                                        {page}
                                    </motion.span>
                                    <motion.button
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                        disabled={page === totalPages}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors"
                                        whileHover={{ scale: 1.04, borderColor: "#7ec8a0", color: "#1a5233" }}
                                        whileTap={{ scale: 0.94 }}
                                    >
                                        ถัดไป →
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}