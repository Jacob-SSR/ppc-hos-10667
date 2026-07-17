"use client";

// ── บันทึกการแก้ไขปัญหา (อาการ → สาเหตุ → การแก้ไข) ──
// ดึงจากส่วนแจ้งซ่อมของฟอร์ม ใช้เป็นคลังความรู้วิธีแก้ของทีมไอที
// ค้นหาได้ทุกช่อง + แสดงทีละหน้า กันตารางยาวเกิน

import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import { fmtShort } from "@/lib/worklog.utils";

const HEAD_BG = "#236b43";
const HEAD_BORDER = "#1a5233";
const STRIPE = "#f0faf4";
const PAGE_SIZE = 10;

export interface SolutionLog {
    date: string;
    staff: string;
    mainTask: string;
    symptom: string;
    cause: string;
    solution: string;
    incidentPoint: string;
    solver: string;
}

function Th({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
    return (
        <th
            className={`text-white px-2 md:px-3 py-2 text-left font-semibold whitespace-nowrap ${last ? "" : "border-r"}`}
            style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
        >
            {children}
        </th>
    );
}

export function SolutionLogSection({ logs }: { logs: SolutionLog[] }) {
    const [query, setQuery] = useState("");
    const [shown, setShown] = useState(PAGE_SIZE);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter((l) =>
            [l.symptom, l.cause, l.solution, l.incidentPoint, l.mainTask, l.staff, l.solver]
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [logs, query]);

    const visible = filtered.slice(0, shown);

    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl p-3 md:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-[#236b43]" />
                    <h4 className="text-sm font-bold text-gray-700">
                        บันทึกการแก้ไขปัญหา (อาการ – สาเหตุ – การแก้ไข)
                    </h4>
                </div>
                <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                    style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
                >
                    {filtered.length.toLocaleString()} รายการ
                </span>
            </div>

            {/* ค้นหา */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShown(PAGE_SIZE); // เริ่มหน้าแรกใหม่เมื่อค้นหา
                    }}
                    placeholder="ค้นหาอาการ สาเหตุ วิธีแก้ จุดเกิดเหตุ..."
                    className="w-full text-xs rounded-xl border border-[#d6f0e0] pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#a8d5ba]"
                />
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#d6f0e0]">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr>
                            <Th>วันที่</Th>
                            <Th>งานหลัก</Th>
                            <Th>อาการ</Th>
                            <Th>สาเหตุ</Th>
                            <Th>การแก้ไข</Th>
                            <Th>จุดเกิดเหตุ</Th>
                            <Th last>ผู้แก้ไข</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((l, i) => (
                            <tr
                                key={`${l.date}-${i}`}
                                className="border-b border-[#e8f5ee] last:border-b-0 align-top"
                                style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : STRIPE }}
                            >
                                <td className="px-2 md:px-3 py-2 whitespace-nowrap text-gray-500 tabular-nums">
                                    {fmtShort(l.date)}
                                </td>
                                <td className="px-2 md:px-3 py-2 whitespace-nowrap text-gray-600">
                                    {l.mainTask || "—"}
                                </td>
                                <td className="px-2 md:px-3 py-2 text-gray-700 min-w-[140px] max-w-[240px]">
                                    {l.symptom || "—"}
                                </td>
                                <td className="px-2 md:px-3 py-2 text-gray-600 min-w-[120px] max-w-[220px]">
                                    {l.cause || "—"}
                                </td>
                                <td className="px-2 md:px-3 py-2 font-medium text-[#1a5233] min-w-[140px] max-w-[260px]">
                                    {l.solution}
                                </td>
                                <td className="px-2 md:px-3 py-2 whitespace-nowrap text-gray-500">
                                    {l.incidentPoint || "—"}
                                </td>
                                <td className="px-2 md:px-3 py-2 whitespace-nowrap text-gray-600">
                                    {l.solver || l.staff || "—"}
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-3 py-4 text-center text-gray-400">
                                    {query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีบันทึกการแก้ไขในช่วงเวลานี้"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {shown < filtered.length && (
                <div className="text-center">
                    <button
                        onClick={() => setShown((s) => s + PAGE_SIZE)}
                        className="text-xs font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-[#f0faf4]"
                        style={{ borderColor: "#a8d5ba", color: "#1a5233" }}
                    >
                        แสดงเพิ่ม ({filtered.length - shown} รายการที่เหลือ)
                    </button>
                </div>
            )}
        </div>
    );
}