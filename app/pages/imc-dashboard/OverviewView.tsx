"use client";

import { useState } from "react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
    Info, Users, TrendingUp, Activity, HeartPulse, ShieldCheck, Clock,
} from "lucide-react";
import {
    useAutoRefresh, timeAgo, CountdownRing, KpiCard, HBarList,
    SectionCard, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";

// ─── Types (ตรงกับ /api/imc-sheets) ───────────────────────────────────────────
interface BiDx { admit: number; dc: number; n: number; }
interface FiscalBreakdown {
    total: number;
    dx: Record<string, number>;
    channel: Record<string, number>;
    status: Record<string, number>;
    comp: Record<string, number>;
    biDx: Record<string, BiDx>;
    monthly: { key: string; label: string; count: number }[];
    biAdmitAvg: number;
    biDcAvg: number;
    improvementRate: number;
    compFreeRate: number;
    totalClaim: number;
}
interface ImcData {
    updatedAt: string;
    sheetName: string;
    years: string[];
    all: FiscalBreakdown;
    byYear: Record<string, FiscalBreakdown>;
    rows: unknown[];
}

const REFRESH_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("th-TH");

// ─── Site palette (muted, light theme) ─────────────────────────────────────────
const DX_COLOR: Record<string, string> = {
    "Ischemic stroke": "#185FA5",
    "Hemorhagic stroke": "#A32D2D",
    "Recurrent stroke": "#BA7517",
    "Traumatic Brain Injury": "#7C3AED",
    "Fracture hip": "#3B6D11",
    "Spinal cord injury": "#0AA7A0",
};
const STATUS_COLOR: Record<string, string> = {
    "Improvement": "#3B6D11",
    "Improvement, จำหน่าย": "#5C8A2A",
    "Home": "#185FA5",
    "LTC": "#BA7517",
    "ย้าย": "#888780",
    "Death": "#A32D2D",
    "ไม่ระบุ": "#A8A6A0",
};
const CHANNEL_COLOR: Record<string, string> = {
    "Refer back": "#185FA5",
    "Walkin": "#3B6D11",
    "ไม่ระบุ": "#A8A6A0",
};
// ปีงบ → สีระบบ (น้ำเงิน/แดง/เขียว/อำพัน)
const YR_PALETTE = ["#185FA5", "#A32D2D", "#3B6D11", "#BA7517", "#7C3AED", "#0AA7A0"];
const YRC: Record<string, string> = { "2566": "#185FA5", "2567": "#A32D2D", "2568": "#3B6D11", "2569": "#BA7517" };
const yrColor = (y: string) => YRC[y] ?? YR_PALETTE[parseInt(y) % YR_PALETTE.length];
const FALLBACK = "#85B7EB";

const tipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" };

function entriesSorted(obj: Record<string, number>) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

// ─── Reusable chart blocks ──────────────────────────────────────────────────────
function MonthlyArea({ monthly, color }: { monthly: FiscalBreakdown["monthly"]; color: string }) {
    if (monthly.length === 0) return <Empty />;
    const id = "g" + color.replace("#", "");
    return (
        <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthly.map((m) => ({ label: m.label, count: m.count }))} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef0f2" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => [`${v} ราย`, "Admit"]} />
                <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} dot={{ r: 3, fill: color }} activeDot={{ r: 6 }} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function DxDonut({ dx, total }: { dx: Record<string, number>; total: number }) {
    const data = entriesSorted(dx).map(([label, count]) => ({ label, count, color: DX_COLOR[label] ?? FALLBACK }));
    if (data.length === 0) return <Empty />;
    return (
        <div className="flex flex-col items-center">
            <div style={{ width: "100%", height: 190 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} dataKey="count" nameKey="label" paddingAngle={2}>
                            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${v} ราย`, n]} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                {data.map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                            <span className="text-gray-600 truncate">{d.label}</span>
                        </span>
                        <span className="font-bold text-gray-800 tabular-nums">{d.count}</span>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">รวม {total} ราย</p>
        </div>
    );
}

function ChannelPie({ channel }: { channel: Record<string, number> }) {
    const data = entriesSorted(channel).map(([label, count]) => ({ label, count, color: CHANNEL_COLOR[label] ?? FALLBACK }));
    if (data.length === 0) return <Empty />;
    return (
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" outerRadius={78} dataKey="count" nameKey="label" label>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${v} ราย`, n]} />
                <Legend formatter={(v: string) => <span style={{ fontSize: 11, color: "#374151" }}>{v}</span>} />
            </PieChart>
        </ResponsiveContainer>
    );
}

