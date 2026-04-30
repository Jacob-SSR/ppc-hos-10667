"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

// ── path ทั้งหมดใช้ @/app/components/ เพราะ tsconfig @/* = project root ──────
import { TableShimmer } from "@/app/components/table/TableShimmer";
import { TablePagination } from "@/app/components/table/TablePagination";
import { TableHeader } from "@/app/components/table/TableHeader";
import { TableRow } from "@/app/components/table/TableRow";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { AnimatedCount } from "@/app/components/TableHelpers";
import { exportToExcel } from "@/lib/exportExcel";
import { cardVariants, fadeSlide, pageVariants } from "@/lib/variants";

const PAGE_SIZE = 50;

interface PpaTableProps {
    apiPath: string;
    exportFilePrefix: string;
    dateKeys?: string[];
    sheetName?: string;
    dateRangeLabel: string;
}

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
        () =>
            data.filter((row) =>
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
        <motion.div className="space-y-5 text-gray-800" variants={pageVariants} initial="hidden" animate="visible">
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { borderRadius: "10px", fontWeight: 600, fontSize: "14px" },
                    success: { iconTheme: { primary: "#3aa36a", secondary: "#fff" } },
                }}
            />

            {/* Header bar */}
            <motion.div
                variants={cardVariants}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        ช่วงข้อมูล
                    </span>
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
                                className="text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md"
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

            {/* Table card */}
            <motion.div variants={cardVariants} className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-6">
                <AnimatePresence mode="wait">

                    {loading && (
                        <motion.div key="loading" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <TableShimmer cols={colCount} />
                        </motion.div>
                    )}

                    {!loading && sorted.length === 0 && (
                        <motion.div key="empty" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
                            <EmptyState variant="noData" />
                        </motion.div>
                    )}

                    {!loading && sorted.length > 0 && (
                        <motion.div key="table" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">

                            {/* Count */}
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

                            {/* Table body */}
                            <motion.div
                                className="overflow-auto max-h-[560px] border border-gray-200 rounded-xl"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                <table className="min-w-full text-sm border-collapse">
                                    <TableHeader
                                        columns={Object.keys(paginated[0])}
                                        sortKey={sortKey}
                                        sortAsc={sortAsc}
                                        onSort={handleSort}
                                    />
                                    <tbody>
                                        {paginated.map((row, i) => (
                                            <TableRow
                                                key={i}
                                                row={row}
                                                index={i}
                                                dateKeys={dateKeys}
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