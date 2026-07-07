"use client";

import type { StageStat } from "@/lib/servicetime.types";
import { fmt, mins, timeColor } from "./helpers";

// ─── แถวขั้นตอน (stage) ───────────────────────────────────────────────────────
export function StageRow({ s }: { s: StageStat }) {
    const { accent } = timeColor(s.stat.avg, s.target);
    const target = s.target;
    // ความยาวแท่ง = avg เทียบกับ max(target*2, avg)
    const scale = target ? Math.max(target * 2, s.stat.avg ?? 0) : (s.stat.max ?? s.stat.avg ?? 1);
    const barPct = s.stat.avg != null && scale ? Math.min((s.stat.avg / scale) * 100, 100) : 0;
    const targetPct = target && scale ? Math.min((target / scale) * 100, 100) : null;

    return (
        <div className="py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-700">{s.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
                    {mins(s.stat.avg)}
                    <span className="text-[11px] font-normal text-gray-400"> (มัธยฐาน {mins(s.stat.median)})</span>
                </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: accent }} />
                {targetPct != null && (
                    <div
                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-gray-500"
                        style={{ left: `${targetPct}%` }}
                        title={`เป้า ≤ ${target} นาที`}
                    />
                )}
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                <span>P90 {mins(s.stat.p90)} · n={fmt(s.stat.count)}</span>
                {s.withinTargetPct != null && (
                    <span style={{ color: accent }}>ผ่านเกณฑ์ {s.withinTargetPct}%</span>
                )}
            </div>
        </div>
    );
}