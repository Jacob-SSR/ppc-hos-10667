"use client";

import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { AnimatePresence, motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

import ThaiDateInput from "@/app/components/ThaiDateInput";
import { TableShimmer } from "@/app/components/table/TableShimmer";
import { TablePagination } from "@/app/components/table/TablePagination";
import { TableHeader } from "@/app/components/table/TableHeader";
import { TableRow } from "@/app/components/table/TableRow";
import { ColumnFilterBar } from "@/app/components/table/ColumnFilterBar";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { AnimatedCount } from "@/app/components/TableHelpers";
import { exportToExcel } from "@/lib/exportExcel";
import { useReportTable } from "@/hooks/useReportTable";
import { cardVariants, filterItemVariants, fadeSlide, pageVariants } from "@/lib/variants";
import { ReportTableProps } from "@/types/allTypes";

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
    const activeFilterKeys = Object.keys(columnFilters).filter((k) => columnFilters[k]);

    const handleExport = () => {
        if (sortedData.length === 0) { toast.error("ไม่มีข้อมูลสำหรับ export"); return; }
        exportToExcel(sortedData, { filePrefix: exportFilePrefix, sheetName, dateKeys });
    };

    return (
        <motion.div className="space-y-5 text-gray-800" variants={pageVariants} initial="hidden" animate="visible">
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { borderRadius: "10px", fontWeight: 600, fontSize: "14px" },
                    success: { iconTheme: { primary: "#3aa36a", secondary: "#fff" } },
                }}
            />

            {/* ── FILTER BAR ── */}
            <motion.div variants={cardVariants} className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5">
                <div className="flex flex-wrap items-end gap-5">

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
                            className="border-2 border-gray-200 px-5 py-2 rounded-full w-64 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7ec8a0] shadow-sm transition-colors duration-200"
                        />
                    </motion.div>

                    {/* Buttons */}
                    <motion.div custom={3} variants={filterItemVariants} className="flex gap-3 ml-auto items-end">
                        <motion.button
                            onClick={fetchData}
                            disabled={loading}
                            className="relative overflow-hidden text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-md disabled:opacity-50"
                            style={{ backgroundColor: "#3aa36a" }}
                            whileHover={{ scale: 1.04, backgroundColor: "#2d8a56" }}
                            whileTap={{ scale: 0.95 }}
                        >
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
                        </motion.button>

                        <AnimatePresence>
                            {data.length > 0 && (
                                <motion.button
                                    onClick={handleExport}
                                    className="text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-md"
                                    style={{ backgroundColor: "#7ec8a0" }}
                                    initial={{ opacity: 0, scale: 0.7, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.7, x: 20 }}
                                    whileHover={{ scale: 1.04, backgroundColor: "#55b882" }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Export Excel
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>

                {/* Column filter dropdowns */}
                <ColumnFilterBar
                    filterKeys={columnFilterKeys}
                    filterLabels={columnFilterLabels}
                    filterOptions={columnFilterOptions}
                    columnFilters={columnFilters}
                    onFilterChange={setColumnFilter}
                    onClearAll={clearAllFilters}
                    activeFilterCount={activeFilterCount}
                    visible={data.length > 0}
                />
            </motion.div>

            {/* ── TABLE CARD ── */}
            <motion.div variants={cardVariants} className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-6">
                <AnimatePresence mode="wait">

                    {/* Loading */}
                    {loading && (
                        <motion.div key="loading" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <TableShimmer cols={colCount} />
                        </motion.div>
                    )}

                    {/* ยังไม่ค้นหา */}
                    {!loading && data.length === 0 && (
                        <motion.div key="empty" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <EmptyState variant="noSearch" />
                        </motion.div>
                    )}

                    {/* Filter ไม่เจอ */}
                    {!loading && data.length > 0 && sortedData.length === 0 && (
                        <motion.div key="no-result" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <EmptyState variant="noResult" onClear={clearAllFilters} />
                        </motion.div>
                    )}

                    {/* Table */}
                    {!loading && sortedData.length > 0 && (
                        <motion.div key="table" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">

                            {/* Count */}
                            <motion.div
                                className="mb-4 text-sm font-semibold text-gray-600 flex items-center gap-2 flex-wrap"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                            >
                                พบทั้งหมด{" "}
                                <span
                                    className="inline-flex items-center justify-center font-bold rounded-full px-3 py-0.5 text-sm min-w-[2.5rem]"
                                    style={{ backgroundColor: "#f0faf4", border: "1px solid #a8d5ba", color: "#1a5233" }}
                                >
                                    <AnimatedCount value={sortedData.length} />
                                </span>{" "}
                                รายการ
                                {(activeFilterCount > 0 || search) && (
                                    <span className="text-xs text-gray-400 font-normal">
                                        จากทั้งหมด {data.length.toLocaleString()} รายการ
                                    </span>
                                )}
                            </motion.div>

                            {/* Table body */}
                            <motion.div
                                key={sortedData.length + String(Object.values(columnFilters).join())}
                                className="overflow-auto max-h-[520px] border border-gray-200 rounded-xl"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                <table className="min-w-full text-sm border-collapse">
                                    <TableHeader
                                        columns={Object.keys(paginatedData[0])}
                                        sortKey={sortKey}
                                        sortAsc={sortAsc}
                                        onSort={handleSort}
                                        activeFilterKeys={activeFilterKeys}
                                    />
                                    <tbody>
                                        {paginatedData.map((row, i) => (
                                            <TableRow
                                                key={i}
                                                row={row}
                                                index={i}
                                                dateKeys={dateKeys}
                                                activeFilterKeys={activeFilterKeys}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </motion.div>

                            <TablePagination
                                page={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}