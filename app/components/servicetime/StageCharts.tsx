"use client";

import {
    Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Cell,
} from "recharts";
import type { DepartmentRow, StageStat } from "@/lib/servicetime.types";
import { tip, stageColor, stageShort } from "./helpers";

// ─── กราฟองค์ประกอบเวลา แยกรายขั้นตอน (stacked) ต่อคลินิก ─────────────────────
export function ClinicStackChart({ rows, stages }: { rows: DepartmentRow[]; stages: StageStat[] }) {
    const top = rows.slice(0, 12);
    const data = top.map((r) => {
        const o: Record<string, string | number> = { department: r.department };
        for (const s of stages) o[s.key] = r.stages.find((x) => x.key === s.key)?.avg ?? 0;
        return o;
    });
    const h = Math.max(220, top.length * 30 + 60);
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit=" นาที" />
                <YAxis
                    type="category" dataKey="department" width={110}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
                />
                <Tooltip
                    formatter={(v, n) => [`${v} นาที`, stageShort(String(n), String(n))]}
                    {...tip}
                />
                {stages.map((s) => (
                    <Bar key={s.key} dataKey={s.key} stackId="a" fill={stageColor(s.key)} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── กราฟเวลาเฉลี่ยแต่ละขั้นตอน (แนวนอน) ──────────────────────────────────────
export function StageAvgBarChart({ stages }: { stages: StageStat[] }) {
    const data = stages.map((s, i) => ({
        idx: i + 1,
        name: `${i + 1}.${stageShort(s.key, s.label)}`,
        key: s.key,
        avg: s.stat.avg ?? 0,
    }));
    const h = Math.max(220, data.length * 34 + 40);
    return (
        <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} นาที`, "เฉลี่ย"]} {...tip} />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {data.map((d) => <Cell key={d.key} fill={stageColor(d.key)} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}