"use client";

import { useState } from "react";
import {
    Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart,
} from "recharts";
import type { HourlyStagePoint, StageColumn } from "@/lib/servicetime.types";
import { tip, stageColor } from "./helpers";

// ─── กราฟจำนวนผู้ป่วยรายชั่วโมง แยกตามขั้นตอน (เส้น + toggle) ───────────────────
export function HourlyStageLineChart({ data, stages }: { data: HourlyStagePoint[]; stages: StageColumn[] }) {
    const [visible, setVisible] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(stages.map((s) => [s.key, true])),
    );
    const allOn = stages.every((s) => visible[s.key]);
    const allOff = stages.every((s) => !visible[s.key]);
    const setAll = (v: boolean) => setVisible(Object.fromEntries(stages.map((s) => [s.key, v])));
    const toggle = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));

    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2 text-[11px]">
                <button
                    onClick={() => setAll(true)}
                    className={`inline-flex items-center gap-1 font-semibold ${allOn ? "text-green-700" : "text-gray-400 hover:text-gray-600"}`}
                >
                    ✓ ทั้งหมด
                </button>
                <button
                    onClick={() => setAll(false)}
                    className={`inline-flex items-center gap-1 font-semibold ${allOff ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}
                >
                    ✕ ซ่อนทั้งหมด
                </button>
                {stages.map((s, i) => (
                    <button
                        key={s.key}
                        onClick={() => toggle(s.key)}
                        className={`inline-flex items-center gap-1.5 ${visible[s.key] ? "text-gray-600" : "text-gray-300"}`}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: visible[s.key] ? stageColor(s.key) : "#e5e7eb" }}
                        />
                        {i + 1}.{s.short}
                    </button>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(h) => `${h}:00 นาที`} {...tip} />
                    {stages.filter((s) => visible[s.key]).map((s) => (
                        <Line
                            key={s.key} type="monotone" dataKey={s.key} name={s.short}
                            stroke={stageColor(s.key)} strokeWidth={2} dot={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}