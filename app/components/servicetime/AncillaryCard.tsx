"use client";

import { SectionCard } from "@/app/components/dashboard/live";
import type { AncillaryStat } from "@/lib/servicetime.types";
import { fmt, mins, pctColor } from "./helpers";

// ─── การ์ด Lab / X-ray ───────────────────────────────────────────────────────
export function AncillaryCard({
    title, icon, data,
}: { title: string; icon: React.ElementType; data: AncillaryStat }) {
    const { accent } = pctColor(data.withinTargetPct);
    return (
        <SectionCard title={title} icon={icon} titleColor="#1a5233">
            <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                    { label: "รอ (สั่ง→รับ/ตรวจ)", v: data.wait.avg },
                    { label: "ดำเนินการ", v: data.process.avg },
                    { label: "รวม (สั่ง→ผล)", v: data.total.avg },
                ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-lg font-extrabold text-gray-800 tabular-nums">{mins(x.v)}</p>
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{x.label}</p>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">visit ที่มีรายการ: {fmt(data.itemVisits)}</span>
                {data.withinTargetPct != null && (
                    <span className="font-bold" style={{ color: accent }}>
                        ≤ {data.target} นาที = {data.withinTargetPct}%
                    </span>
                )}
            </div>
        </SectionCard>
    );
}