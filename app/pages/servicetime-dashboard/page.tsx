"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, BarChart, Cell,
} from "recharts";
import {
    Users, Clock, Timer, Target, Stethoscope, Pill, FlaskConical, Scan,
    UserCheck, Hourglass, Gauge,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import { KpiCard, SectionCard, LiveBadge, ConnectionStatus, RefreshButton } from "@/app/components/dashboard/live";
import { fmtDate, getBangkokToday, toThaiDateLabel } from "@/lib/thaiDate";
import type {
    ServiceTimeData, ServiceScope, VisitType, StageStat, AncillaryStat,
} from "@/lib/servicetime.types";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
    green: "#2f9e6a", greenL: "#e4f4ec",
    blue: "#378ADD", blueL: "#e6f1fb",
    amber: "#ef9f27", amberL: "#faeeda",
    red: "#e24b4a", redL: "#fcebeb",
    teal: "#1d9e75", tealL: "#e1f5ee",
    purple: "#7f77dd", purpleL: "#ecebf9",
    gray: "#888780", grayL: "#f1efe8",
};
const fmt = (n: number) => n.toLocaleString("th-TH");
const mins = (v: number | null) => (v == null ? "-" : `${v} น.`);
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

// สีตาม “เฉลี่ยเทียบเป้า” (ยิ่งน้อยยิ่งดี)
function timeColor(avg: number | null, target: number | null): { accent: string; bg: string } {
    if (avg == null || target == null) return { accent: C.gray, bg: C.grayL };
    if (avg <= target) return { accent: C.green, bg: C.greenL };
    if (avg <= target * 1.5) return { accent: C.amber, bg: C.amberL };
    return { accent: C.red, bg: C.redL };
}
// สีตาม “%ผ่านเกณฑ์” (ยิ่งมากยิ่งดี)
function pctColor(pct: number | null): { accent: string; bg: string } {
    if (pct == null) return { accent: C.gray, bg: C.grayL };
    if (pct >= 80) return { accent: C.green, bg: C.greenL };
    if (pct >= 60) return { accent: C.amber, bg: C.amberL };
    return { accent: C.red, bg: C.redL };
}

type Preset = "month" | "7d" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "month", label: "เดือนนี้" },
    { key: "7d", label: "7 วัน" },
    { key: "custom", label: "กำหนดเอง" },
];
const SCOPES: { key: ServiceScope; label: string }[] = [
    { key: "opd", label: "OPD" },
    { key: "all", label: "ทั้งหมด" },
];
const VISIT_TYPES: { key: VisitType; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "walkin", label: "Walk-in" },
    { key: "appt", label: "นัด" },
];

function presetRange(p: Preset): { start: Date; end: Date } {
    const today = getBangkokToday();
    if (p === "7d") { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: s, end: today }; }
    // month
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
}

