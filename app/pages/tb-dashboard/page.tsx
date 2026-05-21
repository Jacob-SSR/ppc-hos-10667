"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    RefreshCw,
    TrendingUp,
    AlertTriangle,
    BadgeCheck,
    Info,
    Building2,
    ChevronDown,
    UploadCloud,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TbItemSummary {
    รายการขอเบิก: string;
    รายการสั้น: string;
    สถานะ: string;
    จำนวน: number;
    เรียกเก็บ: number;
    ชดเชย: number;
    ไม่ชดเชย: number;
    หมายเหตุ: Record<string, number>;
}

interface TbUnitSummary {
    หน่วยบริการ: string;
    hcodeKey: string;
    isHospital: boolean;
    รายการทั้งหมด: number;
    เรียกเก็บ: number;
    ชดเชย: number;
    ไม่ชดเชย: number;
    อัตราชดเชย: number;
    items: TbItemSummary[];
}

interface TbBatchSummary {
    repNo: string;
    จำนวน: number;
    เรียกเก็บ: number;
    ชดเชย: number;
    ไม่ชดเชย: number;
}

interface TbDashboardData {
    updatedAt: string;
    totalRows: number;
    totalClaim: number;
    totalComp: number;
    totalNoComp: number;
    units: TbUnitSummary[];
    batches: TbBatchSummary[];
    remarkSummary: {
        รหัส: string;
        หน่วยบริการ: string;
        จำนวน: number;
        เรียกเก็บ: number;
    }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SERVICE_COLORS: Record<string, { claim: string; comp: string; pending: string; label: string }> = {
    "CXR คัดกรอง TB": { claim: "#60a5fa", comp: "#34d399", pending: "#fca5a5", label: "CXR คัดกรองวัณโรค" },
    "CXR ติดตาม": { claim: "#818cf8", comp: "#6ee7b7", pending: "#f9a8d4", label: "CXR ติดตามการรักษา" },
    "AFB เสมหะ": { claim: "#fbbf24", comp: "#4ade80", pending: "#fb923c", label: "ตรวจเสมหะ AFB" },
    "ดูแลรักษา TB": { claim: "#a78bfa", comp: "#86efac", pending: "#fda4af", label: "ดูแลรักษาวัณโรค" },
    "รวมทั้งหมด": { claim: "#85B7EB", comp: "#97C459", pending: "#F09595", label: "รวมทั้งหมด" },
};

const SHORT_LABELS: Record<string, string> = {
    "ค่าบริการถ่ายภาพรังสีทรวงอก CXR เพื่อวินิจฉัยวัณโรคในกลุ่มเสี่ยงสูง": "CXR คัดกรอง TB",
    "ค่าบริการถ่ายภาพรังสีทรวงอก CXR เพื่อติดตามการรักษา": "CXR ติดตาม",
    "ค่าบริการตรวจเสมหะ AFB เพื่อติดตามการรักษา": "AFB เสมหะ",
    "ค่าบริการดูแลรักษาผู้ป่วยวัณโรคที่มารับการรักษาและติดตาม": "ดูแลรักษา TB",
};

const ALL_SERVICES = [
    "รวมทั้งหมด",
    "CXR คัดกรอง TB",
    "CXR ติดตาม",
    "AFB เสมหะ",
    "ดูแลรักษา TB",
] as const;
type ServiceKey = typeof ALL_SERVICES[number];

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    accent,
    bg,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    accent: string;
    bg: string;
}) {
    return (
        <motion.div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ backgroundColor: bg }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: accent + "22" }}
            >
                <Icon size={20} style={{ color: accent }} strokeWidth={1.8} />
            </div>
            <div>
                <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>
                    {label}
                </p>
                <p className="text-xl font-extrabold tabular-nums" style={{ color: accent }}>
                    {value}
                </p>
                {sub && (
                    <p className="text-[11px] mt-0.5" style={{ color: accent + "99" }}>
                        {sub}
                    </p>
                )}
            </div>
        </motion.div>
    );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function TbBarChart({ units }: { units: TbUnitSummary[] }) {
    const [selectedService, setSelectedService] = useState<ServiceKey>("รวมทั้งหมด");

    const chartData = units.map((unit) => {
        const shortName = unit.หน่วยบริการ.replace("โรงพยาบาล", "รพ.");

        if (selectedService === "รวมทั้งหมด") {
            const serviceBreakdown = Object.entries(SHORT_LABELS).map(([fullKey, shortKey]) => {
                const matching = unit.items.filter((i) => i.รายการขอเบิก === fullKey);
                const claim = matching.reduce((s, i) => s + i.เรียกเก็บ, 0);
                const comp = matching.reduce((s, i) => s + i.ชดเชย, 0);
                return {
                    name: shortKey,
                    label: SERVICE_COLORS[shortKey]?.label ?? shortKey,
                    claim,
                    comp,
                    pending: Math.max(0, claim - comp),
                };
            }).filter((s) => s.claim > 0);

            return {
                name: shortName,
                เรียกเก็บ: unit.เรียกเก็บ,
                ชดเชย: unit.ชดเชย,
                ไม่ชดเชย: Math.max(0, unit.เรียกเก็บ - unit.ชดเชย),
                serviceBreakdown,
                isHospital: unit.isHospital,
            };
        }

        const fullKey = Object.entries(SHORT_LABELS).find(([, v]) => v === selectedService)?.[0];
        const matching = fullKey ? unit.items.filter((i) => i.รายการขอเบิก === fullKey) : [];
        const claim = matching.reduce((s, i) => s + i.เรียกเก็บ, 0);
        const comp = matching.reduce((s, i) => s + i.ชดเชย, 0);
        const count = matching.reduce((s, i) => s + i.จำนวน, 0);

        return {
            name: shortName,
            เรียกเก็บ: claim,
            ชดเชย: comp,
            ไม่ชดเชย: Math.max(0, claim - comp),
            serviceCount: count,
            isHospital: unit.isHospital,
        };
    });

    const colors = SERVICE_COLORS[selectedService] ?? SERVICE_COLORS["รวมทั้งหมด"];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-xs min-w-[240px]">
                <p className="font-bold text-gray-800 text-sm mb-2 pb-1.5 border-b border-gray-100">{label}</p>
                {selectedService === "รวมทั้งหมด" && d?.serviceBreakdown?.length > 0 ? (
                    <div className="space-y-2">
                        {d.serviceBreakdown.map((s: any) => (
                            <div key={s.name} className="flex justify-between items-center">
                                <span className="text-gray-600 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: SERVICE_COLORS[s.name]?.claim ?? "#94a3b8" }} />
                                    {s.label}
                                </span>
                                <span className="font-bold text-gray-800 tabular-nums">{fmtB(s.comp)} ฿</span>
                            </div>
                        ))}
                        <div className="pt-1.5 border-t border-gray-100 grid grid-cols-3 gap-1 text-[10px]">
                            <span className="text-blue-700 font-bold tabular-nums">{fmtB(d.เรียกเก็บ ?? 0)}</span>
                            <span className="text-green-700 font-bold tabular-nums">{fmtB(d.ชดเชย ?? 0)}</span>
                            <span className="text-red-500 font-bold tabular-nums">{fmtB(d.ไม่ชดเชย ?? 0)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {[
                            { k: "เรียกเก็บ", c: "text-blue-700" },
                            { k: "ชดเชย", c: "text-green-700" },
                            { k: "ไม่ชดเชย", c: "text-red-500" },
                        ].map(({ k, c }) => (
                            <div key={k} className="flex justify-between">
                                <span className="text-gray-500">{k}</span>
                                <span className={`font-bold tabular-nums ${c}`}>{fmtB((d as any)?.[k] ?? 0)} ฿</span>
                            </div>
                        ))}
                        {d.serviceCount != null && (
                            <div className="pt-1.5 border-t border-gray-100 text-gray-500">
                                จำนวน: <span className="font-bold text-gray-700">{fmt(d.serviceCount)} รายการ</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-bold text-gray-600">เรียกเก็บ vs ชดเชย — แยกตามหน่วยบริการ</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">ประเภทบริการ:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {ALL_SERVICES.map((svc) => {
                            const isActive = selectedService === svc;
                            const activeColor = svc === "รวมทั้งหมด" ? "#1a5233" : (SERVICE_COLORS[svc]?.claim ?? "#1a5233");
                            return (
                                <button
                                    key={svc}
                                    onClick={() => setSelectedService(svc)}
                                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 border"
                                    style={{
                                        backgroundColor: isActive ? activeColor : "white",
                                        color: isActive ? "white" : "#374151",
                                        borderColor: isActive ? activeColor : "#d1d5db",
                                    }}
                                >
                                    {svc}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex gap-4 mb-4 flex-wrap items-center">
                {[
                    { color: colors.claim, label: `เรียกเก็บ${selectedService !== "รวมทั้งหมด" ? ` (${selectedService})` : ""}` },
                    { color: colors.comp, label: `ชดเชย${selectedService !== "รวมทั้งหมด" ? ` (${selectedService})` : ""}` },
                    { color: colors.pending, label: "ไม่ชดเชย" },
                ].map((l) => (
                    <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: l.color }} />
                        {l.label}
                    </span>
                ))}
                <span className="text-xs text-gray-400 ml-auto italic">💡 Hover เพื่อดูรายละเอียด</span>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%" barGap={4}>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="เรียกเก็บ" fill={colors.claim} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ชดเชย" fill={colors.comp} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ไม่ชดเชย" fill={colors.pending} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>

            {selectedService !== "รวมทั้งหมด" && (() => {
                const totals = chartData.reduce(
                    (acc, row) => ({
                        claim: acc.claim + (row.เรียกเก็บ ?? 0),
                        comp: acc.comp + (row.ชดเชย ?? 0),
                        pending: acc.pending + (row.ไม่ชดเชย ?? 0),
                        count: acc.count + ((row as any).serviceCount ?? 0),
                    }),
                    { claim: 0, comp: 0, pending: 0, count: 0 }
                );
                const stats = [
                    { label: "รวมเรียกเก็บ", value: fmtB(totals.claim), color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
                    { label: "รวมชดเชย", value: fmtB(totals.comp), color: "text-green-700", bg: "bg-green-50", border: "border-green-100" },
                    { label: "ไม่ชดเชย", value: fmtB(totals.pending), color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
                ];
                return (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 mb-2">
                            สรุป: {SERVICE_COLORS[selectedService]?.label}
                            {totals.count > 0 && <span className="ml-2 font-normal text-gray-400">({totals.count.toLocaleString("th-TH")} รายการ)</span>}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {stats.map((s) => (
                                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-3 py-2.5 text-center`}>
                                    <p className="text-[10px] text-gray-500 font-medium mb-1">{s.label}</p>
                                    <p className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-gray-400">บาท</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ─── Cross Tab ────────────────────────────────────────────────────────────────
const SERVICE_COLS = [
    { key: "CXR คัดกรอง TB", label: "CXR คัดกรองวัณโรค", sublabel: "เพื่อวินิจฉัย" },
    { key: "CXR ติดตาม", label: "CXR ติดตามการรักษา", sublabel: "ถ่ายภาพรังสี" },
    { key: "AFB เสมหะ", label: "ตรวจเสมหะ AFB", sublabel: "ติดตามการรักษา" },
    { key: "ดูแลรักษา TB", label: "ดูแลรักษาวัณโรค", sublabel: "รับการรักษาและติดตาม" },
];

function CrossTab({ units }: { units: TbUnitSummary[] }) {
    const rows = units.map((unit) => {
        const services: Record<string, { claimCount: number; claimBaht: number; compCount: number; compBaht: number }> = {};
        for (const col of SERVICE_COLS) {
            services[col.key] = { claimCount: 0, claimBaht: 0, compCount: 0, compBaht: 0 };
        }
        for (const item of unit.items) {
            const key = SHORT_LABELS[item.รายการขอเบิก] ?? item.รายการสั้น;
            if (!services[key]) continue;
            services[key].claimCount += item.จำนวน;
            services[key].claimBaht += item.เรียกเก็บ;
            if (item.สถานะ === "ชดเชย") {
                services[key].compCount += item.จำนวน;
                services[key].compBaht += item.ชดเชย;
            }
        }
        return { hcode: unit.hcodeKey, name: unit.หน่วยบริการ, isHospital: unit.isHospital, total: unit.เรียกเก็บ, services };
    });

    const totals = rows.reduce(
        (acc, row) => {
            acc.total += row.total;
            for (const col of SERVICE_COLS) {
                acc.services[col.key].claimCount += row.services[col.key].claimCount;
                acc.services[col.key].claimBaht += row.services[col.key].claimBaht;
                acc.services[col.key].compCount += row.services[col.key].compCount;
                acc.services[col.key].compBaht += row.services[col.key].compBaht;
            }
            return acc;
        },
        {
            total: 0,
            services: Object.fromEntries(
                SERVICE_COLS.map((s) => [s.key, { claimCount: 0, claimBaht: 0, compCount: 0, compBaht: 0 }])
            ) as Record<string, { claimCount: number; claimBaht: number; compCount: number; compBaht: number }>,
        }
    );

    const thBase = "px-2 py-2 text-white font-medium text-[11px] text-center border border-[#a8d5ba]";

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-600">จัดสรรผลงานบริการวัณโรค - DMTB</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="border-collapse text-xs" style={{ minWidth: "900px" }}>
                    <thead>
                        <tr>
                            <th className={`${thBase} bg-[#1a5233]`} rowSpan={3} style={{ minWidth: 56 }}>รหัส<br />หน่วยบริการ</th>
                            <th className={`${thBase} bg-[#1a5233]`} rowSpan={3} style={{ minWidth: 130, textAlign: "left" }}>ชื่อหน่วยบริการ</th>
                            <th className={`${thBase} bg-[#1a5233]`} rowSpan={3} style={{ minWidth: 76 }}>รวม (บาท)</th>
                            {SERVICE_COLS.map((s) => (
                                <th key={s.key} className={`${thBase} bg-[#1a5233]`} colSpan={4}>
                                    {s.label}<br /><span style={{ fontSize: 9, fontWeight: 400 }}>{s.sublabel}</span>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {SERVICE_COLS.map((s) => (
                                <td key={s.key} colSpan={4} className={`${thBase} bg-[#236b43] p-0`} style={{ padding: 0 }}>
                                    <table className="w-full"><tbody><tr>
                                        <td className={`${thBase} bg-[#236b43] w-1/2`} colSpan={2}>เรียกเก็บ</td>
                                        <td className={`${thBase} bg-[#236b43] w-1/2`} colSpan={2}>ชดเชย</td>
                                    </tr></tbody></table>
                                </td>
                            ))}
                        </tr>
                        <tr>
                            {SERVICE_COLS.map((s) => (
                                <React.Fragment key={s.key}>
                                    <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>รายการ</th>
                                    <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>บาท</th>
                                    <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>รายการ</th>
                                    <th className={`${thBase} bg-[#7ec8a0] text-[10px] text-[#1a5233]`}>บาท</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={row.hcode} className={`border-b border-gray-200 transition-colors hover:bg-[#f0faf4] ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                                <td className="px-2 py-1.5 text-center text-xs font-medium text-[#1a5233] bg-[#f0faf4]">{row.hcode}</td>
                                <td className={`px-2 py-1.5 text-left text-xs font-medium ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-gray-700"}`}>{row.name}</td>
                                <td className={`px-2 py-1.5 text-right tabular-nums text-xs font-medium border-r-2 border-gray-300 ${row.isHospital ? "text-blue-800 bg-blue-50" : "text-[#1a5233]"}`}>{fmtB(row.total)}</td>
                                {SERVICE_COLS.map((col) => {
                                    const s = row.services[col.key];
                                    const noComp = s.claimBaht > 0 && s.compBaht === 0;
                                    return (
                                        <React.Fragment key={col.key}>
                                            <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${s.claimCount === 0 ? "text-gray-300" : "text-gray-700"}`}>{fmtB(s.claimCount)}</td>
                                            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${s.claimBaht === 0 ? "text-gray-300" : noComp ? "bg-amber-50 text-amber-900" : "text-gray-700"}`}>{fmtB(s.claimBaht)}</td>
                                            <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${s.compCount === 0 ? "text-gray-300" : "text-[#236b43]"}`}>{fmtB(s.compCount)}</td>
                                            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-r-2 border-gray-300 ${s.compBaht === 0 && s.claimBaht > 0 ? "text-red-500" : s.compBaht === 0 ? "text-gray-300" : "text-[#236b43] font-medium"}`}>{fmtB(s.compBaht)}</td>
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
                            <td className="px-2 py-2 text-xs font-medium text-[#1a5233] text-center">รวม</td>
                            <td className="px-2 py-2 text-xs font-medium text-[#1a5233]">รวมทั้งหมด</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">{fmtB(totals.total)}</td>
                            {SERVICE_COLS.map((col) => {
                                const t = totals.services[col.key];
                                return (
                                    <React.Fragment key={col.key}>
                                        <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233]">{fmtB(t.claimCount)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">{fmtB(t.claimBaht)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233]">{fmtB(t.compCount)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-xs font-medium text-[#1a5233] border-r-2 border-gray-300">{fmtB(t.compBaht)}</td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
                * ช่องสีเหลือง = มีการเรียกเก็บแต่ได้รับชดเชย 0 บาท (ติด ERR) · ช่องสีแดง = ชดเชย 0 มีเรียกเก็บ
            </p>
        </div>
    );
}

// ─── Unit Card ────────────────────────────────────────────────────────────────
function ItemTable({ items }: { items: TbItemSummary[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-green-700">
                        {["รายการที่ขอเบิก", "สถานะ", "จำนวน", "เรียกเก็บ (฿)", "ชดเชย (฿)", "ไม่ชดเชย (฿)", "หมายเหตุ"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap border-r border-green-600">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => {
                        const isOk = item.สถานะ === "ชดเชย";
                        const base = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                        const remarks = Object.entries(item.หมายเหตุ);
                        return (
                            <tr key={i} className="border-b border-gray-100 transition-colors" style={{ backgroundColor: base }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = base)}>
                                <td className="px-3 py-2 text-gray-800 max-w-[280px]">
                                    <div className="font-medium">{item.รายการสั้น}</div>
                                    <div className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{item.รายการขอเบิก}</div>
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{item.สถานะ}</span>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{fmt(item.จำนวน)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(item.เรียกเก็บ)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-green-700">{fmt(item.ชดเชย)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-red-600">{fmt(item.ไม่ชดเชย)}</td>
                                <td className="px-3 py-2">
                                    {remarks.length > 0 ? (
                                        <div className="flex flex-col gap-0.5">
                                            {remarks.map(([k, v]) => (
                                                <span key={k} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                                    {k} ×{v}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-300">—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function UnitCard({ unit }: { unit: TbUnitSummary }) {
    const [open, setOpen] = useState(unit.isHospital);
    const compRate = unit.อัตราชดเชย;
    const rateColor = compRate >= 90 ? "#3B6D11" : compRate >= 60 ? "#854F0B" : "#A32D2D";

    return (
        <motion.div
            className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
            <button
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpen((p) => !p)}
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unit.isHospital ? "bg-blue-50" : "bg-green-50"}`}>
                    <Building2 size={18} className={unit.isHospital ? "text-blue-700" : "text-green-700"} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{unit.หน่วยบริการ}</p>
                    <p className="text-[11px] text-gray-400">HCODE {unit.hcodeKey} · {fmt(unit.รายการทั้งหมด)} รายการ</p>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-right">
                    <div><p className="text-[10px] text-gray-400 font-medium">เรียกเก็บ</p><p className="text-sm font-bold text-gray-800 tabular-nums">{fmt(unit.เรียกเก็บ)}</p></div>
                    <div><p className="text-[10px] text-gray-400 font-medium">ชดเชย</p><p className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>{fmt(unit.ชดเชย)}</p></div>
                    <div><p className="text-[10px] text-gray-400 font-medium">อัตรา</p><p className="text-sm font-extrabold tabular-nums" style={{ color: rateColor }}>{compRate}%</p></div>
                    <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={14} className="text-gray-400" />
                    </motion.div>
                </div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden border-t border-gray-100"
                    >
                        <div className="px-5 py-4">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: rateColor }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${compRate}%` }}
                                        transition={{ duration: 0.7, ease: "easeOut" }}
                                    />
                                </div>
                                <span className="text-xs font-bold tabular-nums" style={{ color: rateColor }}>{compRate}% ชดเชย</span>
                            </div>
                            <ItemTable items={unit.items} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Remark Table ─────────────────────────────────────────────────────────────
function RemarkTable({ data }: { data: TbDashboardData["remarkSummary"] }) {
    if (!data.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={15} className="text-amber-600" />
                <h4 className="text-sm font-bold text-gray-600">สรุปรหัสหมายเหตุ / ข้อผิดพลาด</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-amber-600">
                            {["รหัสหมายเหตุ", "หน่วยบริการ", "จำนวน", "เรียกเก็บ (฿)"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-amber-500">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                <td className="px-3 py-2">
                                    <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">{row.รหัส}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-700">{row.หน่วยบริการ}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{fmt(row.จำนวน)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-800">{fmt(row.เรียกเก็บ)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Batch Table ──────────────────────────────────────────────────────────────
function BatchTable({ batches }: { batches: TbBatchSummary[] }) {
    if (!batches.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-blue-600" />
                <h4 className="text-sm font-bold text-gray-600">สรุปตาม REP No. (งวดส่งข้อมูล)</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-blue-700">
                            {["REP No.", "จำนวน", "เรียกเก็บ (฿)", "ชดเชย (฿)", "ไม่ชดเชย (฿)", "อัตรา"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-blue-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {batches.map((b, i) => {
                            const rate = b.เรียกเก็บ > 0 ? Math.round((b.ชดเชย / b.เรียกเก็บ) * 1000) / 10 : 0;
                            const base = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                            return (
                                <tr key={b.repNo} className="border-b border-gray-100" style={{ backgroundColor: base }}>
                                    <td className="px-3 py-2 font-mono text-[11px] text-blue-700 font-bold">{b.repNo}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(b.จำนวน)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtB(b.เรียกเก็บ)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold text-green-700">{fmtB(b.ชดเชย)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold text-red-600">{fmtB(b.ไม่ชดเชย)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: rate >= 80 ? "#3B6D11" : rate >= 50 ? "#854F0B" : "#A32D2D" }}>{rate}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Upload Dropzone ──────────────────────────────────────────────────────────
function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const upload = useCallback(async (file: File) => {
        setUploading(true);
        setResult(null);
        const form = new FormData();
        form.append("file", file);
        try {
            const res = await fetch("/api/tb-upload", { method: "POST", body: form, credentials: "include" });
            const json = await res.json();
            setResult({ ok: json.success, msg: json.message ?? json.error });
            if (json.success) setTimeout(onSuccess, 600);
        } catch {
            setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" });
        } finally {
            setUploading(false);
        }
    }, [onSuccess]);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูลการเบิกจ่ายวัณโรค</h4>
                <span className="text-[11px] text-gray-400">tb.xlsx</span>
            </div>
            <motion.div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) upload(f);
                }}
                onClick={() => !uploading && inputRef.current?.click()}
                animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa", scale: dragging ? 1.01 : 1 }}
                className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 py-6 px-4 select-none"
                style={{ minHeight: 120 }}
            >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                <AnimatePresence mode="wait">
                    {uploading ? (
                        <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={28} className="text-green-600" /></motion.div>
                            <p className="text-sm font-semibold text-green-700">กำลังอัปโหลด...</p>
                        </motion.div>
                    ) : result?.ok ? (
                        <motion.div key="ok" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                            <CheckCircle2 size={28} className="text-green-600" />
                            <p className="text-sm font-bold text-green-700">{result.msg}</p>
                            <p className="text-xs text-gray-400 underline cursor-pointer" onClick={(e) => { e.stopPropagation(); setResult(null); }}>อัปโหลดไฟล์ใหม่</p>
                        </motion.div>
                    ) : result ? (
                        <motion.div key="err" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                            <XCircle size={28} className="text-red-500" />
                            <p className="text-sm font-semibold text-red-600">{result.msg}</p>
                            <p className="text-xs text-gray-500 underline cursor-pointer" onClick={(e) => { e.stopPropagation(); setResult(null); }}>ลองใหม่</p>
                        </motion.div>
                    ) : (
                        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1 pointer-events-none">
                            <motion.div animate={dragging ? { y: -6 } : { y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                                <UploadCloud size={28} style={{ color: dragging ? "#3aa36a" : "#9ca3af" }} />
                            </motion.div>
                            <p className="text-sm font-semibold text-gray-600">{dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}</p>
                            <p className="text-xs text-gray-400">.xlsx จาก DMTB / หมอพร้อม เท่านั้น</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TbDashboardPage() {
    const [data, setData] = useState<TbDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noFile, setNoFile] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setNoFile(false);
        try {
            const res = await fetch("/api/tb-dashboard", { credentials: "include" });
            if (res.status === 404) { setNoFile(true); setLoading(false); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalPending = data ? data.totalClaim - data.totalComp - data.totalNoComp : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-bold text-gray-800">Dashboard การเบิกจ่ายค่าบริการวัณโรค (DMTB)</h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        แยกตามประเภทที่ขอเบิก — โรงพยาบาลพลับพลาชัย
                        {data && <span className="ml-2">· อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                    <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
                        <RefreshCw size={14} />
                    </motion.span>
                    รีเฟรช
                </button>
            </div>

            {/* No file */}
            {noFile && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
                    <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
                        <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel จาก DMTB / หมอพร้อม ด้านล่าง</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">⚠️ {error}</div>}

            {/* KPI Cards */}
            {(loading || data) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />)
                        : data && (
                            <>
                                <KpiCard icon={TrendingUp} label="รายการทั้งหมด" value={fmt(data.totalRows)} sub="รายการขอเบิก" accent="#0369A1" bg="#E0F2FE" />
                                <KpiCard icon={TrendingUp} label="เรียกเก็บรวม" value={fmt(data.totalClaim)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
                                <KpiCard icon={BadgeCheck} label="ชดเชยแล้ว" value={fmt(data.totalComp)} sub={`${data.totalClaim > 0 ? Math.round((data.totalComp / data.totalClaim) * 1000) / 10 : 0}% ของที่เรียกเก็บ`} accent="#3B6D11" bg="#EAF3DE" />
                                <KpiCard icon={AlertTriangle} label="ไม่ชดเชย" value={fmt(data.totalNoComp)} sub={`${data.units.reduce((s, u) => s + u.items.filter((i) => i.สถานะ === "ไม่ชดเชย").reduce((n, i) => n + i.จำนวน, 0), 0)} รายการ`} accent="#991B1B" bg="#FEE2E2" />
                            </>
                        )}
                </div>
            )}

            {/* Bar Chart */}
            {data && <TbBarChart units={data.units} />}

            {/* Cross Tab */}
            {data && <CrossTab units={data.units} />}

            {/* Batch Table */}
            {data && <BatchTable batches={data.batches} />}

            {/* Unit Cards */}
            {data && (
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">รายละเอียดแยกตามหน่วยบริการ</p>
                    {data.units.map((unit) => <UnitCard key={unit.hcodeKey} unit={unit} />)}
                </div>
            )}

            {/* Remark */}
            {data && <RemarkTable data={data.remarkSummary} />}

            {/* Upload */}
            <UploadDropzone onSuccess={fetchData} />
        </div>
    );
}