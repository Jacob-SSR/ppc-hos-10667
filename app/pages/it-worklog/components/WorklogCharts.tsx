// app/pages/it-worklog/components/WorklogCharts.tsx
// แยก chart section ออกจาก it-worklog/page.tsx
// ครอบคลุม: Daily/Monthly bar chart + Area chart

"use client";

import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, AreaChart, Area,
    PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { STAFF_COLORS, taskColor, taskShort } from "@/lib/worklog.constants";
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

// ── StaffLoadSection ──────────────────────────────────────────────────────────

interface StaffLoadItem { name: string; count: number; color: string; }

export function StaffLoadSection({ staffLoad }: { staffLoad: StaffLoadItem[] }) {
    const MINT_50 = "#f0faf4";
    return (
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
    );
}

// ── StatusDonutSection ────────────────────────────────────────────────────────
// Donut 3 วง: ระดับความเร่งด่วน / ความทันเวลา / ประเภทการดำเนินงาน
// แสดงร้อยละของค่าหลักตรงกลางวง + legend จำนวนและ % ของแต่ละกลุ่ม

interface DonutItem { label: string; count: number; color: string; }

function DonutCard({ title, items, delay = 0 }: {
    title: string;
    items: DonutItem[];
    delay?: number;
}) {
    const total = items.reduce((s, it) => s + it.count, 0);
    const primary = items[0];
    const primaryPct = total > 0 ? Math.round((primary.count / total) * 100) : 0;
    const data = items.filter((it) => it.count > 0);

    return (
        <motion.div
            className="bg-white border border-gray-200 rounded-lg p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4, ease: "easeOut" }}
        >
            <h4 className="text-base font-bold text-[#717171] mb-1">{title}</h4>
            <div className="relative">
                <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                        <Pie
                            data={data} cx="50%" cy="50%"
                            innerRadius={58} outerRadius={80}
                            dataKey="count" nameKey="label"
                            paddingAngle={data.length > 1 ? 2 : 0}
                            startAngle={90} endAngle={-270}
                        >
                            {data.map((e, i) => (
                                <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(v: number | undefined, name) => [
                                `${(v ?? 0).toLocaleString()} งาน (${total > 0 ? Math.round(((v ?? 0) / total) * 100) : 0}%)`,
                                name,
                            ]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* ตัวเลขร้อยละตรงกลางวง */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: primary.color }}>
                        {primaryPct}%
                    </span>
                    <span className="text-[11px] text-gray-500">{primary.label}</span>
                </div>
            </div>
            {/* Legend */}
            <div className="mt-3 space-y-1.5">
                {items.map((it) => {
                    const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
                    return (
                        <div key={it.label} className="flex items-center gap-2 text-sm">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} />
                            <span className="text-gray-600 truncate flex-1">{it.label}</span>
                            <span className="font-bold text-gray-900 tabular-nums">{it.count.toLocaleString()}</span>
                            <span className="text-xs text-gray-400 tabular-nums w-12 text-right">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

interface StatusDonutSectionProps {
    totalJobs: number;
    urgentCount: number;
    onTimeCount: number;
    devCount: number;
}

export function StatusDonutSection({
    totalJobs, urgentCount, onTimeCount, devCount,
}: StatusDonutSectionProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DonutCard
                title="ระดับความเร่งด่วน"
                delay={0}
                items={[
                    { label: "เร่งด่วน", count: urgentCount, color: "#ef4444" },
                    { label: "ไม่เร่งด่วน", count: totalJobs - urgentCount, color: MINT_500 },
                ]}
            />
            <DonutCard
                title="ความทันเวลา"
                delay={0.08}
                items={[
                    { label: "ทันเวลา", count: onTimeCount, color: "#14b8a6" },
                    { label: "ไม่ทันเวลา", count: totalJobs - onTimeCount, color: "#f59e0b" },
                ]}
            />
            <DonutCard
                title="ประเภทการดำเนินงาน"
                delay={0.16}
                items={[
                    { label: "งานพัฒนา", count: devCount, color: "#8b5cf6" },
                    { label: "งานประจำ / บริการ", count: totalJobs - devCount, color: MINT_500 },
                ]}
            />
        </div>
    );
}

// ── StatusTrendChart ──────────────────────────────────────────────────────────
// กราฟแนวโน้มร้อยละต่อช่วงเวลา: เร่งด่วน / ทันเวลา / งานพัฒนา
// สไตล์เดียวกับ AvgDurationChart (area + gradient)

interface StatusTrendRow {
    label: string;
    เร่งด่วน: number;
    ทันเวลา: number;
    งานพัฒนา: number;
}

const TREND_SERIES = [
    { key: "ทันเวลา", color: "#14b8a6", gradId: "trendOnTime" },
    { key: "เร่งด่วน", color: "#ef4444", gradId: "trendUrgent" },
    { key: "งานพัฒนา", color: "#8b5cf6", gradId: "trendDev" },
] as const;

export function StatusTrendChart({ data, viewMode }: {
    data: StatusTrendRow[];
    viewMode: "day" | "month";
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-4">
                แนวโน้มร้อยละ{viewMode === "day" ? "รายวัน" : "รายเดือน"} — เร่งด่วน / ทันเวลา / งานพัฒนา (%)
            </h4>
            {data.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-300">
                    ไม่มีข้อมูล
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={data} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                            <defs>
                                {TREND_SERIES.map((s) => (
                                    <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={s.color} stopOpacity={0.18} />
                                        <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                                tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                                tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                                formatter={(v: number | undefined, name) => [`${v ?? 0}%`, name]}
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            {TREND_SERIES.map((s) => (
                                <Area
                                    key={s.key}
                                    type="monotone"
                                    dataKey={s.key}
                                    stroke={s.color}
                                    strokeWidth={2.5}
                                    fill={`url(#${s.gradId})`}
                                    dot={false}
                                    activeDot={{ r: 4, fill: s.color }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        {TREND_SERIES.map((s) => (
                            <span
                                key={s.key}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
                                style={{ background: s.color }}
                            >
                                {s.key} (%)
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── StaffTimelinessChart ──────────────────────────────────────────────────────
// กราฟเส้นเปรียบเทียบจำนวนงาน "ทันเวลา" ของแต่ละเจ้าหน้าที่ ตามช่วงเวลา
// แสดงตัวเลขกำกับที่จุดข้อมูลแต่ละจุด

interface StaffTimelinessChartProps {
    staffs: string[];
    rows: Array<{ label: string;[staff: string]: string | number }>;
    viewMode: "day" | "month";
}

export function StaffTimelinessChart({ staffs, rows, viewMode }: StaffTimelinessChartProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-bold text-[#717171] mb-4">
                ความทันเวลา — จำนวนงานทันเวลาต่อเจ้าหน้าที่ ({viewMode === "day" ? "รายวัน" : "รายเดือน"})
            </h4>
            {rows.length === 0 || staffs.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-300">
                    ไม่มีข้อมูลความทันเวลา
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={rows} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                            <Tooltip
                                formatter={(v: number | undefined, name) => [`${v ?? 0} งาน`, name]}
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            {staffs.map((s) => {
                                const color = STAFF_COLORS[s] ?? "#7ec8a0";
                                return (
                                    <Line
                                        key={s}
                                        type="monotone"
                                        dataKey={s}
                                        stroke={color}
                                        strokeWidth={2.5}
                                        dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: color }}
                                        label={{ position: "top", fontSize: 10, fill: color, fontWeight: 700 }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        {staffs.map((s) => (
                            <span
                                key={s}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
                                style={{ background: STAFF_COLORS[s] ?? "#7ec8a0" }}
                            >
                                {s}
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── GroupTimelinessSection ────────────────────────────────────────────────────
// ความทันเวลาแยกกลุ่ม Software / Hardware
// ต่อกลุ่ม: กราฟเส้น ทันเวลา vs ไม่ทันเวลา + สถิติ (จำนวน/ร้อยละ, เฉลี่ย/น้อยสุด/มากสุด นาที)

interface GroupTimelinessItem {
    group: string;
    rows: Array<{ label: string; ทันเวลา: number; ไม่ทันเวลา: number }>;
    total: number;
    onTime: number;
    late: number;
    avgMin: number;
    minMin: number;
    maxMin: number;
    onTimeShare: Array<{ name: string; value: number }>;
    lateShare: Array<{ name: string; value: number }>;
}

const GROUP_META: Record<string, { title: string; sub: string }> = {
    Software: { title: "Software", sub: "ระบบ / โปรแกรม" },
    Hardware: { title: "Hardware", sub: "คอมพิวเตอร์ / อุปกรณ์ / Network" },
};

const ON_TIME_COLOR = "#2563eb";
const LATE_COLOR = "#f59e0b";

const DEPT_PALETTE = [
    "#ec4899", "#0ea5e9", "#2563eb", "#64748b", "#ef4444",
    "#14b8a6", "#f59e0b", "#8b5cf6", "#475569", "#f97316",
    "#3aa36a", "#a855f7",
];

// โดนัทสัดส่วนหมวดย่อยของงาน ทันเวลา / ไม่ทันเวลา
function ShareDonut({ title, items, total, accent }: {
    title: string;
    items: Array<{ name: string; value: number }>;
    total: number;
    accent: string;
}) {
    if (total === 0 || items.length === 0) {
        return (
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    สัดส่วนงาน{title}
                </p>
                <div className="h-28 flex items-center justify-center text-sm text-gray-300">
                    ไม่มีงาน{title}
                </div>
            </div>
        );
    }
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                สัดส่วนงาน{title}
            </p>
            <div className="relative">
                <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                        <Pie data={items} cx="50%" cy="50%"
                            innerRadius={40} outerRadius={62}
                            dataKey="value" nameKey="name"
                            paddingAngle={items.length > 1 ? 1 : 0}
                            startAngle={90} endAngle={-270}>
                            {items.map((_, i) => (
                                <Cell key={i} fill={DEPT_PALETTE[i % DEPT_PALETTE.length]} stroke="#fff" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(v: number | undefined, name) => [
                                `${(v ?? 0).toLocaleString()} งาน (${total > 0 ? Math.round(((v ?? 0) / total) * 1000) / 10 : 0}%)`,
                                name,
                            ]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-bold" style={{ color: accent }}>{title}</span>
                    <span className="text-sm font-bold text-gray-800 tabular-nums">{total.toLocaleString()}</span>
                </div>
            </div>
            <div className="mt-2 space-y-1">
                {items.map((it, i) => {
                    const pct = total > 0 ? Math.round((it.value / total) * 1000) / 10 : 0;
                    return (
                        <div key={it.name} className="flex items-center gap-1.5 min-w-0 text-[11px]">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ background: DEPT_PALETTE[i % DEPT_PALETTE.length] }} />
                            <span className="text-gray-600 truncate flex-1" title={it.name}>{it.name}</span>
                            <span className="font-bold text-gray-800 tabular-nums">{it.value}</span>
                            <span className="text-gray-400 tabular-nums w-12 text-right">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function GroupTimelinessCard({ item }: { item: GroupTimelinessItem }) {
    const meta = GROUP_META[item.group] ?? { title: item.group, sub: "" };
    const known = item.onTime + item.late; // เฉพาะรายการที่ระบุความทันเวลา
    const pctOnTime = known > 0 ? Math.round((item.onTime / known) * 1000) / 10 : 0;
    const pctLate = known > 0 ? Math.round((item.late / known) * 1000) / 10 : 0;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                    <h4 className="text-base font-bold text-[#717171]">
                        ความทันเวลา — {meta.title}
                    </h4>
                    <p className="text-[11px] text-gray-400">{meta.sub}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: "#eff6ff", color: ON_TIME_COLOR, border: "1px solid #bfdbfe" }}>
                    ทันเวลา {pctOnTime}%
                </span>
            </div>

            {/* Line chart */}
            {item.rows.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-sm text-gray-300">
                    ไม่มีข้อมูลในช่วงเวลานี้
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={item.rows} margin={{ top: 16, right: 12, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(v: number | undefined, name) => [`${v ?? 0} งาน`, name]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        />
                        <Line type="monotone" dataKey="ทันเวลา" stroke={ON_TIME_COLOR} strokeWidth={2.5}
                            dot={{ r: 3, fill: ON_TIME_COLOR, strokeWidth: 0 }} activeDot={{ r: 5, fill: ON_TIME_COLOR }}
                            label={{ position: "top", fontSize: 10, fill: ON_TIME_COLOR, fontWeight: 700 }} />
                        <Line type="monotone" dataKey="ไม่ทันเวลา" stroke={LATE_COLOR} strokeWidth={2.5}
                            dot={{ r: 3, fill: LATE_COLOR, strokeWidth: 0 }} activeDot={{ r: 5, fill: LATE_COLOR }}
                            label={{ position: "bottom", fontSize: 10, fill: LATE_COLOR, fontWeight: 700 }} />
                    </LineChart>
                </ResponsiveContainer>
            )}

            {/* ตารางสรุป ทันเวลา / ไม่ทันเวลา */}
            <div className="mt-3 space-y-1.5">
                {[
                    { label: "ทันเวลา", count: item.onTime, pct: pctOnTime, color: ON_TIME_COLOR },
                    { label: "ไม่ทันเวลา", count: item.late, pct: pctLate, color: LATE_COLOR },
                ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                        <span className="text-gray-600 flex-1">{r.label}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{r.count.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 tabular-nums w-14 text-right">({r.pct}%)</span>
                    </div>
                ))}
            </div>

            {/* สถิติเวลา */}
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                    { label: "แก้ปัญหาทั้งหมด", value: `${item.total.toLocaleString()} ครั้ง` },
                    { label: "เฉลี่ย", value: `${item.avgMin} นาที` },
                    { label: "น้อยที่สุด", value: `${item.minMin} นาที` },
                    { label: "มากที่สุด", value: `${item.maxMin} นาที` },
                ].map((s) => (
                    <div key={s.label} className="rounded-lg py-2 px-1" style={{ background: "#f0faf4" }}>
                        <p className="text-[10px] text-gray-500">{s.label}</p>
                        <p className="text-sm font-bold text-gray-800 tabular-nums">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* สัดส่วนหมวดย่อย ทันเวลา / ไม่ทันเวลา */}
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ShareDonut title="ทันเวลา" items={item.onTimeShare} total={item.onTime} accent={ON_TIME_COLOR} />
                <ShareDonut title="ไม่ทันเวลา" items={item.lateShare} total={item.late} accent={LATE_COLOR} />
            </div>
        </div>
    );
}

export function GroupTimelinessSection({ groups }: { groups: GroupTimelinessItem[] }) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {groups.map((g) => (
                <GroupTimelinessCard key={g.group} item={g} />
            ))}
        </div>
    );
}

// ── SlaReportSection ──────────────────────────────────────────────────────────
// SLA Reports — Service Desk (ให้คำปรึกษา) และ Report (ระบบข้อมูลและรายงาน)
// section ละหมวด: กราฟเส้นความทันเวลา + ตาราง % + สถิติเวลา + โดนัทหน่วยงาน + งานที่ทำมากที่สุด

interface ServiceDeskReport {
    title: string;
    category: string;
    trend: Array<{ label: string; ทันเวลา: number; ไม่ทันเวลา: number }>;
    total: number;
    onTime: number;
    late: number;
    avgMin: number;
    minMin: number;
    maxMin: number;
    departments: Array<{ name: string; value: number }>;
    topSubtasks: Array<{ name: string; count: number; pct: number }>;
}

function ServiceDeskCard({ report }: { report: ServiceDeskReport }) {
    const known = report.onTime + report.late;
    const pctOnTime = known > 0 ? Math.round((report.onTime / known) * 1000) / 10 : 0;
    const pctLate = known > 0 ? Math.round((report.late / known) * 1000) / 10 : 0;
    const deptTotal = report.departments.reduce((s, d) => s + d.value, 0);
    const catColor = taskColor(report.category);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="min-w-0">
                    <h4 className="text-base font-bold text-[#717171] truncate">{report.title}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                            style={{ background: catColor }}>
                            {taskShort(report.category)}
                        </span>
                        <span className="text-[11px] text-gray-400 truncate">{report.category}</span>
                    </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                    ทันเวลา {pctOnTime}%
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ซ้าย: กราฟเส้น + ตาราง % + สถิติ */}
                <div>
                    {report.trend.length === 0 ? (
                        <div className="h-44 flex items-center justify-center text-sm text-gray-300">
                            ไม่มีข้อมูลในช่วงเวลานี้
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={report.trend} margin={{ top: 16, right: 12, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(v: number | undefined, name) => [`${v ?? 0} งาน`, name]}
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                                <Line type="monotone" dataKey="ทันเวลา" stroke="#2563eb" strokeWidth={2.5}
                                    dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#2563eb" }}
                                    label={{ position: "top", fontSize: 10, fill: "#2563eb", fontWeight: 700 }} />
                                <Line type="monotone" dataKey="ไม่ทันเวลา" stroke="#f59e0b" strokeWidth={2.5}
                                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#f59e0b" }}
                                    label={{ position: "bottom", fontSize: 10, fill: "#f59e0b", fontWeight: 700 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}

                    <div className="mt-3 space-y-1.5">
                        {[
                            { label: "ทันเวลา", count: report.onTime, pct: pctOnTime, color: "#2563eb" },
                            { label: "ไม่ทันเวลา", count: report.late, pct: pctLate, color: "#f59e0b" },
                        ].map((r) => (
                            <div key={r.label} className="flex items-center gap-2 text-sm">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                                <span className="text-gray-600 flex-1">{r.label}</span>
                                <span className="font-bold text-gray-900 tabular-nums">{r.count.toLocaleString()}</span>
                                <span className="text-xs text-gray-400 tabular-nums w-14 text-right">({r.pct}%)</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                            { label: "งานทั้งหมด", value: `${report.total.toLocaleString()} ครั้ง` },
                            { label: "เฉลี่ย", value: `${report.avgMin} นาที` },
                            { label: "น้อยที่สุด", value: `${report.minMin} นาที` },
                            { label: "มากที่สุด", value: `${report.maxMin} นาที` },
                        ].map((s) => (
                            <div key={s.label} className="rounded-lg py-2 px-1" style={{ background: "#f0faf4" }}>
                                <p className="text-[10px] text-gray-500">{s.label}</p>
                                <p className="text-sm font-bold text-gray-800 tabular-nums">{s.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ขวา: โดนัทหน่วยงาน + งานที่ทำมากที่สุด */}
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">หน่วยงานที่แจ้ง</p>
                    {report.departments.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-sm text-gray-300">
                            ไม่มีข้อมูลหน่วยงาน
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <ResponsiveContainer width="100%" height={160} className="sm:max-w-[170px]">
                                <PieChart>
                                    <Pie data={report.departments} cx="50%" cy="50%"
                                        innerRadius={38} outerRadius={66}
                                        dataKey="value" nameKey="name" paddingAngle={1}>
                                        {report.departments.map((_, i) => (
                                            <Cell key={i} fill={DEPT_PALETTE[i % DEPT_PALETTE.length]} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v: number | undefined, name) => [
                                            `${(v ?? 0).toLocaleString()} งาน (${deptTotal > 0 ? Math.round(((v ?? 0) / deptTotal) * 1000) / 10 : 0}%)`,
                                            name,
                                        ]}
                                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full grid grid-cols-1 gap-y-1 max-h-36 overflow-auto pr-1">
                                {report.departments.map((d, i) => {
                                    const pct = deptTotal > 0 ? Math.round((d.value / deptTotal) * 1000) / 10 : 0;
                                    return (
                                        <div key={d.name} className="flex items-center gap-1.5 min-w-0 text-[11px]">
                                            <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                                                style={{ background: DEPT_PALETTE[i % DEPT_PALETTE.length] }} />
                                            <span className="text-gray-600 truncate flex-1">{d.name}</span>
                                            <span className="font-bold text-gray-800 tabular-nums">{d.value}</span>
                                            <span className="text-gray-400 tabular-nums w-12 text-right">({pct}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-4 mb-2">งานที่ทำมากที่สุด</p>
                    {report.topSubtasks.length === 0 ? (
                        <p className="text-sm text-gray-300">ไม่มีข้อมูลหมวดย่อย</p>
                    ) : (
                        <div className="space-y-2">
                            {report.topSubtasks.map((s, i) => (
                                <div key={s.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 truncate pr-2">{i + 1}. {s.name}</span>
                                        <span className="font-bold text-gray-900 tabular-nums shrink-0">
                                            {s.count.toLocaleString()}{" "}
                                            <span className="text-xs text-gray-400">({s.pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                                        <motion.div className="h-full rounded-full"
                                            style={{ background: catColor }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${s.pct}%` }}
                                            transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease: "easeOut" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function SlaReportSection({ reports }: { reports: ServiceDeskReport[] }) {
    if (reports.length === 0) return null;
    return (
        <div className="space-y-4">
            {reports.map((r) => (
                <ServiceDeskCard key={r.category} report={r} />
            ))}
        </div>
    );
}