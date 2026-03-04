"use client";

import { useState, useMemo, forwardRef } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useTransform,
    animate,
} from "framer-motion";

const PAGE_SIZE = 50;

// ─── Variants ────────────────────────────────────────────────────────────────

const pageVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 28, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 260, damping: 22 },
    },
};

const filterItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, type: "spring", stiffness: 300, damping: 24 },
    }),
};

const tableContainerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.018, delayChildren: 0.05 },
    },
    exit: { opacity: 0, transition: { duration: 0.18 } },
};

const rowVariants = {
    hidden: { opacity: 0, x: -14, scale: 0.99 },
    visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 320, damping: 26 },
    },
};

const fadeSlide = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
};

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────

function ShimmerRow({ cols }: { cols: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3 border-r">
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

// ─── Animated Count ───────────────────────────────────────────────────────────

function AnimatedCount({ value }: { value: number }) {
    const motionVal = useMotionValue(0);
    const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString());

    useMemo(() => {
        const ctrl = animate(motionVal, value, { duration: 0.7, ease: "easeOut" });
        return ctrl.stop;
    }, [value]);

    return <motion.span className="text-green-800">{rounded}</motion.span>;
}

// ─── ThaiDateInput ────────────────────────────────────────────────────────────

const ThaiDateInput = forwardRef<
    HTMLInputElement,
    { value?: string; onClick?: () => void }
>(({ value, onClick }, ref) => {
    const thaiValue = value
        ? (() => {
            const [d, m, y] = value.split("/");
            return `${d}/${m}/${Number(y) + 543}`;
        })()
        : "";

    return (
        <input
            ref={ref}
            value={thaiValue}
            onClick={onClick}
            readOnly
            className="border-2 border-gray-300 px-4 py-2 rounded-lg w-40 cursor-pointer text-sm bg-white focus:outline-none focus:border-green-800 shadow-sm"
        />
    );
});
ThaiDateInput.displayName = "ThaiDateInput";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UcOutsideDentalPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [start, setStart] = useState<Date | null>(new Date(2026, 0, 1));
    const [end, setEnd] = useState<Date | null>(new Date());
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const formatThaiDate = (val: any) => {
        if (!val) return "";
        const str = String(val);
        if (str.includes("T")) {
            const date = new Date(str);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            return `${d}/${m}/${y + 543}`;
        }
        const [y, m, d] = str.split("T")[0].split("-");
        return `${d}/${m}/${Number(y) + 543}`;
    };

    const fetchData = async () => {
        if (!start || !end) return alert("กรุณาเลือกวันที่");
        setLoading(true);
        try {
            const res = await fetch(
                `/api/uc-outside-dental?start=${formatDate(start)}&end=${formatDate(end)}`
            );
            const json = await res.json();
            setData(json || []);
            setPage(1);
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        }
        setLoading(false);
    };

    const filteredData = useMemo(
        () =>
            data.filter((row) =>
                Object.values(row).some((val) =>
                    String(val).toLowerCase().includes(search.toLowerCase())
                )
            ),
        [data, search]
    );

    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData;
        return [...filteredData].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            return sortAsc
                ? String(aVal).localeCompare(String(bVal), "th")
                : String(bVal).localeCompare(String(aVal), "th");
        });
    }, [filteredData, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
    const paginatedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(true); }
    };

    const handleExport = () => {
        if (sortedData.length === 0) { toast.error("ไม่มีข้อมูลสำหรับ export"); return; }
        const cleanedData = sortedData.map((row) => {
            const newRow: any = {};
            Object.entries(row).forEach(([key, val]) => {
                newRow[key] = key === "vstdate" ? formatThaiDate(val) : val ?? "";
            });
            return newRow;
        });
        const worksheet = XLSX.utils.json_to_sheet(cleanedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const file = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });
        const nowTH = new Date()
            .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
            .replace(" ", "_");
        saveAs(file, `uc-outside-dental_${nowTH}.xlsx`);
    };

    const colCount = paginatedData[0] ? Object.keys(paginatedData[0]).length : 6;

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

            {/* ── FILTER BAR ────────────────────────────────────────── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-5 flex flex-wrap items-end gap-5"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
            >
                <motion.div custom={0} variants={filterItemVariants}>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                        วันที่เริ่ม
                    </label>
                    <DatePicker
                        selected={start}
                        onChange={(d: Date | null) => setStart(d)}
                        dateFormat="dd/MM/yyyy"
                        locale={th}
                        showMonthDropdown
                        showYearDropdown
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
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
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
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="border-2 border-gray-200 px-5 py-2 rounded-full w-72 text-sm bg-white focus:outline-none focus:border-green-700 shadow-sm transition-colors duration-200"
                    />
                </motion.div>

                <motion.div custom={3} variants={filterItemVariants} className="flex gap-3 ml-auto">
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

            {/* ── TABLE CARD ────────────────────────────────────────── */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-md px-6 py-6"
                style={{ boxShadow: "0 4px 24px 0 rgba(22,101,52,0.07)" }}
            >
                <AnimatePresence mode="wait">

                    {/* Loading — shimmer skeleton */}
                    {loading && (
                        <motion.div
                            key="loading"
                            variants={fadeSlide}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <div className="mb-4 h-5 w-40 rounded-md bg-gray-200 animate-pulse" />
                            <div className="overflow-hidden border border-gray-200 rounded-xl">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Array.from({ length: colCount }).map((_, i) => (
                                                <th key={i} className="bg-green-800 px-4 py-3 border-r">
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
                            key="empty"
                            variants={fadeSlide}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
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
                        <motion.div
                            key="table"
                            variants={fadeSlide}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
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

                            <div className="overflow-auto max-h-[520px] border border-gray-200 rounded-xl">
                                <table className="min-w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            {Object.keys(paginatedData[0]).map((key, i) => (
                                                <motion.th
                                                    key={key}
                                                    onClick={() => handleSort(key)}
                                                    className="sticky top-0 bg-green-800 text-white px-4 py-3 text-left cursor-pointer whitespace-nowrap border-r select-none"
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

                                    <motion.tbody
                                        variants={tableContainerVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        {paginatedData.map((row, i) => (
                                            <motion.tr
                                                key={i}
                                                variants={rowVariants}
                                                className={`border-b cursor-default ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}
                                                whileHover={{
                                                    backgroundColor: "#f0fdf4",
                                                    transition: { duration: 0.12 },
                                                }}
                                            >
                                                {Object.entries(row as Record<string, any>).map(
                                                    ([key, val], idx) => (
                                                        <td key={idx} className="px-4 py-2.5 whitespace-nowrap border-r text-gray-700">
                                                            {key === "vstdate" ? formatThaiDate(val) : String(val ?? "")}
                                                        </td>
                                                    )
                                                )}
                                            </motion.tr>
                                        ))}
                                    </motion.tbody>
                                </table>
                            </div>

                            {/* PAGINATION */}
                            <motion.div
                                className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, duration: 0.3 }}
                            >
                                <p className="text-sm font-medium text-gray-500">
                                    หน้า{" "}
                                    <span className="font-bold text-gray-800">{page}</span>
                                    {" "}/ {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                        disabled={page === 1}
                                        className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:border-green-700 hover:text-green-800 disabled:opacity-30 transition-colors duration-150"
                                        whileHover={{ scale: 1.04 }}
                                        whileTap={{ scale: 0.94 }}
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
                                        whileHover={{ scale: 1.04 }}
                                        whileTap={{ scale: 0.94 }}
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