// ─── Segmented control ────────────────────────────────────────────────────────
function Segmented<T extends string>({
    value, options, onChange,
}: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {options.map((o) => (
                <button
                    key={o.key}
                    onClick={() => onChange(o.key)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${value === o.key ? "bg-green-700 text-white font-semibold" : "text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// ─── แถวขั้นตอน (stage) ───────────────────────────────────────────────────────
function StageRow({ s }: { s: StageStat }) {
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
                        title={`เป้า ≤ ${target} น.`}
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

// ─── การ์ด Lab / X-ray ───────────────────────────────────────────────────────
function AncillaryCard({
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
                        ≤ {data.target} น. = {data.withinTargetPct}%
                    </span>
                )}
            </div>
        </SectionCard>
    );
}

export default function ServiceTimeDashboardPage() {
    const [preset, setPreset] = useState<Preset>("month");
    const [customStart, setCustomStart] = useState<Date>(() => presetRange("month").start);
    const [customEnd, setCustomEnd] = useState<Date>(() => getBangkokToday());
    const [scope, setScope] = useState<ServiceScope>("opd");
    const [visitType, setVisitType] = useState<VisitType>("all");

    const [data, setData] = useState<ServiceTimeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { start, end } = preset === "custom" ? { start: customStart, end: customEnd } : presetRange(preset);
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({
                start: fmtDate(start), end: fmtDate(end), scope, visitType,
            });
            const res = await fetch(`/api/servicetime?${qs}`, { credentials: "include" });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            setData((await res.json()) as ServiceTimeData);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [preset, customStart, customEnd, scope, visitType]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const summary = data?.summary;
    const total = summary?.total;

    const kpis = useMemo(() => {
        if (!data || !summary || !total) return [];
        const waitDoc = data.stages.find((s) => s.key === "wait_doctor");
        const waitPh = data.stages.find((s) => s.key === "wait_pharmacy");
        return [
            { icon: Users, label: "จำนวน Visit", value: fmt(summary.totalVisits), sub: `ครบ flow ${fmt(summary.completeFlowVisits)}`, ...({ accent: C.blue, bg: C.blueL }) },
            { icon: Clock, label: "ระยะเวลารวมเฉลี่ย", value: mins(total.stat.avg), sub: `มัธยฐาน ${mins(total.stat.median)} · P90 ${mins(total.stat.p90)}`, ...timeColor(total.stat.avg, total.target) },
            { icon: Target, label: `ผ่านเกณฑ์ ≤ ${total.target} น.`, value: total.withinTargetPct != null ? `${total.withinTargetPct}%` : "-", sub: "ของ visit ที่ครบ flow", ...pctColor(total.withinTargetPct) },
            { icon: Stethoscope, label: "รอตรวจเฉลี่ย", value: mins(waitDoc?.stat.avg ?? null), sub: `เป้า ≤ ${waitDoc?.target} น.`, ...timeColor(waitDoc?.stat.avg ?? null, waitDoc?.target ?? null) },
            { icon: Pill, label: "รอรับยาเฉลี่ย", value: mins(waitPh?.stat.avg ?? null), sub: `เป้า ≤ ${waitPh?.target} น.`, ...timeColor(waitPh?.stat.avg ?? null, waitPh?.target ?? null) },
            { icon: FlaskConical, label: "Lab TAT เฉลี่ย", value: mins(data.lab.total.avg), sub: `≤ ${data.lab.target} น. = ${data.lab.withinTargetPct ?? "-"}%`, ...timeColor(data.lab.total.avg, data.lab.target) },
        ];
    }, [data, summary, total]);

    const rangeLabel = data ? toThaiDateLabel(data.start, data.end) : "";

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Gauge size={22} className="text-green-700" />
                        <h1 className="text-xl md:text-2xl font-extrabold text-gray-800">
                            ระยะเวลารอคอย / ให้บริการ OPD
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        ตัวชี้วัด Service Time (R9) · {rangeLabel || "—"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ConnectionStatus error={!!error} connected={!error && !!data} />
                    <RefreshButton loading={loading} onClick={fetchData} />
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <Segmented value={preset} options={PRESETS} onChange={setPreset} />
                {preset === "custom" && (
                    <div className="flex items-center gap-2">
                        <DatePicker
                            selected={customStart}
                            onChange={(d: Date | null) => { if (d) setCustomStart(d); }}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            customInput={<ThaiDateInput />}
                        />
                        <span className="text-gray-400">–</span>
                        <DatePicker
                            selected={customEnd}
                            onChange={(d: Date | null) => { if (d) setCustomEnd(d); }}
                            dateFormat="dd/MM/yyyy"
                            locale={th}
                            customInput={<ThaiDateInput />}
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    <Segmented value={scope} options={SCOPES} onChange={setScope} />
                    <Segmented value={visitType} options={VISIT_TYPES} onChange={setVisitType} />
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm p-4 mb-4">
                    โหลดข้อมูลไม่สำเร็จ: {error}
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : data ? (
                <>
                    {/* KPI */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        {kpis.map((k, i) => (
                            <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} bg={k.bg} />
                        ))}
                    </div>

                    {/* visit type breakdown chips */}
                    <div className="flex flex-wrap gap-2 mb-5 text-xs">
                        {[
                            { icon: UserCheck, label: "นัด", v: summary!.appointmentVisits, color: C.teal },
                            { icon: Users, label: "Walk-in", v: summary!.walkinVisits, color: C.blue },
                        ].map((c) => (
                            <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1">
                                <c.icon size={13} style={{ color: c.color }} />
                                <span className="text-gray-500">{c.label}</span>
                                <span className="font-bold tabular-nums text-gray-800">{fmt(c.v)}</span>
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* Stage breakdown */}
                        <SectionCard title="ระยะเวลาแต่ละขั้นตอน (เฉลี่ย · เส้น = เป้าหมาย)" icon={Hourglass} titleColor="#1a5233">
                            <div>
                                {data.stages.map((s) => <StageRow key={s.key} s={s} />)}
                                <div className="mt-2 pt-2 border-t-2 border-gray-200">
                                    {total && <StageRow s={total} />}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Distribution */}
                        <SectionCard title="การกระจายระยะเวลารวม (นาที)" icon={Timer} titleColor="#1a5233">
                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart data={data.distribution} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip formatter={(v) => [`${fmt(v as number)} visit`, ""]} {...tip} />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                        {data.distribution.map((b, i) => {
                                            const good = ["≤30", "31-60", "61-90"].includes(b.label);
                                            return <Cell key={i} fill={good ? C.green : i === 3 ? C.amber : C.red} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="text-[11px] text-gray-400 mt-1">เขียว = ≤ เป้า 90 น. · ส้ม/แดง = เกินเป้า</p>
                        </SectionCard>
                    </div>

                    {/* Trend */}
                    <SectionCard title="แนวโน้มรายวัน — จำนวน visit และเวลารวมเฉลี่ย" icon={Clock} titleColor="#1a5233" className="mb-4">
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip
                                    formatter={(v, n) => [n === "visits" ? `${fmt(v as number)} visit` : `${v} น.`, n === "visits" ? "จำนวน" : "เวลารวมเฉลี่ย"]}
                                    {...tip}
                                />
                                <Bar yAxisId="l" dataKey="visits" fill={C.blueL} radius={[4, 4, 0, 0]} />
                                <Line yAxisId="r" type="monotone" dataKey="avgTotal" stroke={C.green} strokeWidth={2.5} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </SectionCard>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* Hourly */}
                        <SectionCard title="ปริมาณผู้รับบริการตามชั่วโมง (เข้าจุดคัดกรอง)" icon={Users} titleColor="#1a5233">
                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart data={data.hourly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}`} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip formatter={(v) => [`${fmt(v as number)} visit`, ""]} labelFormatter={(h) => `${h}:00 น.`} {...tip} />
                                    <Bar dataKey="visits" fill={C.teal} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </SectionCard>

                        {/* Department table */}
                        <SectionCard title="ระยะเวลารวมแยกตามแผนกจุดตรวจ (Top 15)" icon={Stethoscope} titleColor="#1a5233">
                            <div className="overflow-auto max-h-[230px]">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="text-gray-400 border-b border-gray-100 text-left">
                                            <th className="py-1.5 font-medium">แผนก</th>
                                            <th className="py-1.5 font-medium text-right">visit</th>
                                            <th className="py-1.5 font-medium text-right">เฉลี่ย</th>
                                            <th className="py-1.5 font-medium text-right">มัธยฐาน</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byDepartment.map((d) => {
                                            const { accent } = timeColor(d.avgTotal, total?.target ?? null);
                                            return (
                                                <tr key={d.department} className="border-b border-gray-50">
                                                    <td className="py-1.5 text-gray-700 truncate max-w-[160px]" title={d.department}>{d.department}</td>
                                                    <td className="py-1.5 text-right tabular-nums text-gray-600">{fmt(d.visits)}</td>
                                                    <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: accent }}>{mins(d.avgTotal)}</td>
                                                    <td className="py-1.5 text-right tabular-nums text-gray-500">{mins(d.medianTotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Lab / Xray */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AncillaryCard title="ระยะเวลา Lab (TAT)" icon={FlaskConical} data={data.lab} />
                        <AncillaryCard title="ระยะเวลา X-ray" icon={Scan} data={data.xray} />
                    </div>

                    <p className="text-[11px] text-gray-400 mt-5">
                        * ค่าเป้าหมาย (รวม ≤ 90 น., รอตรวจ ≤ 30 น., รอรับยา ≤ 15 น., Lab/X-ray ≤ 60 น.) ตั้งไว้ที่ <code>ST_TARGETS</code> ใน{" "}
                        <code>lib/servicetime.queries.ts</code> ปรับได้ตามเอกสารตัวชี้วัด R9 · ตัดค่าติดลบและเกิน 12 ชม. ออกจากการคำนวณ
                    </p>
                </>
            ) : null}
        </div>
    );
}