"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
    Info, Users, TrendingUp, Target, Banknote, Wallet,
    Stethoscope, Clock, BedDouble, CheckCircle2,
    LayoutDashboard, CalendarDays, Landmark, Home,
} from "lucide-react";
import {
    useAutoRefresh, timeAgo, CountdownRing, KpiCard,
    SectionCard, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import type { IpHomeWardData, FundKey } from "@/lib/ip-homeward.types";

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 60_000;

const FUND_COLOR: Record<FundKey, string> = {
    UC: "#2f80c8",
    "OFC/LGO": "#9b59d0",
    SSS: "#27ae60",
    Other: "#e08a3c",
};
const DR_COLORS = ["#2f80c8", "#27ae60", "#e08a3c", "#9b59d0", "#d4537e", "#2bb3bd"];

const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
    n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
// เงิน (บาท) แสดงเต็มทศนิยม 2 ตำแหน่ง เหมือนต้นฉบับ statement
const fmtBaht = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = (n: number) =>
    n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : String(n);

type Tab = "overview" | "financial" | "monthly" | "doctor" | "fund" | "homeward";
const TABS: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: "overview", label: "ภาพรวม", Icon: LayoutDashboard },
    { key: "financial", label: "การเงิน UC", Icon: Banknote },
    { key: "monthly", label: "รายเดือน", Icon: CalendarDays },
    { key: "doctor", label: "แพทย์", Icon: Stethoscope },
    { key: "fund", label: "กองทุน", Icon: Landmark },
    { key: "homeward", label: "Home Ward", Icon: Home },
];

