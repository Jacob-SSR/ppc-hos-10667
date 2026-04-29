"use client";

import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiCopy } from "react-icons/fi";
import { FolderClosed, Search } from 'lucide-react';
import { LuFilterX } from "react-icons/lu";
import toast, { Toaster } from "react-hot-toast";
import { ReportTableProps } from "@/types/allTypes";

import ThaiDateInput from "./ThaiDateInput";
import { ShimmerRow, LoadingBar, AnimatedCount } from "./TableHelpers";
import { copyToClipboard } from "@/lib/clipboard";
import { formatThaiDate } from "@/lib/dateUtils";
import { exportToExcel } from "@/lib/exportExcel";
import { useReportTable } from "@/hooks/useReportTable";
import {
    pageVariants,
    cardVariants,
    filterItemVariants,
    fadeSlide,
} from "@/lib/variants";

export default function ReportTable({
    apiPath,
    exportFilePrefix,
    dateKeys = ["vstdate"],
    sheetName = "Report",
    columnFilterKeys = [],
    columnFilterLabels = {},
}: ReportTableProps) {
    const {
        data, loading,
        start, setStart, end, setEnd,
        search, handleSearch,
        sortKey, sortAsc,
        page, setPage,
        sortedData, paginatedData, totalPages,
        fetchData, handleSort,
        columnFilters, columnFilterOptions,
        setColumnFilter, clearAllFilters,
        activeFilterCount,
    } = useReportTable({ apiPath, columnFilterKeys });

    const colCount = paginatedData[0] ? Object.keys(paginatedData[0]).length : 6;

    const handleExport = () => {
        if (sortedData.length === 0) { toast.error("ไม่มีข้อมูลสำหรับ export"); return; }
        exportToExcel(sortedData, { filePrefix: exportFilePrefix, sheetName, dateKeys });
    };

    const getLabel = (key: string) => columnFilterLabels[key] ?? key;

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

            {/* ── FILTER BAR ── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5"
            >
                {/* Row 1 */}
                <div className="flex flex-wrap items-end gap-5">
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

                    <motion.div custom={2} variants={filterItemVariants}>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            ค้นหา
                        </label>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="border-2 border-gray-200 px-5 py-2 rounded-full w-64 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0] shadow-sm transition-colors duration-200"
                        />
                    </motion.div>

                    <motion.div custom={3} variants={filterItemVariants} className="flex gap-3 ml-auto items-end">
                        {/* ปุ่ม Search — มิ้นกลาง */}
                        <motion.button
                            onClick={fetchData}
                            disabled={loading}
                            className="relative overflow-hidden text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-md disabled:opacity-50"
                            style={{ backgroundColor: "#3aa36a" }}
                            whileHover={{ scale: 1.04, backgroundColor: "#2d8a56" }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        >
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

                        <AnimatePresence>
                            {data.length > 0 && (
                                <motion.button
                                    onClick={handleExport}
                                    className="relative overflow-hidden text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-md"
                                    style={{ backgroundColor: "#7ec8a0" }}
                                    initial={{ opacity: 0, scale: 0.7, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.7, x: 20 }}
                                    transition={{ type: "spring", stiffness: 360, damping: 22 }}
                                    whileHover={{ scale: 1.04, backgroundColor: "#55b882" }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <span className="relative">Export Excel</span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>

                {/* Row 2: Column filter dropdowns */}
                <AnimatePresence>
                    {data.length > 0 && columnFilterKeys.length > 0 && (
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

                                {columnFilterKeys.map((key, i) => {
                                    const options = columnFilterOptions[key] ?? [];
                                    const active = !!columnFilters[key];
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
                                                    onChange={(e) => setColumnFilter(key, e.target.value)}
                                                    className={`appearance-none pr-7 pl-3 py-2 rounded-lg border-2 text-sm font-medium cursor-pointer focus:outline-none transition-all duration-150
                                                        ${active
                                                            ? "border-[#7ec8a0] bg-[#f0faf4] text-[#1a5233]"
                                                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                                        }`}
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
                                                {active && (
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
                                            onClick={clearAllFilters}
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
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ── TABLE CARD ── */}
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
                    {!loading && data.length === 0 && (
                        <motion.div
                            key="empty" variants={fadeSlide} initial="hidden" animate="visible" exit="exit"
                            className="flex flex-col items-center justify-center py-24 gap-3"
                        >
                            <motion.div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                                style={{ backgroundColor: "#f0faf4" }}
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <FolderClosed size={32}/>

                            </motion.div>
                            <p className="text-gray-500 font-medium text-sm">
                                ไม่พบข้อมูล กรุณาเลือกช่วงวันที่แล้วกด Search
                            </p>
                        </motion.div>
                    )}

                    {/* No result after filter */}
                    {!loading && data.length > 0 && sortedData.length === 0 && (
                        <motion.div
                            key="no-result" variants={fadeSlide} initial="hidden" animate="visible" exit="exit"
                            className="flex flex-col items-center justify-center py-24 gap-3"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl"> <Search /> </div>
                            <p className="text-gray-500 font-medium text-sm">ไม่พบข้อมูลที่ตรงกับ Filter ที่เลือก</p>
                            <button onClick={clearAllFilters}
                                className="text-sm underline font-semibold"
                                style={{ color: "#3aa36a" }}>
                                ล้าง Filter ทั้งหมด
                            </button>
                        </motion.div>
                    )}

                    {/* Table */}
                    {!loading && sortedData.length > 0 && (
                        <motion.div key="table" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <motion.div
                                className="mb-4 text-sm font-semibold text-gray-600 flex items-center gap-2 flex-wrap"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                            >
                                พบทั้งหมด{" "}
                                <span className="inline-flex items-center justify-center font-bold rounded-full px-3 py-0.5 text-sm min-w-[2.5rem]"
                                    style={{ backgroundColor: "#f0faf4", border: "1px solid #a8d5ba", color: "#1a5233" }}>
                                    <AnimatedCount value={sortedData.length} />
                                </span>{" "}
                                รายการ
                                {(activeFilterCount > 0 || search) && (
                                    <span className="text-xs text-gray-400 font-normal">
                                        จากทั้งหมด {data.length.toLocaleString()} รายการ
                                    </span>
                                )}
                            </motion.div>

                            <motion.div
                                key={sortedData.length + String(Object.values(columnFilters).join())}
                                className="overflow-auto max-h-[520px] border border-gray-200 rounded-xl"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Object.keys(paginatedData[0]).map((key, i) => (
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

                                    <tbody>
                                        {paginatedData.map((row, i) => (
                                            <tr
                                                key={i}
                                                className={`border-b border-gray-100 transition-colors duration-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#ffffff" : "#f9fafb")}
                                            >
                                                {Object.entries(row).map(([key, val], idx) => (
                                                    <td
                                                        key={idx}
                                                        className="px-4 py-2.5 text-sm whitespace-nowrap border-r border-gray-100 text-gray-800"
                                                        style={columnFilters[key] ? { backgroundColor: "#f0faf4" } : {}}
                                                    >
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
                                transition={{ delay: 0.25, duration: 0.3 }}
                            >
                                <p className="text-sm font-medium text-gray-500">
                                    หน้า <span className="font-bold text-gray-800">{page}</span> / {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors duration-150"
                                        whileHover={{ scale: 1.04, borderColor: "#7ec8a0", color: "#1a5233" }}
                                        whileTap={{ scale: 0.94 }}
                                    >
                                        ← ก่อนหน้า
                                    </motion.button>
                                    <motion.span
                                        key={page}
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                        className="rounded-lg px-4 py-2 text-sm font-bold min-w-[3rem] text-center border-2"
                                        style={{ borderColor: "#7ec8a0", color: "#1a5233", backgroundColor: "#f0faf4" }}
                                    >
                                        {page}
                                    </motion.span>
                                    <motion.button
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                        disabled={page === totalPages}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 transition-colors duration-150"
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