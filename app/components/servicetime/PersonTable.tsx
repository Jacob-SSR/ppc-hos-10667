"use client";

import { useMemo, useState } from "react";
import { Download, Search, ClipboardList } from "lucide-react";
import { SectionCard } from "@/app/components/dashboard/live";
import { exportToExcel } from "@/lib/exportExcel";
import type { PersonVisit, StageColumn } from "@/lib/servicetime.types";
import { fmt, stageColor, toHM, toDMY } from "./helpers";

// ─── ตารางข้อมูลรายบุคคล (ตามตัวกรอง) ─────────────────────────────────────────
export function PersonTable({
    visits, columns, total, truncated,
}: { visits: PersonVisit[]; columns: StageColumn[]; total: number; truncated: boolean }) {
    const [q, setQ] = useState("");
    const [clinicFilter, setClinicFilter] = useState("all");

    const clinicOptions = useMemo(
        () => [...new Set(visits.map((v) => v.department))].sort((a, b) => a.localeCompare(b, "th")),
        [visits],
    );

    const filtered = useMemo(() => {
        const s = q.trim();
        return visits.filter((v) => {
            const matchQ = !s || v.vn.includes(s) || v.hn.includes(s);
            const matchClinic = clinicFilter === "all" || v.department === clinicFilter;
            return matchQ && matchClinic;
        });
    }, [visits, q, clinicFilter]);

    const exportPersons = () => {
        const data = filtered.map((v) => {
            const o: Record<string, unknown> = {
                VN: v.vn, HN: v.hn, วันที่: toDMY(v.date), คลินิก: v.department, มาถึง: toHM(v.arrivalMinute),
            };
            for (const c of columns) o[`${c.short} (นาที)`] = v.values[c.key] ?? "";
            o["รวม (นาที)"] = v.total ?? "";
            return o;
        });
        exportToExcel(data, {
            sheetName: "รายบุคคล",
            filePrefix: "servicetime_รายบุคคล",
            dateKeys: [],
        });
    };

    return (
        <SectionCard
            title="ข้อมูลรายบุคคล (ตามตัวกรอง วันที่ / เวร / คลินิก)"
            icon={ClipboardList} titleColor="#1a5233" className="mb-4"
        >
            <div className="flex flex-wrap items-center gap-2 -mt-1 mb-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="ค้นหา VN / HN"
                        className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
                    />
                </div>
                <select
                    value={clinicFilter}
                    onChange={(e) => setClinicFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 min-w-[140px]"
                    title="กรองคลินิก"
                >
                    <option value="all">ทุกคลินิก</option>
                    {clinicOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <button
                    onClick={exportPersons}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors"
                >
                    <Download size={13} /> โหลด Excel
                </button>
                <span className="text-xs text-gray-500">
                    {fmt(filtered.length)}{(q || clinicFilter !== "all") ? ` / ${fmt(visits.length)}` : ""} ราย
                    {truncated && <span className="text-amber-600"> · แสดง {fmt(visits.length)} จาก {fmt(total)} (ปรับตัวกรองให้แคบลงเพื่อดูครบ)</span>}
                </span>
            </div>

            <div className="overflow-auto max-h-[520px]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr className="text-gray-400 border-b-2 border-gray-100 text-left whitespace-nowrap">
                            <th className="py-2 pr-2 font-medium sticky left-0 bg-white z-20">VN</th>
                            <th className="py-2 px-2 font-medium">HN</th>
                            <th className="py-2 px-2 font-medium">วันที่</th>
                            <th className="py-2 px-2 font-medium">คลินิก</th>
                            <th className="py-2 px-2 font-medium text-right">มาถึง</th>
                            {columns.map((c) => (
                                <th key={c.key} className="py-2 px-2 font-medium text-right" title={c.label}>
                                    <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: stageColor(c.key) }} />
                                    {c.short}
                                </th>
                            ))}
                            <th className="py-2 pl-2 pr-3 font-medium text-right sticky right-0 bg-green-50 text-green-800 z-20 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((v) => (
                            <tr key={v.vn} className="border-b border-gray-50 hover:bg-gray-50/60">
                                <td className="py-1.5 pr-2 tabular-nums text-gray-700 sticky left-0 bg-white z-10">{v.vn}</td>
                                <td className="py-1.5 px-2 tabular-nums text-gray-500">{v.hn || "-"}</td>
                                <td className="py-1.5 px-2 tabular-nums text-gray-600">{toDMY(v.date)}</td>
                                <td className="py-1.5 px-2 text-gray-600 truncate max-w-[130px]" title={v.department}>{v.department}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-gray-500">{toHM(v.arrivalMinute)}</td>
                                {columns.map((c) => (
                                    <td key={c.key} className="py-1.5 px-2 text-right tabular-nums text-gray-700">
                                        {v.values[c.key] == null ? "–" : Math.round(v.values[c.key]!)}
                                    </td>
                                ))}
                                <td className="py-1.5 pl-2 pr-3 text-right tabular-nums font-bold text-green-800 sticky right-0 bg-green-50 z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                                    {v.total == null ? "–" : Math.round(v.total)}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={columns.length + 6} className="py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}