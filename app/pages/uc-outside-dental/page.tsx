"use client";

import { useState, useMemo, forwardRef } from "react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";

const PAGE_SIZE = 50;

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
                `/api/uc-outside-dental?start=${formatDate(
                    start
                )}&end=${formatDate(end)}`
            );
            const json = await res.json();
            setData(json || []);
            setPage(1);
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch (err) {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        }
        setLoading(false);
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
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            return sortAsc
                ? String(aVal).localeCompare(String(bVal), "th")
                : String(bVal).localeCompare(String(aVal), "th");
        });
    }, [filteredData, sortKey, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
    const paginatedData = sortedData.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const handleExport = () => {
        if (sortedData.length === 0) {
            toast.error("ไม่มีข้อมูลสำหรับ export");
            return;
        }

        const cleanedData = sortedData.map((row) => {
            const newRow: any = {};
            Object.entries(row).forEach(([key, val]) => {
                newRow[key] =
                    key === "vstdate" ? formatThaiDate(val) : val ?? "";
            });
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(cleanedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
        });

        const file = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });

        const nowTH = new Date().toLocaleString("sv-SE", {
            timeZone: "Asia/Bangkok",
        }).replace(" ", "_");
        saveAs(file, `uc-outside-dental_${nowTH}.xlsx`);
    };

    return (
        <div className="space-y-6 text-gray-800">
            <Toaster position="top-center" />

            {/* FILTER BAR */}
            <div className="bg-white border-2 border-gray-300 rounded-2xl shadow-sm px-6 py-6 flex flex-wrap items-end gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-2">
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
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-2">
                        ค้นหา
                    </label>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="border-2 border-gray-300 px-5 py-2 rounded-full w-72 text-sm bg-white focus:outline-none focus:border-green-800 shadow-sm"
                    />
                </div>

                <div className="flex gap-3 ml-auto">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-green-800 hover:bg-green-900 text-white text-sm font-semibold px-7 py-2 rounded-lg shadow transition disabled:opacity-50"
                    >
                        {loading ? "กำลังโหลด..." : "Search"}
                    </button>

                    {data.length > 0 && (
                        <button
                            onClick={handleExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-7 py-2 rounded-lg shadow transition"
                        >
                            Export Excel
                        </button>
                    )}
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm px-6 py-6">
                {loading && (
                    <div className="py-20 text-center text-gray-600">
                        กำลังโหลดข้อมูล...
                    </div>
                )}

                {!loading && sortedData.length === 0 && (
                    <div className="flex items-center justify-center py-20 text-gray-600 font-medium">
                        ไม่พบข้อมูล กรุณาเลือกช่วงวันที่แล้วกด Search
                    </div>
                )}

                {!loading && sortedData.length > 0 && (
                    <>
                        <div className="mb-4 text-sm font-semibold text-gray-700">
                            พบทั้งหมด{" "}
                            <span className="text-green-800">
                                {sortedData.length}
                            </span>{" "}
                            รายการ
                        </div>

                        <div className="overflow-auto max-h-[520px] border border-gray-200 rounded-lg">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        {Object.keys(paginatedData[0]).map((key) => (
                                            <th
                                                key={key}
                                                onClick={() => handleSort(key)}
                                                className="sticky top-0 bg-green-800 text-white px-4 py-3 text-left cursor-pointer whitespace-nowrap border-r"
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
                                        <tr
                                            key={i}
                                            className={`border-b hover:bg-green-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                                }`}
                                        >
                                            {Object.entries(row as Record<string, any>).map(
                                                ([key, val], idx) => (
                                                    <td
                                                        key={idx}
                                                        className="px-4 py-2 whitespace-nowrap border-r"
                                                    >
                                                        {key === "vstdate"
                                                            ? formatThaiDate(val)
                                                            : String(val ?? "")}
                                                    </td>
                                                )
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* PAGINATION */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t-2 border-gray-200">
                            <p className="text-sm font-medium text-gray-700">
                                หน้า {page} / {totalPages}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                    disabled={page === 1}
                                    className="px-5 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
                                >
                                    ก่อนหน้า
                                </button>

                                <span className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-800 min-w-[3rem] text-center">
                                    {page}
                                </span>

                                <button
                                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                    disabled={page === totalPages}
                                    className="px-5 py-2 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}