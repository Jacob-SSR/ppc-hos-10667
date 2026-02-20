"use client";

import { useState, useMemo } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { ReportRow } from "@/types/report";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FiCopy, FiChevronUp, FiChevronDown } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";

const PAGE_SIZE = 50;

export default function ReportPage() {
    const [data, setData] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [start, setStart] = useState<Date | null>(
        new Date(2026, 0, 1)
    );
    const [end, setEnd] = useState<Date | null>(new Date());
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);

    const formatDate = (date: Date) =>
        date.toISOString().split("T")[0];

    const fetchReport = async () => {
        if (!start || !end) return alert("กรุณาเลือกวันที่");

        setLoading(true);
        const res = await fetch(
            `/api/report?start=${formatDate(start)}&end=${formatDate(end)}`
        );
        const json = await res.json();
        setData(json);
        setPage(1);
        setLoading(false);
        toast.success("โหลดข้อมูลสำเร็จ");
    };

    const copyToClipboard = (value: any) => {
        navigator.clipboard.writeText(String(value));
        toast.success("คัดลอกแล้ว");
    };

    const exportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
        });
        const file = new Blob([excelBuffer], {
            type: "application/octet-stream",
        });
        saveAs(file, "report.xlsx");
    };

    const filteredData = useMemo(() => {
        return data.filter((row) =>
            Object.values(row).some((val) =>
                String(val).toLowerCase().includes(search.toLowerCase())
            )
        );
    }, [data, search]);

    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortKey as keyof ReportRow];
            const bVal = b[sortKey as keyof ReportRow];
            return sortAsc
                ? String(aVal).localeCompare(String(bVal), "th")
                : String(bVal).localeCompare(String(aVal), "th");
        });
    }, [filteredData, sortKey, sortAsc]);

    const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);

    const paginatedData = sortedData.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/login";
    };

    return (
        <div className="min-h-screen bg-gray-200 text-gray-900">
            <Toaster position="top-center" />

            <div className="relative flex items-center px-6 py-4 bg-white shadow-md">

                {/* Left - Logo */}
                <div className="flex items-center gap-4">
                    <img
                        src="/logo.png"
                        alt="logo"
                        className="h-12 w-auto"
                    />
                </div>

                {/* Center - Text */}
                <h1 className="absolute left-1/2 -translate-x-1/2 font-bold text-2xl text-green-800">
                    สิทธิ์หลักเป็น 10667
                </h1>

                {/* Right - Logout */}
                <div className="ml-auto">
                    <button
                        onClick={handleLogout}
                        className="bg-green-700 text-white px-4 py-2 rounded-md"
                    >
                        Logout
                    </button>
                </div>

            </div>

            <div className="p-6">

                <div className="flex gap-4 items-end mb-4 bg-white p-4 rounded shadow">
                    <div>
                        <label className="text-sm block mb-1">Start</label>
                        <DatePicker
                            selected={start}
                            onChange={(d: Date | null) => setStart(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            className="border p-2 rounded"
                        />
                    </div>

                    <div>
                        <label className="text-sm block mb-1">End</label>
                        <DatePicker
                            selected={end}
                            onChange={(d: Date | null) => setEnd(d)}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={20}
                            className="border p-2 rounded"
                        />
                    </div>

                    <button
                        onClick={fetchReport}
                        className="bg-green-600 text-white px-4 py-2 rounded"
                    >
                        Search
                    </button>

                    {data.length > 0 && (
                        <button
                            onClick={exportExcel}
                            className="bg-blue-600 text-white px-4 py-2 rounded"
                        >
                            Export Excel
                        </button>
                    )}
                </div>

                {data.length > 0 && (
                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder="ค้นหาข้อมูล..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="border px-3 py-2 rounded w-64"
                        />
                    </div>
                )}

                <div className="bg-white rounded shadow p-4">
                    {loading && <p>Loading...</p>}

                    {!loading && paginatedData.length > 0 && (
                        <>
                            <div className="overflow-auto max-h-[600px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-green-200 sticky top-0">
                                        <tr>
                                            {Object.keys(paginatedData[0]).map((key) => (
                                                <th
                                                    key={key}
                                                    onClick={() => handleSort(key)}
                                                    className="px-4 py-2 border cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {key}
                                                        {sortKey === key &&
                                                            (sortAsc ? (
                                                                <FiChevronUp size={14} />
                                                            ) : (
                                                                <FiChevronDown size={14} />
                                                            ))}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {paginatedData.map((row, i) => (
                                            <tr key={i} className="hover:bg-yellow-50">
                                                {Object.values(row).map((val, idx) => (
                                                    <td key={idx} className="px-4 py-2 border">
                                                        <div className="flex justify-between items-center group">
                                                            <span>{val}</span>
                                                            <button
                                                                onClick={() => copyToClipboard(val)}
                                                                className="opacity-0 group-hover:opacity-100 transition"
                                                            >
                                                                <FiCopy size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-4">
                                <button
                                    onClick={() =>
                                        setPage((p) => Math.max(p - 1, 1))
                                    }
                                    disabled={page === 1}
                                    className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
                                >
                                    ◀ ก่อนหน้า
                                </button>

                                <span className="text-sm">
                                    หน้า {page} / {totalPages}
                                </span>

                                <button
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(p + 1, totalPages)
                                        )
                                    }
                                    disabled={page === totalPages}
                                    className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
                                >
                                    ถัดไป ▶
                                </button>
                            </div>
                        </>
                    )}

                    {!loading && paginatedData.length === 0 && (
                        <p className="text-gray-500">ไม่พบข้อมูล</p>
                    )}
                </div>
            </div>
        </div>
    );
}