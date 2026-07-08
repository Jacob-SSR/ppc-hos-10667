"use client";

// app/components/dashboard/AncCharts.tsx
// กราฟสำหรับ anc-nursing-dashboard (แท็บภาพรวม)
// 1) Line Chart รายไตรมาส: หญิงตั้งครรภ์รายใหม่
// 2) Bar Chart รายไตรมาส: ฝากครรภ์ครบ 5 ครั้ง
// 3) โดนัท: ภาวะเสี่ยงในหญิงตั้งครรภ์
// 4) โดนัท: สถานะคลอด

import { useMemo } from "react";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, BarChart3, AlertTriangle, Baby } from "lucide-react";
import { SectionCard } from "@/app/components/dashboard/live";

// ตรงกับ MonthPoint ใน page.tsx — month คาดว่าเป็น "YYYY-MM"
interface MonthPoint { month: string; label: string; value: number }

interface Props {
    /** daily.newReg.byMonth */
    newRegByMonth: MonthPoint[];
    /** anc5ByMonth จาก API (ฝากครบ 5 ครั้ง — เดือนที่มาครั้งที่ 5) */
    anc5ByMonth?: MonthPoint[];
    /** ภาวะเสี่ยง: ใช้ชุดเดียวกับ riskBars */
    riskData: { label: string; count: number }[];
    /** สถานะคลอด */
    delivery: { "ยังไม่คลอด": number; "คลอดแล้ว": number; "ส่งต่อห้องคลอด": number };
}

const fmt = (n: number) => n.toLocaleString("th-TH");

// "YYYY-MM" → ไตรมาสปีงบ (ต.ค.–ธ.ค.=Q1, ม.ค.–มี.ค.=Q2, เม.ย.–มิ.ย.=Q3, ก.ค.–ก.ย.=Q4)
function toFiscalQuarter(ym: string): { key: string; label: string } | null {
    const m = /^(\d{4})-(\d{2})/.exec(ym);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const fyBE = (mo >= 10 ? y + 1 : y) + 543;
    const q = mo >= 10 ? 1 : mo <= 3 ? 2 : mo <= 6 ? 3 : 4;
    return { key: `${fyBE}-${q}`, label: `Q${q}/${fyBE}` };
}

// รวมรายเดือน → รายไตรมาส
function toQuarterSeries(points: MonthPoint[]): { label: string; value: number }[] {
    const map = new Map<string, { label: string; value: number }>();
    for (const p of points) {
        const q = toFiscalQuarter(p.month);
        if (!q) continue;
        if (!map.has(q.key)) map.set(q.key, { label: q.label, value: 0 });
        map.get(q.key)!.value += p.value;
    }
    return [...map.entries()]
        .sort(([a], [b]) => {
            const [ya, qa] = a.split("-").map(Number);
            const [yb, qb] = b.split("-").map(Number);
            return ya !== yb ? ya - yb : qa - qb;
        })
        .map(([, v]) => v);
}

const RISK_COLORS = ["#A32D2D", "#EF9F27", "#9A3412", "#6B21A8", "#185FA5", "#3aa36a", "#94a3b8"];
const DELIVERY_COLORS: Record<string, string> = {
    "ยังไม่คลอด": "#EF9F27",
    "คลอดแล้ว": "#3aa36a",
    "ส่งต่อห้องคลอด": "#A32D2D",
};

function ChartTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; color?: string; stroke?: string; payload?: { fill?: string } }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs">
            {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
            {payload.map((p) => (
                <p key={p.name} style={{ color: p.color || p.stroke || p.payload?.fill }} className="font-medium">
                    {p.name}: {fmt(Number(p.value))} ราย
                </p>
            ))}
        </div>
    );
}