function BiPerDx({ biDx }: { biDx: Record<string, BiDx> }) {
    const data = Object.entries(biDx).sort((a, b) => b[1].n - a[1].n).map(([dx, v]) => ({
        dx: dx.replace("Traumatic Brain Injury", "TBI").replace(" stroke", ""),
        full: dx, แรกรับ: v.admit, จำหน่าย: v.dc,
    }));
    if (data.length === 0) return <Empty />;
    return (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
            <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="28%" barGap={2}>
                <CartesianGrid horizontal={false} stroke="#eef0f2" />
                <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="dx" width={92} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(l) => data.find((d) => d.dx === String(l))?.full ?? l} formatter={(v, n) => [`BI ${v}`, n]} />
                <Legend formatter={(v: string) => <span style={{ fontSize: 11, color: "#374151" }}>{v}</span>} />
                <Bar dataKey="แรกรับ" fill="#E2724B" radius={[0, 4, 4, 0]} />
                <Bar dataKey="จำหน่าย" fill="#3B6D11" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function FiscalBar({ years, byYear }: { years: string[]; byYear: Record<string, FiscalBreakdown> }) {
    const data = years.map((y) => ({ label: `ปีงบ ${y}`, total: byYear[y]?.total ?? 0, color: yrColor(y) }));
    if (data.length === 0) return <Empty />;
    return (
        <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }} barCategoryGap="32%">
                <CartesianGrid vertical={false} stroke="#eef0f2" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => [`${v} ราย`, "ผู้ป่วย"]} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function SummaryTable({ biDx, dx }: { biDx: Record<string, BiDx>; dx: Record<string, number> }) {
    const rows = Object.entries(biDx).sort((a, b) => b[1].n - a[1].n);
    if (rows.length === 0) return <Empty />;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                        {["การวินิจฉัย", "จำนวน", "BI Admit", "BI D/C", "BI ↑"].map((h) => (
                            <th key={h} className="px-3 py-2 text-gray-500 font-semibold text-left whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([d, v], i) => {
                        const diff = v.dc - v.admit;
                        const c = DX_COLOR[d] ?? FALLBACK;
                        return (
                            <tr key={d} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                                <td className="px-3 py-2">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold" style={{ background: c + "1A", color: c }}>{d}</span>
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-gray-800">{dx[d] ?? v.n}</td>
                                <td className="px-3 py-2 text-center text-gray-700">{v.admit.toFixed(1)}</td>
                                <td className="px-3 py-2 text-center text-gray-700">{v.dc.toFixed(1)}</td>
                                <td className="px-3 py-2 text-center font-bold" style={{ color: diff >= 0 ? "#3B6D11" : "#A32D2D" }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Empty() {
    return <p className="text-xs text-gray-400 text-center py-10">ยังไม่มีข้อมูล</p>;
}

// ─── KPI row ────────────────────────────────────────────────────────────────────
function KpiRow({ d, valColor }: { d: FiscalBreakdown; valColor?: string }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={fmt(d.total)} sub="ราย" accent={valColor ?? "#0369A1"} bg="#E0F2FE" />
            <KpiCard icon={TrendingUp} label="Improvement Rate" value={`${d.improvementRate}%`} sub="กลับบ้าน + ดีขึ้น" accent="#3B6D11" bg="#EAF3DE" />
            <KpiCard icon={Activity} label="BI เฉลี่ย Admit" value={`${d.biAdmitAvg}`} sub="Barthel Index" accent="#854F0B" bg="#FAEEDA" />
            <KpiCard icon={HeartPulse} label="BI เฉลี่ย D/C" value={`${d.biDcAvg}`} sub="Barthel Index" accent="#185FA5" bg="#E6F1FB" />
            <KpiCard icon={ShieldCheck} label="Complication-free" value={`${d.compFreeRate}%`} sub="ไม่มีภาวะแทรกซ้อน" accent="#0AA7A0" bg="#E2F7F5" />
        </div>
    );
}

// ─── All-overview page ──────────────────────────────────────────────────────────
function AllPage({ d, years, byYear }: { d: FiscalBreakdown; years: string[]; byYear: Record<string, FiscalBreakdown> }) {
    return (
        <div className="space-y-4">
            <KpiRow d={d} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="Admit รายเดือน (ทุกปีงบ)"><MonthlyArea monthly={d.monthly} color="#185FA5" /></SectionCard>
                <SectionCard title="สัดส่วนการวินิจฉัย (Dx) รวม"><DxDonut dx={d.dx} total={d.total} /></SectionCard>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="สถานะหลัง D/C">
                    <HBarList data={entriesSorted(d.status).map(([label, count]) => ({ label, count }))} colorMap={STATUS_COLOR} total={d.total} labelWidth={120} />
                </SectionCard>
                <SectionCard title="ผู้ป่วยรายปีงบประมาณ"><FiscalBar years={years} byYear={byYear} /></SectionCard>
                <SectionCard title="BI Improvement แยก Dx (แรกรับ vs จำหน่าย)"><BiPerDx biDx={d.biDx} /></SectionCard>
            </div>
            <SectionCard title="ตารางสรุป Barthel Index แต่ละกลุ่มโรค (รวมทุกปี)">
                <SummaryTable biDx={d.biDx} dx={d.dx} />
            </SectionCard>
        </div>
    );
}

// ─── Per-year page ───────────────────────────────────────────────────────────────
function YearPage({ yr, d }: { yr: string; d: FiscalBreakdown }) {
    const color = yrColor(yr);
    return (
        <div className="space-y-4">
            <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4" style={{ background: color + "0F", border: `1px solid ${color}33` }}>
                <div>
                    <h2 className="text-lg font-bold" style={{ color }}>ปีงบประมาณ {yr}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">ข้อมูลผู้ป่วย IMC ประจำปีงบประมาณ {yr}</p>
                </div>
                <div className="text-2xl font-bold" style={{ color }}>{d.total} <span className="text-sm font-normal text-gray-400">ราย</span></div>
            </div>
            <KpiRow d={d} valColor={color} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title={`Admit รายเดือน ปี ${yr}`}><MonthlyArea monthly={d.monthly} color={color} /></SectionCard>
                <SectionCard title="การวินิจฉัย (Dx)"><DxDonut dx={d.dx} total={d.total} /></SectionCard>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="สถานะหลัง D/C">
                    <HBarList data={entriesSorted(d.status).map(([label, count]) => ({ label, count }))} colorMap={STATUS_COLOR} total={d.total} labelWidth={120} />
                </SectionCard>
                <SectionCard title="ประเภทการรับ (Refer back vs Walk-in)"><ChannelPie channel={d.channel} /></SectionCard>
                <SectionCard title="BI Improvement แยก Dx"><BiPerDx biDx={d.biDx} /></SectionCard>
            </div>
            <SectionCard title={`ตารางสรุป Barthel Index แต่ละกลุ่มโรค ปี ${yr}`}>
                <SummaryTable biDx={d.biDx} dx={d.dx} />
            </SectionCard>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────────
export default function ImcOverviewView() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<ImcData>("/api/imc-sheets", REFRESH_MS);
    const [tab, setTab] = useState<string>("all");

    const years = data?.years ?? [];
    const tabs = ["all", ...years];
    const activeTab = tabs.includes(tab) ? tab : "all";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-gray-800">Dashboard ผู้ป่วยระยะกลาง (IMC)</h1>
                        <LiveBadge />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>Intermediate Care · โรงพยาบาลพลับพลาชัย — ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
                        {data && (<><span>·</span><Clock size={11} /><span>อัปเดต {timeAgo(data.updatedAt)}</span></>)}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CountdownRing secondsLeft={secondsLeft} total={REFRESH_MS / 1000} />
                        <span className="tabular-nums font-medium">{secondsLeft}s</span>
                    </div>
                    <RefreshButton loading={loading} onClick={refetch} />
                    <ConnectionStatus error={!!error} connected={connected && !!data} />
                </div>
            </div>

            {/* Tabs */}
            {data && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-2 sm:px-3">
                    <div className="flex gap-1 overflow-x-auto">
                        {tabs.map((t) => {
                            const isActive = activeTab === t;
                            const c = t === "all" ? "#185FA5" : yrColor(t);
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${isActive ? "text-gray-900" : "text-gray-400 hover:text-gray-600 border-transparent"}`}
                                    style={isActive ? { borderBottomColor: c, color: c } : undefined}
                                >
                                    {t === "all" ? "ภาพรวมทั้งหมด" : `ปีงบ ${t}`}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และสิทธิ์เข้าถึงชีต</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !data && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[120px] rounded-2xl bg-gray-100 animate-pulse" />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[300px] rounded-2xl bg-gray-100 animate-pulse" />)}
                    </div>
                </div>
            )}

            {/* Empty */}
            {data && !error && data.all.total === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
                    <Info size={30} className="text-amber-500" />
                    <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
                    <p className="text-xs text-amber-700">เพิ่มข้อมูลใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที</p>
                </div>
            )}

            {/* Content */}
            {data && data.all.total > 0 && (
                activeTab === "all"
                    ? <AllPage d={data.all} years={years} byYear={data.byYear} />
                    : <YearPage yr={activeTab} d={data.byYear[activeTab]} />
            )}
        </div>
    );
}