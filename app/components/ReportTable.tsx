// components/ReportTable.tsx
// ใช้ร่วมกันทุกหน้า: report, no-endpoint, uc-outside-dental, uc-outside
// ครอบคลุม: filter bar, table + sort, pagination, loading skeleton, empty state

"use client";

import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiCopy } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";

import ThaiDateInput from "./ThaiDateInput";
import { ShimmerRow, AnimatedCount } from "./TableHelpers";
import { copyToClipboard } from "@/lib/clipboard";
import { formatThaiDate } from "@/lib/dateUtils";
import { exportToExcel } from "@/lib/exportExcel";
import { useReportTable } from "@/hooks/useReportTable";
import {
    pageVariants,
    cardVariants,
    filterItemVariants,
    tableContainerVariants,
    rowVariants,
    fadeSlide,
} from "@/lib/variants";

interface ReportTableProps {
    /** API path เช่น "/api/report" */
    apiPath: string;
    /** prefix ชื่อไฟล์ Excel เช่น "report" */
    exportFilePrefix: string;
    /** key ที่เป็น date จะถูก format เป็น พ.ศ. (default: ["vstdate"]) */
    dateKeys?: string[];
    /** ชื่อ sheet ใน Excel */
    sheetName?: string;
}

export default function ReportTable({
    apiPath,
    exportFilePrefix,
    dateKeys = ["vstdate"],
    sheetName = "Report",
}: ReportTableProps) {
    const {
        data, loading,
        start, setStart,
        end, setEnd,
        search, handleSearch,
        sortKey, sortAsc,
        page, setPage,
        sortedData, paginatedData, totalPages,
        fetchData, handleSort,
    } = useReportTable({ apiPath });

    const colCount = paginatedData[0] ? Object.keys(paginatedData[0]).length : 6;

    const handleExport = () => {
        if (sortedData.length === 0) { toast.error("ไม่มีข้อมูลสำหรับ export"); return; }
        exportToExcel(sortedData, { filePrefix: exportFilePrefix, sheetName, dateKeys });
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
                    success: { iconTheme: { primary: "#166534", secondary: "#fff" } },
                }}
            />

            {/* ── FILTER BAR ──────────────────────────────────────── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-5 flex flex-wrap items-end gap-5"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
            >
                {/* วันที่เริ่ม */}
                <motion.div custom={0} variants={filterItemVariants}>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                        วันที่เริ่ม
                    </label>
                    <DatePicker
                        selected={start}
                        onChange={(d: Date | null) => setStart(d)}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        showMonthDropdown showYearDropdown
                        dropdownMode="select"
                        yearDropdownItemNumber={20}
                        customInput={<ThaiDateInput />}
                    />
                </motion.div>

                {/* วันที่สิ้นสุด */}
                <motion.div custom={1} variants={filterItemVariants}>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                        วันที่สิ้นสุด
                    </label>
                    <DatePicker
                        selected={end}
                        onChange={(d: Date | null) => setEnd(d)}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        showMonthDropdown showYearDropdown
                        dropdownMode="select"
                        yearDropdownItemNumber={20}
                        customInput={<ThaiDateInput />}
                    />
                </motion.div>

                {/* ค้นหา */}
                <motion.div custom={2} variants={filterItemVariants}>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                        ค้นหา
                    </label>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="border-2 border-gray-200 px-5 py-2 rounded-full w-72 text-sm text-gray-800 bg-white focus:outline-none focus:border-green-700 shadow-sm transition-colors duration-200"
                    />
                </motion.div>

                {/* Buttons */}
                <motion.div custom={3} variants={filterItemVariants} className="flex gap-3 ml-auto">
                    {/* Search button */}
                    <motion.button
                        onClick={fetchData}
                        disabled={loading}
                        className="relative overflow-hidden bg-green-800 text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-lg disabled:opacity-50"
                        whileHover={{ scale: 1.04, boxShadow: "0 8px 28px rgba(22,101,52,0.35)" }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                        <motion.span
                            className="absolute inset-0 bg-white/10 rounded-xl"
                            initial={{ scale: 0, opacity: 0 }}
                            whileHover={{ scale: 2.5, opacity: 1 }}
                            transition={{ duration: 0.4 }}
                        />
                        <span className="relative">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <motion.span
                                        className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                                    />
                                    กำลังโหลด...
                                </span>
                            ) : "Search"}
                        </span>
                    </motion.button>

                    {/* Export button */}
                    <AnimatePresence>
                        {data.length > 0 && (
                            <motion.button
                                onClick={handleExport}
                                className="relative overflow-hidden bg-emerald-600 text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-lg"
                                initial={{ opacity: 0, scale: 0.7, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.7, x: 20 }}
                                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                                whileHover={{ scale: 1.04, boxShadow: "0 8px 28px rgba(5,150,105,0.35)" }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <motion.span
                                    className="absolute inset-0 bg-white/10 rounded-xl"
                                    initial={{ scale: 0, opacity: 0 }}
                                    whileHover={{ scale: 2.5, opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                />
                                <span className="relative">Export Excel</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            {/* ── TABLE CARD ──────────────────────────────────────── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-6"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
            >
                <AnimatePresence mode="wait">

                    {/* Loading skeleton */}
                    {loading && (
                        <motion.div key="loading" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <div className="mb-4 h-5 w-40 rounded-md bg-gray-200 animate-pulse" />
                            <div className="overflow-hidden border border-gray-200 rounded-xl">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Array.from({ length: colCount }).map((_, i) => (
                                                <th key={i} className="bg-green-800 px-4 py-3 border-r border-green-700">
                                                    <div className="h-3 rounded bg-green-700/60 w-16" />
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

                    {/* Empty state */}
                    {!loading && sortedData.length === 0 && (
                        <motion.div
                            key="empty" variants={fadeSlide} initial="hidden" animate="visible" exit="exit"
                            className="flex flex-col items-center justify-center py-24 gap-3"
                        >
                            <motion.div
                                className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl"
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                🗂️
                            </motion.div>
                            <p className="text-gray-500 font-medium text-sm">
                                ไม่พบข้อมูล กรุณาเลือกช่วงวันที่แล้วกด Search
                            </p>
                        </motion.div>
                    )}

                    {/* Table */}
                    {!loading && sortedData.length > 0 && (
                        <motion.div key="table" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">

                            {/* Result count */}
                            <motion.div
                                className="mb-4 text-sm font-semibold text-gray-600 flex items-center gap-2"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                            >
                                พบทั้งหมด{" "}
                                <span className="inline-flex items-center justify-center bg-green-50 border border-green-200 text-green-800 font-bold rounded-full px-3 py-0.5 text-sm min-w-[2.5rem]">
                                    <AnimatedCount value={sortedData.length} />
                                </span>{" "}
                                รายการ
                            </motion.div>

                            {/* Table body */}
                            <div className="overflow-auto max-h-[520px] border border-gray-200 rounded-xl">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Object.keys(paginatedData[0]).map((key, i) => (
                                                <motion.th
                                                    key={key}
                                                    onClick={() => handleSort(key)}
                                                    className="sticky top-0 bg-green-800 text-white px-4 py-3 text-left cursor-pointer whitespace-nowrap border-r border-green-700 select-none"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.05 + i * 0.025 }}
                                                    whileHover={{ backgroundColor: "#14532d" }}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {key}
                                                        <AnimatePresence>
                                                            {sortKey === key && (
                                                                <motion.span
                                                                    initial={{ opacity: 0, rotate: -90 }}
                                                                    animate={{ opacity: 1, rotate: 0 }}
                                                                    exit={{ opacity: 0, rotate: 90 }}
                                                                    transition={{ duration: 0.18 }}
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

                                    <motion.tbody variants={tableContainerVariants} initial="hidden" animate="visible">
                                        {paginatedData.map((row: any, i: number) => (
                                            <motion.tr
                                                key={i}
                                                variants={rowVariants}
                                                className={`border-b border-gray-200 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                                whileHover={{ backgroundColor: "#f0fdf4", transition: { duration: 0.12 } }}
                                            >
                                                {Object.entries(row).map(([key, val]: any, idx: number) => (
                                                    <td key={idx} className="px-4 py-2.5 text-sm whitespace-nowrap border-r border-gray-100 text-gray-800">
                                                        <div className="flex items-center justify-between gap-2 group">
                                                            <span>
                                                                {dateKeys.includes(key) && val && String(val).includes("-")
                                                                    ? formatThaiDate(val)
                                                                    : String(val ?? "")}
                                                            </span>
                                                            <motion.button
                                                                onClick={() => {
                                                                    const text = dateKeys.includes(key) ? formatThaiDate(val) : String(val ?? "");
                                                                    copyToClipboard(text);
                                                                    toast.success("คัดลอกแล้ว");
                                                                }}
                                                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-500"
                                                                whileHover={{ scale: 1.2 }}
                                                                whileTap={{ scale: 0.85 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                                            >
                                                                <FiCopy size={14} />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                ))}
                                            </motion.tr>
                                        ))}
                                    </motion.tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <motion.div
                                className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, duration: 0.3 }}
                            >
                                <p className="text-sm font-medium text-gray-500">
                                    หน้า <span className="font-bold text-gray-800">{page}</span> / {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:border-green-700 hover:text-green-800 disabled:opacity-30 transition-colors duration-150"
                                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    >
                                        ← ก่อนหน้า
                                    </motion.button>

                                    <motion.span
                                        key={page}
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                        className="border-2 border-green-700 rounded-lg px-4 py-2 text-sm font-bold text-green-800 min-w-[3rem] text-center bg-green-50"
                                    >
                                        {page}
                                    </motion.span>

                                    <motion.button
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                        disabled={page === totalPages}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:border-green-700 hover:text-green-800 disabled:opacity-30 transition-colors duration-150"
                                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
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