function Donut({ data, colors, centerValue, centerLabel }: {
    data: { name: string; value: number }[];
    colors: string[];
    centerValue: number;
    centerLabel: string;
}) {
    const total = data.reduce((a, d) => a + d.value, 0);
    if (total === 0)
        return <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>;
    return (
        <>
            <div className="relative">
                <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name"
                            innerRadius="60%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
                            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-gray-800">{fmt(centerValue)}</span>
                    <span className="text-[11px] text-gray-400">{centerLabel}</span>
                </div>
            </div>
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {data.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: colors[i % colors.length] }} />
                            <span className="text-gray-600 truncate">{d.name}</span>
                        </div>
                        <span className="font-semibold text-gray-800 shrink-0 ml-2">
                            {fmt(d.value)}{" "}
                            <span className="text-gray-400 font-normal">
                                ({total ? ((d.value / total) * 100).toFixed(1) : 0}%)
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

export default function AncCharts({ newRegByMonth, anc5ByMonth = [], riskData, delivery }: Props) {
    const newRegQuarter = useMemo(() => toQuarterSeries(newRegByMonth), [newRegByMonth]);
    const anc5Quarter = useMemo(() => toQuarterSeries(anc5ByMonth), [anc5ByMonth]);

    const newRegTotal = newRegQuarter.reduce((a, d) => a + d.value, 0);
    const anc5Total = anc5Quarter.reduce((a, d) => a + d.value, 0);

    const riskDonut = useMemo(
        () => riskData.filter((r) => r.count > 0).map((r) => ({ name: r.label, value: r.count })),
        [riskData],
    );
    const riskTotal = riskDonut.reduce((a, d) => a + d.value, 0);

    const deliveryDonut = useMemo(
        () => Object.entries(delivery)
            .map(([name, value]) => ({ name, value }))
            .filter((d) => d.value > 0),
        [delivery],
    );
    const deliveryTotal = deliveryDonut.reduce((a, d) => a + d.value, 0);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ── Line Chart: หญิงตั้งครรภ์รายใหม่ รายไตรมาส ── */}
            <SectionCard title="หญิงตั้งครรภ์รายใหม่ (รายไตรมาส ปีงบ)" icon={TrendingUp} titleColor="#9D174D">
                {newRegQuarter.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 mb-1">รวม {fmt(newRegTotal)} ราย</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={newRegQuarter} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line type="monotone" dataKey="value" name="หญิงตั้งครรภ์รายใหม่"
                                    stroke="#DB2777" strokeWidth={2.5}
                                    dot={{ r: 4, fill: "#DB2777", strokeWidth: 2, stroke: "#fff" }}
                                    activeDot={{ r: 6 }}
                                    label={{ position: "top", fontSize: 11, fill: "#9D174D", formatter: (v: unknown) => fmt(Number(v ?? 0)) }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </>
                )}
            </SectionCard>

            {/* ── Bar Chart: ฝากครรภ์ครบ 5 ครั้ง รายไตรมาส ── */}
            <SectionCard title="ฝากครรภ์ครบ 5 ครั้ง (รายไตรมาส ปีงบ)" icon={BarChart3} titleColor="#1a5233">
                {anc5Quarter.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 mb-1">รวม {fmt(anc5Total)} ราย</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={anc5Quarter} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f0faf4", opacity: 0.7 }} />
                                <Bar dataKey="value" name="ฝากครบ 5 ครั้ง" fill="#3aa36a" radius={[6, 6, 0, 0]} maxBarSize={52}
                                    label={{ position: "top", fontSize: 11, fill: "#1a5233", formatter: (v: unknown) => fmt(Number(v ?? 0)) }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </>
                )}
            </SectionCard>

            {/* ── โดนัท ภาวะเสี่ยง ── */}
            <SectionCard title="ภาวะเสี่ยงในหญิงตั้งครรภ์" icon={AlertTriangle} titleColor="#A32D2D">
                <Donut data={riskDonut} colors={RISK_COLORS} centerValue={riskTotal} centerLabel="ครั้งที่พบ" />
            </SectionCard>

            {/* ── โดนัท สถานะคลอด ── */}
            <SectionCard title="สถานะคลอด" icon={Baby} titleColor="#185FA5">
                <Donut data={deliveryDonut} colors={deliveryDonut.map((d) => DELIVERY_COLORS[d.name] ?? "#94a3b8")}
                    centerValue={deliveryTotal} centerLabel="รายทั้งหมด" />
            </SectionCard>
        </div>
    );
}