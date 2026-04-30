// app/pages/it-worklog/components/WorklogCharts.tsx
// แยก chart section ออกจาก it-worklog/page.tsx
// ครอบคลุม: Daily/Monthly bar chart + Area chart

"use client";

import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BarDataRow {
    label: string;
    [key: string]: string | number;
}

interface AreaDataRow {
    label: string;
    avg: number;
}

interface TooltipPayloadItem {
    value?: number;
    name?: string;
    fill?: string;
    stroke?: string;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-xs">
            <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
            {payload.filter((p) => (p.value ?? 0) > 0).map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.fill ?? p.stroke }} />
                    <span className="text-gray-600">{p.name}</span>
                    <span className="font-bold text-gray-900 ml-auto pl-3">{p.value}</span>
                </div>
            ))}
        </div>
    );
}

// ── DailyBarChart ─────────────────────────────────────────────────────────────

const MINT_500 = "#3aa36a";

interface DailyBarChartProps {
    data: BarDataRow[];
    usedShorts: string[];
    shortColor: Record<string, string>;
    viewMode: "day" | "month";
}

export function DailyBarChart({ data, usedShorts, shortColor, viewMode }: DailyBarChartProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-4">
                จำนวนงาน{viewMode === "day" ? "แต่ละวัน" : "แต่ละเดือน"} แยกตามประเภท
            </h4>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    {usedShorts.map((short, i) => (
                        <Bar
                            key={short}
                            dataKey={short}
                            stackId="a"
                            fill={shortColor[short] ?? "#94a3b8"}
                            radius={i === usedShorts.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {usedShorts.map((s) => (
                    <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
                        style={{ background: shortColor[s] ?? "#94a3b8" }}
                    >
                        {s}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ── AvgDurationChart ──────────────────────────────────────────────────────────

interface AvgDurationChartProps {
    data: AreaDataRow[];
    avgMin: number;
}

export function AvgDurationChart({ data, avgMin }: AvgDurationChartProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-4">
                ระยะเวลาเฉลี่ยต่องาน (นาที)
            </h4>
            {data.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-300">
                    ไม่มีข้อมูลระยะเวลา
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                        <div className="w-2 h-2 rounded-full" style={{ background: MINT_500 }} />
                        เฉลี่ยทุกงาน: <strong className="text-gray-700">{avgMin} นาที</strong>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={data} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="mintGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#55b882" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#55b882" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                            <Tooltip
                                formatter={(v: number | undefined) => [`${v ?? 0} นาที`, "เฉลี่ย"]}
                                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Area type="monotone" dataKey="avg" stroke={MINT_500} strokeWidth={2.5} fill="url(#mintGrad)" dot={false} activeDot={{ r: 4, fill: MINT_500 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
}

// ── StaffUrgencySection ───────────────────────────────────────────────────────

interface StaffLoadItem { name: string; count: number; color: string; }

interface StaffUrgencySectionProps {
    staffLoad: StaffLoadItem[];
    totalJobs: number;
    urgentCount: number;
    devCount: number;
}

export function StaffUrgencySection({
    staffLoad, totalJobs, urgentCount, devCount,
}: StaffUrgencySectionProps) {
    const MINT_50 = "#f0faf4";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Staff load */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-base font-bold text-[#717171] mb-4">ปริมาณงานต่อเจ้าหน้าที่</h4>
                <div className="space-y-4">
                    {staffLoad.map((s, i) => {
                        const pct = staffLoad[0].count > 0 ? (s.count / staffLoad[0].count) * 100 : 0;
                        return (
                            <div key={s.name}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                                        <span className="font-medium text-gray-700 truncate">{s.name}</span>
                                    </div>
                                    <span className="font-bold text-gray-900 tabular-nums">{s.count} งาน</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: MINT_50 }}>
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ background: s.color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Urgency + dev type */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-base font-bold text-[#717171] mb-4">ระดับความเร่งด่วน</h4>
                <div className="space-y-4 pt-2">
                    {[
                        { label: "เร่งด่วน", count: urgentCount, color: "#ef4444" },
                        { label: "ไม่เร่งด่วน", count: totalJobs - urgentCount, color: MINT_500 },
                    ].map((u) => {
                        const pct = totalJobs > 0 ? (u.count / totalJobs) * 100 : 0;
                        return (
                            <div key={u.label}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: u.color }} />
                                        <span className="font-medium text-gray-700">{u.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">{u.count.toLocaleString()}</span>
                                        <span className="text-xs text-gray-400">({Math.round(pct)}%)</span>
                                    </div>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                                    <motion.div className="h-full rounded-full" style={{ background: u.color }}
                                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.7, ease: "easeOut" }} />
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">ประเภทการดำเนินงาน</p>
                        {[
                            { label: "งานพัฒนา", count: devCount, color: "#8b5cf6" },
                            { label: "งานประจำ / บริการ", count: totalJobs - devCount, color: MINT_500 },
                        ].map((u) => {
                            const pct = totalJobs > 0 ? (u.count / totalJobs) * 100 : 0;
                            return (
                                <div key={u.label} className="mb-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">{u.label}</span>
                                        <span className="font-bold text-gray-900">
                                            {u.count.toLocaleString()}{" "}
                                            <span className="text-xs text-gray-400">({Math.round(pct)}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                                        <motion.div className="h-full rounded-full" style={{ background: u.color }}
                                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.6, ease: "easeOut" }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}