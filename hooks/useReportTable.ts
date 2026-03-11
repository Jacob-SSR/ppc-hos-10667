import { useState, useMemo } from "react";
import { formatDate } from "@/lib/dateUtils";
import { UseReportTableOptions } from "@/types/allTypes";
import toast from "react-hot-toast";

const PAGE_SIZE = 50;

export function useReportTable<T = any>({ apiPath, columnFilterKeys = [] }: UseReportTableOptions) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [start, setStart] = useState<Date | null>(new Date(2026, 0, 1));
    const [end, setEnd] = useState<Date | null>(new Date());
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);
    const [columnFilters, setColumnFiltersState] = useState<Record<string, string>>({});

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
            setColumnFiltersState({});
            toast.success("โหลดข้อมูลสำเร็จ");
        } catch {
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // ── Unique options for each specified filter key ────────────────────────────
    const columnFilterOptions = useMemo(() => {
        if (!data.length || !columnFilterKeys.length) return {} as Record<string, string[]>;
        const result: Record<string, string[]> = {};
        for (const key of columnFilterKeys) {
            result[key] = Array.from(
                new Set((data as any[]).map((row) => String(row[key] ?? "")))
            )
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, "th"));
        }
        return result;
    }, [data, columnFilterKeys.join(",")]);

    // ── Global search ──────────────────────────────────────────────────────────
    const searchFiltered = useMemo(
        () =>
            data.filter((row) =>
                Object.values(row as any).some((val) =>
                    String(val).toLowerCase().includes(search.toLowerCase())
                )
            ),
        [data, search]
    );

    // ── Column filters ─────────────────────────────────────────────────────────
    const filteredData = useMemo(
        () =>
            searchFiltered.filter((row) =>
                Object.entries(columnFilters).every(([key, val]) =>
                    !val ? true : String((row as any)[key] ?? "") === val
                )
            ),
        [searchFiltered, columnFilters]
    );

    // ── Sort ───────────────────────────────────────────────────────────────────
    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData;
        return [...filteredData].sort((a: any, b: any) =>
            sortAsc
                ? String(a[sortKey]).localeCompare(String(b[sortKey]), "th")
                : String(b[sortKey]).localeCompare(String(a[sortKey]), "th")
        );
    }, [filteredData, sortKey, sortAsc]);

    // ── Pagination ─────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
    const paginatedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc((p) => !p);
        else { setSortKey(key); setSortAsc(true); }
    };

    const handleSearch = (val: string) => { setSearch(val); setPage(1); };

    const setColumnFilter = (key: string, val: string) => {
        setColumnFiltersState((prev) => ({ ...prev, [key]: val }));
        setPage(1);
    };

    const clearAllFilters = () => {
        setColumnFiltersState({});
        setSearch("");
        setPage(1);
    };

    const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

    return {
        data, loading,
        start, setStart, end, setEnd,
        search, handleSearch,
        sortKey, sortAsc,
        page, setPage,
        columnFilters, columnFilterOptions,
        setColumnFilter, clearAllFilters,
        activeFilterCount,
        sortedData, paginatedData, totalPages,
        fetchData, handleSort,
    };
}