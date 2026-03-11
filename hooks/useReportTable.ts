// hooks/useReportTable.ts
// ใช้ร่วมกันทุกหน้า: report, no-endpoint, uc-outside-dental, uc-outside
// รวม logic: fetch, filter, sort, paginate ไว้ที่เดียว

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/dateUtils";
import toast from "react-hot-toast";

const PAGE_SIZE = 50;

interface UseReportTableOptions {
    /** path ของ API เช่น "/api/report" */
    apiPath: string;
}

export function useReportTable<T = any>({ apiPath }: UseReportTableOptions) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [start, setStart] = useState<Date | null>(new Date(2026, 0, 1));
    const [end, setEnd] = useState<Date | null>(new Date());
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchData = async () => {
        if (!start || !end) return alert("กรุณาเลือกวันที่");
        setLoading(true);
        try {
            const res = await fetch(
                `${apiPath}?start=${formatDate(start)}&end=${formatDate(end)}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
            setPage(1);
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // ── Filter ─────────────────────────────────────────────────────────────────
    const filteredData = useMemo(
        () =>
            data.filter((row) =>
                Object.values(row as any).some((val) =>
                    String(val).toLowerCase().includes(search.toLowerCase())
                )
            ),
        [data, search]
    );

    // ── Sort ───────────────────────────────────────────────────────────────────
    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData;
        return [...filteredData].sort((a: any, b: any) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            return sortAsc
                ? String(aVal).localeCompare(String(bVal), "th")
                : String(bVal).localeCompare(String(aVal), "th");
        });
    }, [filteredData, sortKey, sortAsc]);

    // ── Pagination ─────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
    const paginatedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc((prev) => !prev);
        else { setSortKey(key); setSortAsc(true); }
    };

    const handleSearch = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    return {
        // state
        data,
        loading,
        start, setStart,
        end, setEnd,
        search, handleSearch,
        sortKey, sortAsc,
        page, setPage,
        // derived
        sortedData,
        paginatedData,
        totalPages,
        // actions
        fetchData,
        handleSort,
    };
}