const chartTip = { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IpHomeWardDashboardPage() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<IpHomeWardData>("/api/ip-homeward-sheets", REFRESH_INTERVAL_MS);
    const [tab, setTab] = useState<Tab>("overview");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-gray-800">
                            Dashboard IP &amp; Home Ward — ปีงบ 2569
                        </h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>รพ.พลับพลาชัย · 10909 · ดึงจาก Google Sheets</span>
                        {data && (
                            <>
                                <span>·</span>
                                <Clock size={11} />
                                <span>อัปเดต {timeAgo(data.updatedAt)}</span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={refetch} />
                    <ConnectionStatus error={!!error} connected={connected && !!data} />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            ตรวจสอบ IP_HOMEWARD_SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ใน .env
                        </p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )}

            {data && (
                <>
                    {/* KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        <KpiCard icon={Users} label="D/C รวมทุกสิทธิ" value={fmt(data.kpi.dcTotal)} sub="ต.ค.68–พ.ค.69" accent="#0369A1" bg="#E0F2FE" />
                        <KpiCard icon={CheckCircle2} label="UC ผ่าน A" value={fmt(data.kpi.ucPassA)} sub="ส่งเบิก สปสช." accent="#15803d" bg="#EAF7EF" />
                        <KpiCard icon={TrendingUp} label="ADJRW รวม" value={fmt(Math.round(data.kpi.adjrwTotal))} sub="สะสม" accent="#6B21A8" bg="#F3E8FF" />
                        <KpiCard icon={Target} label="CMI เฉลี่ย" value={data.kpi.cmiAvg.toFixed(3)} sub="Case Mix Index" accent="#9F1239" bg="#FFE4E6" />
                        <KpiCard icon={Banknote} label="จ่ายชดเชย UC" value={fmtM(data.kpi.payTotal)} sub={`${fmtB(data.kpi.payTotal)} บาท`} accent="#0e7490" bg="#E0F7FA" />
                        <KpiCard icon={Wallet} label="ยอดสุทธิ" value={fmtM(data.kpi.netTotal)} sub="หลังหักเงินเดือน" accent="#854D0E" bg="#FEF9C3" />
                        <KpiCard icon={Stethoscope} label="แพทย์" value={fmt(data.kpi.doctorCount)} sub="ผู้ให้บริการ" accent="#5B21B6" bg="#EDE9FE" />
                        <KpiCard icon={Clock} label="เฉลี่ยส่ง Claim" value={data.kpi.avgSendDays.toFixed(1)} sub="วัน" accent="#9A3412" bg="#FFF7ED" />
                    </div>

                    {/* Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {TABS.map((t) => {
                            const I = t.Icon;
                            return (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${tab === t.key
                                        ? "bg-[#d6f0e0] border-[#7ec8a0] text-[#1a5233]"
                                        : "bg-white border-gray-200 text-gray-500 hover:border-[#7ec8a0]"
                                        }`}
                                >
                                    <I size={15} />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {tab === "overview" && <OverviewTab data={data} />}
                    {tab === "financial" && <FinancialTab data={data} />}
                    {tab === "monthly" && <MonthlyTab data={data} />}
                    {tab === "doctor" && <DoctorTab data={data} />}
                    {tab === "fund" && <FundTab data={data} />}
                    {tab === "homeward" && <HomeWardTab data={data} />}
                </>
            )}
        </div>
    );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: IpHomeWardData }) {
    const dcData = data.monthly.map((m) => ({ label: m.label, dc: m.dc }));
    const rwData = data.monthly.map((m) => ({ label: m.label, pre: m.preRW, post: m.postRW }));
    const cmiData = data.monthly.filter((m) => m.cmi != null).map((m) => ({ label: m.label, cmi: m.cmi }));
    const stacked = data.monthly.map((m) => ({ label: m.label, UC: m.uc, "OFC/LGO": m.ofc, SSS: m.sss, Other: m.other }));
    const rightsTotal = (["UC", "OFC/LGO", "SSS", "Other"] as FundKey[]).map((k) => ({
        name: k, value: data.monthly.reduce((a, m) => a + (k === "UC" ? m.uc : k === "OFC/LGO" ? m.ofc : k === "SSS" ? m.sss : m.other), 0),
    }));

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="จำนวน D/C รายเดือน (ทุกสิทธิ)">
                    <ResponsiveContainer width="100%" height={230}>
                        <BarChart data={dcData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`, "D/C"]} contentStyle={chartTip} />
                            <Bar dataKey="dc" fill="#2f80c8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="สัดส่วนสิทธิการรักษา (รวม)">
                    <FundDonut data={rightsTotal} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="Pre vs Post adj.RW รายเดือน">
                    <ResponsiveContainer width="100%" height={230}>
                        <BarChart data={rwData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={chartTip} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="pre" name="Pre adj.RW" fill="#2bb3bd" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="post" name="Post adj.RW" fill="#d4537e" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="CMI รายเดือน (UC)">
                    <ResponsiveContainer width="100%" height={230}>
                        <LineChart data={cmiData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0.6, 0.85]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2)} />
                            <Tooltip formatter={(v) => [Number(v ?? 0).toFixed(4), "CMI"]} contentStyle={chartTip} />
                            <Line type="monotone" dataKey="cmi" stroke="#9b59d0" strokeWidth={2.5} dot={{ r: 4, fill: "#9b59d0" }} />
                        </LineChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <SectionCard title="สิทธิการรักษาแยกรายเดือน (Stacked)">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stacked} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {(["UC", "OFC/LGO", "SSS", "Other"] as FundKey[]).map((k) => (
                            <Bar key={k} dataKey={k} stackId="a" fill={FUND_COLOR[k]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>
        </>
    );
}

// ─── Financial ──────────────────────────────────────────────────────────────────
function FinancialTab({ data }: { data: IpHomeWardData }) {
    const finData = data.statement.map((s) => ({ label: s.label, pay: s.pay, deduct: s.deduct, net: s.net }));
    const cumData = data.statement.map((s, i) => {
        const running = data.statement.slice(0, i + 1).reduce((a, x) => a + x.net, 0);
        return { label: s.label, cum: Math.round(running) };
    });

    return (
        <>
            <SectionCard title="ยอดจ่ายชดเชย · หัก · สุทธิ รายเดือน">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={finData} margin={{ top: 4, right: 8, left: 10, bottom: 0 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} />
                        <Tooltip formatter={(v) => fmtB(Number(v ?? 0)) + " บาท"} contentStyle={chartTip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="pay" name="จ่ายชดเชย" fill="#2f80c8" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="deduct" name="หัก สป." fill="#e24b4a" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="net" name="ยอดสุทธิ" fill="#27ae60" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="ยอดสุทธิสะสม (Cumulative)">
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={cumData} margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} />
                        <Tooltip formatter={(v) => fmtB(Number(v ?? 0)) + " บาท"} contentStyle={chartTip} />
                        <Line type="monotone" dataKey="cum" stroke="#27ae60" strokeWidth={2.5} dot={{ r: 4, fill: "#27ae60" }} />
                    </LineChart>
                </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Statement IP UC ปีงบ 2569">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <GreenThead cols={["เดือน", "งวด", "ราย (ผ่าน A)", "ADJRW", "CMI", "จ่ายชดเชย (฿)", "หัก สป. (฿)", "ยอดสุทธิ (฿)"]} />
                        <tbody>
                            {data.statement.map((s, i) => (
                                <tr key={s.label} className={`border-b border-gray-100 transition-colors hover:bg-[#f0faf4] ${i % 2 ? "bg-[#f7fbf8]" : "bg-white"}`}>
                                    <td className="px-3 py-2">
                                        <span
                                            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                            style={
                                                s.deduct > 0
                                                    ? { backgroundColor: "#e0f2fe", color: "#0369A1" }
                                                    : { backgroundColor: "#f0faf4", color: "#1a5233", border: "1px solid #a8d5ba" }
                                            }
                                        >
                                            {s.label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500">{s.period}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(s.cases)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{s.adjrw.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{s.cmi != null ? s.cmi.toFixed(4) : "–"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtBaht(s.pay)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-red-600">{s.deduct > 0 ? fmtBaht(s.deduct) : "–"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-green-700 font-semibold">{fmtBaht(s.net)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold border-t-2" style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
                                <td className="px-3 py-2" colSpan={2}>รวม</td>
                                <td className="px-3 py-2 text-right tabular-nums">{fmt(data.statementTotal.cases)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{data.statementTotal.adjrw.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{data.statementTotal.cmi?.toFixed(4) ?? "–"}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{fmtBaht(data.statementTotal.pay)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-red-600">{fmtBaht(data.statementTotal.deduct)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-green-700">{fmtBaht(data.statementTotal.net)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </>
    );
}

// ─── Doctor ─────────────────────────────────────────────────────────────────────
function DoctorTab({ data }: { data: IpHomeWardData }) {
    const shortName = (n: string) => n.replace("นพ.", "").replace("พญ.", "").trim();
    const cmp = data.doctors.map((d) => ({ name: shortName(d.name), cases: d.cases }));
    const rwStack = data.months.map((label, mi) => {
        const row: Record<string, number | string> = { label };
        data.doctors.forEach((d) => (row[shortName(d.name)] = d.monthlyRw[mi] ?? 0));
        return row;
    });

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="เปรียบเทียบแพทย์ — จำนวน D/C">
                    <ResponsiveContainer width="100%" height={Math.max(220, data.doctors.length * 36)}>
                        <BarChart data={cmp} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${v ?? 0} ราย`, "Cases"]} contentStyle={chartTip} />
                            <Bar dataKey="cases" radius={[0, 4, 4, 0]}>
                                {cmp.map((_, i) => <Cell key={i} fill={DR_COLORS[i % DR_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="ADJRW รายเดือน แยกแพทย์ (Stacked)">
                    <ResponsiveContainer width="100%" height={Math.max(220, data.doctors.length * 36)}>
                        <BarChart data={rwStack} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={chartTip} />
                            {data.doctors.map((d, i) => (
                                <Bar key={d.name} dataKey={shortName(d.name)} stackId="a" fill={DR_COLORS[i % DR_COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <SectionCard title="สรุปข้อมูลแพทย์">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <GreenThead cols={["#", "แพทย์", "Cases", "ADJRW", "Avg RW", "Avg LOS", "ค่ารักษา", "UC", "OFC", "SSS", "Other"]} />
                        <tbody>
                            {data.doctors.map((d, i) => (
                                <tr key={d.name} className={`border-b border-gray-100 transition-colors hover:bg-[#f0faf4] ${i % 2 ? "bg-[#f7fbf8]" : "bg-white"}`}>
                                    <td className="px-3 py-2 font-bold" style={{ color: DR_COLORS[i % DR_COLORS.length] }}>#{i + 1}</td>
                                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{d.name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.cases)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{d.adjrw.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{d.avgRw.toFixed(4)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{d.avgLos.toFixed(1)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.cost)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">{d.funds.UC}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-purple-600">{d.funds["OFC/LGO"]}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-green-600">{d.funds.SSS}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-orange-600">{d.funds.Other}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </>
    );
}

// ─── Fund ─────────────────────────────────────────────────────────────────────
function FundTab({ data }: { data: IpHomeWardData }) {
    const total = data.funds.reduce((a, f) => a + f.cases, 0);
    const pie = data.funds.map((f) => ({ name: f.name, value: f.cases }));
    const byMonth = data.months.map((label, mi) => {
        const row: Record<string, number | string> = { label };
        data.funds.forEach((f) => (row[f.name] = f.monthlyCases[mi] ?? 0));
        return row;
    });

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="สัดส่วนกองทุน (รวม)">
                    <FundDonut data={pie} />
                </SectionCard>
                <SectionCard title="D/C รายเดือนแยกกองทุน (Stacked)">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={chartTip} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {(["UC", "OFC/LGO", "SSS", "Other"] as FundKey[]).map((k) => (
                                <Bar key={k} dataKey={k} stackId="a" fill={FUND_COLOR[k]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <SectionCard title="สรุปข้อมูลแยกกองทุน">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <GreenThead cols={["กองทุน", "Cases", "%", "ADJRW", "Avg RW/Case", "Avg LOS", "ค่ารักษา"]} />
                        <tbody>
                            {data.funds.map((f) => (
                                <tr key={f.name} className="border-b border-gray-100 bg-white transition-colors hover:bg-[#f0faf4]">
                                    <td className="px-3 py-2 font-semibold" style={{ color: FUND_COLOR[f.name] }}>{f.name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(f.cases)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{total > 0 ? ((f.cases / total) * 100).toFixed(1) : "0"}%</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{f.adjrw.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{f.avgRw.toFixed(4)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{f.avgLos.toFixed(1)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(f.cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            <SectionCard title="จำนวน Case แพทย์ × กองทุน">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <GreenThead cols={["แพทย์", "UC", "OFC/LGO", "SSS", "Other", "รวม"]} />
                        <tbody>
                            {data.doctors.map((d) => (
                                <tr key={d.name} className="border-b border-gray-100 bg-white transition-colors hover:bg-[#f0faf4]">
                                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{d.name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">{d.funds.UC}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-purple-600">{d.funds["OFC/LGO"]}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-green-600">{d.funds.SSS}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-orange-600">{d.funds.Other}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold">{d.cases}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </>
    );
}

// ─── Home Ward ──────────────────────────────────────────────────────────────────
function HomeWardTab({ data }: { data: IpHomeWardData }) {
    const hw = data.homeward;
    const status = [
        { name: "ส่ง Claim แล้ว", value: hw.sent },
        { name: "ยังไม่ส่ง", value: Math.max(0, hw.coded - hw.sent) },
        { name: "ไม่ได้ลงรหัส", value: Math.max(0, hw.dc - hw.coded) },
    ];
    const statusColor = ["#27ae60", "#e08a3c", "#e24b4a"];
    const pctCoded = hw.dc > 0 ? (hw.coded / hw.dc) * 100 : 0;
    const pctSent = hw.dc > 0 ? (hw.sent / hw.dc) * 100 : 0;

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <KpiCard icon={BedDouble} label="D/C ทั้งหมด" value={fmt(hw.dc)} sub="ราย" accent="#0e7490" bg="#E0F7FA" />
                <KpiCard icon={CheckCircle2} label="ลงรหัสแล้ว" value={fmt(hw.coded)} sub={`${pctCoded.toFixed(1)}%`} accent="#15803d" bg="#EAF7EF" />
                <KpiCard icon={TrendingUp} label="ส่ง Claim" value={fmt(hw.sent)} sub={`${pctSent.toFixed(1)}%`} accent="#0369A1" bg="#E0F2FE" />
                <KpiCard icon={Info} label="ยังไม่ส่ง" value={fmt(hw.notSent)} sub="ราย" accent="#9A3412" bg="#FFF7ED" />
                <KpiCard icon={TrendingUp} label="Pre adj.RW" value={hw.preRW.toFixed(2)} sub="adj.RW" accent="#6B21A8" bg="#F3E8FF" />
                <KpiCard icon={TrendingUp} label="Post adj.RW" value={hw.postRW.toFixed(2)} sub="adj.RW" accent="#9F1239" bg="#FFE4E6" />
                <KpiCard icon={Banknote} label="ชดเชยแล้ว" value={fmtM(hw.paid)} sub={`${fmtB(hw.paid)} บาท`} accent="#15803d" bg="#EAF7EF" />
                <KpiCard icon={Clock} label="เริ่มโครงการ" value={hw.startDate || "—"} sub="ปีงบ 2569" accent="#854D0E" bg="#FEF9C3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="สถานะ Claim Home Ward">
                    <div className="flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={status} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                                    {status.map((_, i) => <Cell key={i} fill={statusColor[i]} />)}
                                </Pie>
                                <Tooltip formatter={(v, n) => [`${v ?? 0} ราย`, n]} contentStyle={chartTip} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-gray-600">
                            {status.map((s, i) => (
                                <span key={s.name} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColor[i] }} />
                                    {s.name} {s.value}
                                </span>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="ความคืบหน้า Home Ward">
                    <div className="space-y-5 pt-2">
                        <Progress label="ลงรหัสแล้ว" value={hw.coded} total={hw.dc} color="#27ae60" />
                        <Progress label="ส่ง Claim แล้ว" value={hw.sent} total={hw.dc} color="#2f80c8" />
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-3 text-center">
                                <p className="text-[10px] font-semibold uppercase text-purple-400">Pre adj.RW</p>
                                <p className="text-xl font-extrabold text-purple-700 tabular-nums">{hw.preRW.toFixed(2)}</p>
                            </div>
                            <div className="rounded-xl bg-pink-50 border border-pink-100 px-3 py-3 text-center">
                                <p className="text-[10px] font-semibold uppercase text-pink-400">Post adj.RW</p>
                                <p className="text-xl font-extrabold text-pink-700 tabular-nums">{hw.postRW.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>
        </>
    );
}

// ─── Monthly ────────────────────────────────────────────────────────────────────
function MonthlyTab({ data }: { data: IpHomeWardData }) {
    const [sel, setSel] = useState<"all" | number>("all");
    const months = data.monthly;
    const idxs = sel === "all" ? months.map((_, i) => i) : [sel];

    const sum = (k: "dc" | "uc" | "ofc" | "sss" | "other") =>
        idxs.reduce((a, i) => a + months[i][k], 0);
    const dc = sum("dc"), uc = sum("uc"), ofc = sum("ofc"), sss = sum("sss"), other = sum("other");
    const avgDays =
        idxs.length > 0
            ? idxs.reduce((a, i) => a + months[i].sendDays, 0) / idxs.length
            : 0;
    const pct = (n: number) => (dc > 0 ? ((n / dc) * 100).toFixed(1) : "0");

    const dcData = months.map((m) => ({ label: m.label, dc: m.dc }));
    const daysData = months.map((m) => ({ label: m.label, days: m.sendDays }));
    const rightsPie =
        sel === "all"
            ? null
            : [
                { name: "UC", value: months[sel].uc },
                { name: "OFC/LGO", value: months[sel].ofc },
                { name: "SSS", value: months[sel].sss },
                { name: "Other", value: months[sel].other },
            ];

    const rows = sel === "all" ? months : [months[sel]];

    return (
        <>
            {/* month selector */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSel("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sel === "all"
                        ? "bg-[#d6f0e0] border-[#7ec8a0] text-[#1a5233]"
                        : "bg-white border-gray-200 text-gray-500 hover:border-[#7ec8a0]"
                        }`}
                >
                    ทั้งหมด
                </button>
                {months.map((m, i) => (
                    <button
                        key={m.sheet}
                        onClick={() => setSel(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sel === i
                            ? "bg-[#d6f0e0] border-[#7ec8a0] text-[#1a5233]"
                            : "bg-white border-gray-200 text-gray-500 hover:border-[#7ec8a0]"
                            }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard icon={Users} label="D/C" value={fmt(dc)} sub={sel === "all" ? "ทุกเดือน" : months[sel as number].label} accent="#0369A1" bg="#E0F2FE" />
                <KpiCard icon={CheckCircle2} label="UC" value={fmt(uc)} sub={`${pct(uc)}%`} accent="#2f80c8" bg="#E0F2FE" />
                <KpiCard icon={Landmark} label="OFC/LGO" value={fmt(ofc)} sub={`${pct(ofc)}%`} accent="#6B21A8" bg="#F3E8FF" />
                <KpiCard icon={CheckCircle2} label="SSS" value={fmt(sss)} sub={`${pct(sss)}%`} accent="#15803d" bg="#EAF7EF" />
                <KpiCard icon={Info} label="Other" value={fmt(other)} sub={`${pct(other)}%`} accent="#9A3412" bg="#FFF7ED" />
                <KpiCard icon={Clock} label="เฉลี่ยส่ง" value={avgDays.toFixed(1)} sub="วัน" accent="#854D0E" bg="#FEF9C3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title={sel === "all" ? "D/C รายเดือน" : `สิทธิการรักษา — ${months[sel as number].label}`}>
                    {sel === "all" ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={dcData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v) => [`${v ?? 0} ราย`, "D/C"]} contentStyle={chartTip} />
                                <Bar dataKey="dc" fill="#2f80c8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <FundDonut data={rightsPie!} />
                    )}
                </SectionCard>

                <SectionCard title="ระยะเวลาส่ง Claim เฉลี่ย (วัน)">
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={daysData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${v ?? 0} วัน`, "เฉลี่ยส่ง"]} contentStyle={chartTip} />
                            <Line type="monotone" dataKey="days" stroke="#e08a3c" strokeWidth={2.5} dot={{ r: 4, fill: "#e08a3c" }} />
                        </LineChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            <SectionCard title="รายละเอียดรายเดือน">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                        <GreenThead cols={["เดือน", "D/C", "UC", "OFC/LGO", "SSS", "Other", "Pre RW", "Post RW", "Δ RW", "ส่ง (วัน)"]} />
                        <tbody>
                            {rows.map((m, i) => {
                                const d = m.postRW - m.preRW;
                                return (
                                    <tr key={m.sheet} className={`border-b border-gray-100 transition-colors hover:bg-[#f0faf4] ${i % 2 ? "bg-[#f7fbf8]" : "bg-white"}`}>
                                        <td className="px-3 py-2 font-medium text-gray-700">{m.label}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{m.dc}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-blue-600">{m.uc}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-purple-600">{m.ofc}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-green-600">{m.sss}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-orange-600">{m.other}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{m.preRW.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{m.postRW.toFixed(2)}</td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${d >= 0 ? "text-green-700" : "text-red-600"}`}>
                                            {d >= 0 ? "+" : ""}{d.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{m.sendDays.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </>
    );
}

// ─── shared bits ─────────────────────────────────────────────────────────────
// หัวตารางธีมเขียวเหมือน TableHeader ของเว็บ (#7ec8a0 ตัวอักษรขาว เส้น #a8d5ba)
function GreenThead({ cols }: { cols: string[] }) {
    return (
        <thead>
            <tr style={{ backgroundColor: "#7ec8a0" }}>
                {cols.map((h) => (
                    <th
                        key={h}
                        className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap border-r"
                        style={{ borderColor: "#a8d5ba" }}
                    >
                        {h}
                    </th>
                ))}
            </tr>
        </thead>
    );
}

function FundDonut({ data }: { data: { name: string; value: number }[] }) {
    return (
        <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                        {data.map((d) => <Cell key={d.name} fill={FUND_COLOR[d.name as FundKey] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v ?? 0} ราย`, n]} contentStyle={chartTip} />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-gray-600">
                {data.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: FUND_COLOR[d.name as FundKey] ?? "#94a3b8" }} />
                        {d.name} {d.value}
                    </span>
                ))}
            </div>
        </div>
    );
}

function Progress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="text-gray-500">{value}/{total} ราย · {pct.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            </div>
        </div>
    );
}