"use client";

import { useState } from "react";
import {
    Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart,
} from "recharts";
import type { WaitBucketRow } from "@/lib/servicetime.types";
import { fmt, tip, stageColor, stageShort, BUCKET_COLORS, C } from "./helpers";

// ─── กราฟจำนวนคนตามช่วงเวลารอของแต่ละขั้นตอน (แท่งซ้อนแนวนอน) ───────────────────
export function WaitBucketChart({ rows }: { rows: WaitBucketRow[] }) {
    const [visible, setVisible] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(rows.map((r) => [r.key, true])),
    );
    const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));
    const shown = rows.filter((r) => visible[r.key]);
    const bucketLabels = rows[0]?.buckets.map((b) => b.label) ?? [];
    const data = shown.map((r) => {
        const o: Record<string, string | number> = { name: `${rows.findIndex((x) => x.key === r.key) + 1}.${stageShort(r.key, r.label)}` };
        r.buckets.forEach((b) => { o[b.label] = b.count; });
        return o;
    });
    const h = Math.max(220, data.length * 34 + 50);
    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2 text-[11px]">
                {rows.map((r, i) => (
                    <button
                        key={r.key}
                        onClick={() => toggle(r.key)}
                        className={`inline-flex items-center gap-1.5 ${visible[r.key] ? "text-gray-600 font-medium" : "text-gray-300"}`}
                        title="คลิกเพื่อเปิด/ปิดแถวนี้"
                    >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: visible[r.key] ? stageColor(r.key) : "#e5e7eb" }} />
                        {i + 1}.{stageShort(r.key, r.label)}
                    </button>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={h}>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [`${fmt(v as number)} คน`, n]} {...tip} />
                    {bucketLabels.map((label, i) => (
                        <Bar key={label} dataKey={label} stackId="wait" fill={BUCKET_COLORS[i] ?? C.gray} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
                {bucketLabels.map((label, i) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[i] ?? C.gray }} />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}