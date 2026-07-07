"use client";

import type { DepartmentRow, StageColumn } from "@/lib/servicetime.types";
import { fmt, mins, pctColor, timeColor, stageColor, stageShort } from "./helpers";

// ─── ตารางแยกรายคลินิก × รายขั้นตอน ───────────────────────────────────────────
export function ClinicStageTable({
    rows, stages, totalTarget, pctGoal, selected, onSelect,
}: {
    rows: DepartmentRow[]; stages: StageColumn[]; totalTarget: number | null;
    pctGoal: number; selected: string; onSelect: (clinic: string) => void;
}) {
    const cellOf = (r: DepartmentRow, key: string) =>
        r.stages.find((s) => s.key === key)?.avg ?? null;

    return (
        <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white">
                    <tr className="text-gray-400 border-b-2 border-gray-100 text-left whitespace-nowrap">
                        <th className="py-2 pr-2 font-medium sticky left-0 bg-white">คลินิก</th>
                        <th className="py-2 px-2 font-medium text-right">visit</th>
                        {stages.map((s) => (
                            <th key={s.key} className="py-2 px-2 font-medium text-right" title={s.label}>
                                <span
                                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                                    style={{ backgroundColor: stageColor(s.key) }}
                                />
                                {stageShort(s.key, s.label)}
                            </th>
                        ))}
                        <th className="py-2 px-2 font-medium text-right">รวม (มัธยฐาน)</th>
                        <th className="py-2 px-2 font-medium text-right">≤ {totalTarget} นาที</th>
                        <th className="py-2 pl-2 font-medium">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const st = pctColor(r.withinTargetPct, pctGoal);
                        const label =
                            r.withinTargetPct == null ? "-"
                                : r.withinTargetPct >= pctGoal ? "ปกติ"
                                    : r.withinTargetPct >= pctGoal - 20 ? "เฝ้าระวัง"
                                        : "รอนาน";
                        const isSel = selected === r.department;
                        return (
                            <tr
                                key={r.department}
                                onClick={() => onSelect(isSel ? "all" : r.department)}
                                className={`border-b border-gray-50 cursor-pointer ${isSel ? "bg-green-50" : "hover:bg-gray-50/60"}`}
                                title={isSel ? "คลิกเพื่อยกเลิกตัวกรองคลินิก" : "คลิกเพื่อกรองเฉพาะคลินิกนี้"}
                            >
                                <td className={`py-1.5 pr-2 truncate max-w-[150px] sticky left-0 ${isSel ? "bg-green-50 font-semibold text-green-800" : "bg-white text-gray-700"}`} title={r.department}>
                                    {r.department}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{fmt(r.visits)}</td>
                                {stages.map((s) => {
                                    const v = cellOf(r, s.key);
                                    const isBottleneck = r.bottleneckKey === s.key;
                                    const { accent } = timeColor(v, s.target);
                                    return (
                                        <td
                                            key={s.key}
                                            className="py-1.5 px-2 text-right tabular-nums font-medium"
                                            style={{
                                                color: accent,
                                                backgroundColor: isBottleneck ? "#fdecec" : undefined,
                                                borderRadius: isBottleneck ? 6 : undefined,
                                            }}
                                            title={isBottleneck ? "จุดคอขวดของคลินิกนี้" : undefined}
                                        >
                                            {v == null ? "-" : v}
                                        </td>
                                    );
                                })}
                                <td className="py-1.5 px-2 text-right tabular-nums font-bold text-gray-800">{mins(r.medianTotal)}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums font-semibold" style={{ color: st.accent }}>
                                    {r.withinTargetPct == null ? "-" : `${r.withinTargetPct}%`}
                                </td>
                                <td className="py-1.5 pl-2">
                                    <span
                                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                        style={{ backgroundColor: st.accent }}
                                    >
                                        {label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}