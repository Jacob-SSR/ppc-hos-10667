"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Cell } from "recharts";
import {
    Users, Clock, Timer, Hourglass, Layers, Download, AlertTriangle, UserCheck, FlaskConical, Scan, TrendingUp,
} from "lucide-react";
import { KpiCard, SectionCard } from "@/app/components/dashboard/live";
import type { ServiceTimeData } from "@/lib/servicetime.types";
import { C, fmt, tip, stageColor, stageShort } from "./helpers";
import { StageRow } from "./StageRow";
import { AncillaryCard } from "./AncillaryCard";
import { ClinicStageTable } from "./ClinicStageTable";
import { ClinicStackChart, StageAvgBarChart } from "./StageCharts";
import { HourlyStageLineChart } from "./HourlyStageLineChart";
import { WaitBucketChart } from "./WaitBucketChart";
import { PersonTable } from "./PersonTable";

type KpiItem = {
    icon: React.ElementType; label: string; value: string; sub: string; accent: string; bg: string;
};

export function OverviewView({
    data, headlineKpis, kpis, pctGoal, clinic, onSelectClinic, onExportClinics,
}: {
    data: ServiceTimeData;
    headlineKpis: KpiItem[];
    kpis: KpiItem[];
    pctGoal: number;
    clinic: string;
    onSelectClinic: (clinic: string) => void;
    onExportClinics: () => void;
}) {
    const summary = data.summary;
    const total = summary.total;

    return (
        <>
            {/* การ์ดสรุปหัวเรื่อง */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {headlineKpis.map((k, i) => (
                    <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} bg={k.bg} />
                ))}
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                {kpis.map((k, i) => (
                    <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub={k.sub} accent={k.accent} bg={k.bg} />
                ))}
            </div>

            {/* visit type breakdown chips */}
            <div className="flex flex-wrap gap-2 mb-5 text-xs">
                {[
                    { icon: UserCheck, label: "นัด", v: summary.appointmentVisits, color: C.teal },
                    { icon: Users, label: "Walk-in", v: summary.walkinVisits, color: C.blue },
                ].map((c) => (
                    <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1">
                        <c.icon size={13} style={{ color: c.color }} />
                        <span className="text-gray-500">{c.label}</span>
                        <span className="font-bold tabular-nums text-gray-800">{fmt(c.v)}</span>
                    </span>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <SectionCard
                    title={`เวลาเฉลี่ยแต่ละขั้นตอน 1-${data.stageColumns.length} (นาที)`}
                    icon={Hourglass} titleColor="#1a5233"
                >
                    <StageAvgBarChart stages={data.allStages} />
                </SectionCard>

                <SectionCard title="จำนวนผู้ป่วยรายชั่วโมง แยกตามขั้นตอน" icon={TrendingUp} titleColor="#1a5233">
                    <HourlyStageLineChart data={data.hourlyStages} stages={data.stageColumns} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <SectionCard title="จำนวนคนตามช่วงเวลารอของแต่ละขั้นตอน" icon={Layers} titleColor="#1a5233">
                    <p className="text-[11px] text-gray-400 -mt-1 mb-2">
                        เขียว = รอสั้น → แดง = รอนาน · คลิกชื่อขั้นตอนด้านบนเพื่อเปิด/ปิดแถว
                    </p>
                    <WaitBucketChart rows={data.waitBuckets} />
                </SectionCard>

                <SectionCard title="ภาพรวมรายชั่วโมง: ผู้ป่วยมาถึง และเวลารวมเฉลี่ย" icon={Clock} titleColor="#1a5233">
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={data.hourlyOverview} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}:00`} />
                            <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                                labelFormatter={(h) => `${h}:00 นาที`}
                                formatter={(v, n) => [n === "visits" ? `${fmt(v as number)} ราย` : `${v} นาที`, n === "visits" ? "ผู้ป่วยมาถึง" : "เวลารวมเฉลี่ย"]}
                                {...tip}
                            />
                            <Bar yAxisId="l" dataKey="visits" fill={C.blueL} radius={[4, 4, 0, 0]} />
                            <Line yAxisId="r" type="monotone" dataKey="avgTotal" stroke={C.red} strokeWidth={2.5} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <SectionCard title="ระยะเวลาแต่ละขั้นตอน (เฉลี่ย · เส้น = เป้าหมาย)" icon={Hourglass} titleColor="#1a5233">
                    <div>
                        {data.stages.map((s) => <StageRow key={s.key} s={s} />)}
                        <div className="mt-2 pt-2 border-t-2 border-gray-200">
                            {total && <StageRow s={total} />}
                        </div>
                    </div>
                </SectionCard>

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
                    <p className="text-[11px] text-gray-400 mt-1">เขียว = ≤ เป้า {data.targetTotal} นาที · ส้ม/แดง = เกินเป้า</p>
                </SectionCard>
            </div>

            <SectionCard title="แนวโน้มรายวัน — จำนวน visit และเวลารวมเฉลี่ย" icon={Clock} titleColor="#1a5233" className="mb-4">
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                            formatter={(v, n) => [n === "visits" ? `${fmt(v as number)} visit` : `${v} นาที`, n === "visits" ? "จำนวน" : "เวลารวมเฉลี่ย"]}
                            {...tip}
                        />
                        <Bar yAxisId="l" dataKey="visits" fill={C.blueL} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="r" type="monotone" dataKey="avgTotal" stroke={C.green} strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </SectionCard>

            <SectionCard
                title="สรุปแยกรายคลินิก — เวลาเฉลี่ยรายขั้นตอน (นาที) · เรียงจากรอนานสุด · จุดคอขวดไฮไลต์แดง"
                icon={Layers} titleColor="#1a5233" className="mb-4"
            >
                <div className="flex items-center justify-between gap-2 -mt-1 mb-2">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-red-400" />
                        ช่องพื้นแดง = ขั้นตอน &ldquo;รอ&rdquo; ที่นานสุดของคลินิกนั้น · คลิกแถวเพื่อกรองแผงอื่น (ตารางนี้แสดงทุกคลินิกตามเวรที่เลือก)
                    </p>
                    <button
                        onClick={onExportClinics}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors shrink-0"
                    >
                        <Download size={13} /> Excel
                    </button>
                </div>
                <ClinicStageTable
                    rows={data.byDepartment}
                    stages={data.stageColumns}
                    totalTarget={data.targetTotal}
                    pctGoal={pctGoal}
                    selected={clinic}
                    onSelect={onSelectClinic}
                />
            </SectionCard>

            <SectionCard
                title="องค์ประกอบเวลาแยกรายขั้นตอน — 12 คลินิกที่รอนานสุด"
                icon={Timer} titleColor="#1a5233" className="mb-4"
            >
                <ClinicStackChart rows={data.byDepartment} stages={data.stages} />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[11px] text-gray-500">
                    {data.stages.map((s) => (
                        <span key={s.key} className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: stageColor(s.key) }} />
                            {stageShort(s.key, s.label)}
                        </span>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="ปริมาณผู้รับบริการตามชั่วโมง (เข้าจุดคัดกรอง)" icon={Users} titleColor="#1a5233" className="mb-4">
                <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={data.hourly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickFormatter={(h) => `${h}`} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip formatter={(v) => [`${fmt(v as number)} visit`, ""]} labelFormatter={(h) => `${h}:00 นาที`} {...tip} />
                        <Bar dataKey="visits" fill={C.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <AncillaryCard title="ระยะเวลา Lab (TAT)" icon={FlaskConical} data={data.lab} />
                <AncillaryCard title="ระยะเวลา X-ray" icon={Scan} data={data.xray} />
            </div>

            <PersonTable
                visits={data.visits}
                columns={data.stageColumns}
                total={data.visitsTotal}
                truncated={data.visitsTruncated}
            />

            <p className="text-[11px] text-gray-400 mt-5">
                * เป้าหมายเวลารวม (ปัจจุบัน ≤ {data.targetTotal} นาที) และ % ผ่านเกณฑ์ (≥ {pctGoal}%) ปรับได้ที่ปุ่มเป้าหมาย ·
                เป้าหมายรายขั้นตอน (รอตรวจ ≤ 30 นาที, รอรับยา ≤ 15 นาที, Lab/X-ray ≤ 60 นาที) ตั้งที่{" "}
                <code>ST_TARGETS</code> ใน <code>lib/servicetime.queries.ts</code> · ตัดค่าติดลบและเกิน 12 ชม. ออกจากการคำนวณ
            </p>
        </>
    );
}