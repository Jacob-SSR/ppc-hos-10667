"use client";

import { useState, memo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, Area, AreaChart, LineChart, Line,
} from "recharts";
import {
    Info, Users, Activity, ShieldCheck, TrendingUp,
    CheckCircle2, HeartPulse, CalendarClock,
} from "lucide-react";
import {
    useAutoRefresh, timeAgo, CountdownRing, KpiCard, HBarList,
    SectionCard, MiniPagination, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { usePagination } from "@/hooks/usePagination";
import type { MiniThanSummary, MiniThanDashboardData, MiniThanRow } from "@/app/api/minithan-sheets/route";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── Colors (mint green theme — สอดคล้อง homeward/drug) ─────────────────────────
const C = {
    green: "#3aa36a", greenL: "#d6f0e0", dark: "#1a5233", darkL: "#f0faf4",
    mid: "#236b43", midL: "#c2e8d4", blue: "#378ADD", blueL: "#E6F1FB",
    amber: "#EF9F27", amberL: "#FAEEDA", red: "#E24B4A", redL: "#FCEBEB",
    teal: "#1D9E75", tealL: "#E1F5EE", purple: "#7F77DD", purpleL: "#EEEDFE",
    gray: "#888780", grayL: "#F1EFE8",
};
const COLOR_MAP: Record<string, string> = {
    เขียว: C.green, ส้ม: C.amber, แดง: C.red, เหลือง: "#f1c40f", ไม่ระบุ: C.gray,
};
const PALETTE = [C.dark, C.green, C.amber, C.teal, C.blue, C.purple, C.red, C.gray];
const STATUS_COLORS = [C.green, C.blue, C.amber, C.red, C.purple];

const REFRESH_INTERVAL_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("th-TH");
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

// ─── Small helpers ──────────────────────────────────────────────────────────────
function Legend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {items.map((it) => (
                <div key={it.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                    <span className="text-[10px] text-gray-500">{it.label}</span>
                </div>
            ))}
        </div>
    );
}

function Donut({ data }: { data: { name: string; value: number; color: string }[] }) {
    return (
        <>
            <div className="flex justify-center">
                <PieChart width={160} height={160}>
                    <Pie data={data} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value"
                        paddingAngle={3} isAnimationActive={false}>
                        {data.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
                </PieChart>
            </div>
            <Legend items={data.map((d) => ({ label: `${d.name} ${d.value}`, color: d.color }))} />
        </>
    );
}

// ─── Charts ─────────────────────────────────────────────────────────────────────
const DashboardCharts = memo(function DashboardCharts({ s }: { s: MiniThanSummary }) {
    const statusData = Object.entries(s.byDetailStatus).sort(([, a], [, b]) => b - a)
        .map(([name, value], i) => ({ name, value, color: STATUS_COLORS[i % STATUS_COLORS.length] }));
    const colorData = Object.entries(s.byColor).filter(([k]) => k !== "ไม่ระบุ")
        .map(([name, value]) => ({ name, value, color: COLOR_MAP[name] ?? C.gray }));
    const tambonData = Object.entries(s.byTambon).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];
    const referralData = Object.entries(s.byReferral).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];

    return (
        <div className="space-y-4">
            {/* แนวโน้มรายเดือน */}
            <SectionCard title="แนวโน้มผู้ป่วยเข้าบำบัดรายเดือน (วันที่เริ่มมาจริง)" icon={TrendingUp} titleColor={C.dark}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={s.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="mtGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#e8f5ee" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tip} formatter={(v) => [`${v ?? 0} ราย`, "จำนวน"]} />
                        <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
                            fill="url(#mtGrad)" dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Weekly retention curve — signature ของหน้านี้ */}
            <SectionCard title="การคงอยู่ในการบำบัดรายสัปดาห์ (16 สัปดาห์)" icon={HeartPulse} titleColor={C.dark}>
                <p className="text-xs text-gray-400 mb-3">
                    จำนวนผู้ป่วยที่ยังมาบำบัดในแต่ละสัปดาห์ — เส้นที่ลาดลงบ่งบอกการหลุดออกจากโปรแกรม (drop-off)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={s.weeklyRetention} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e8f5ee" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tip} formatter={(v, _n, p) => [`${v ?? 0} ราย (${p?.payload?.pct ?? 0}%)`, "มาบำบัด"]} />
                        <Line type="monotone" dataKey="count" stroke={C.dark} strokeWidth={2.5}
                            dot={{ r: 3, fill: C.dark }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Follow-up milestones */}
            <SectionCard title="การติดตามหลังบำบัด (Remission tracking)" icon={CalendarClock} titleColor={C.dark}>
                <p className="text-xs text-gray-400 mb-3">
                    ฐานคำนวณ: ผู้ที่บำบัดครบแล้ว {s.followUpMilestones[0]?.eligible ?? 0} ราย
                </p>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={s.followUpMilestones} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
                        <CartesianGrid vertical={false} stroke="#e8f5ee" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tip} formatter={(v, _n, p) => [`${v ?? 0} ราย (${p?.payload?.pct ?? 0}%)`, "ติดตามแล้ว"]} />
                        <Bar dataKey="attended" radius={[4, 4, 0, 0]} fill={C.teal} isAnimationActive={false} />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="สถานะการรักษาปัจจุบัน" icon={Activity} titleColor={C.dark}>
                    <Donut data={statusData} />
                </SectionCard>
                <SectionCard title="ระดับความรุนแรง (สี)" icon={ShieldCheck} titleColor={C.dark}>
                    <Donut data={colorData} />
                </SectionCard>
                <SectionCard title="ช่องทางการนำส่ง" icon={Users} titleColor={C.dark}>
                    <HBarList data={referralData} colors={PALETTE} labelWidth={90} />
                </SectionCard>
            </div>

            <SectionCard title="จำนวนผู้ป่วยแยกตำบล" icon={Users} titleColor={C.dark}>
                <HBarList data={tambonData} colors={PALETTE} total={s.total} />
            </SectionCard>
        </div>
    );
});

// ─── Patient Table ──────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: MiniThanRow[] }) {
    const [search, setSearch] = useState("");
    const filtered = rows.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.firstName.toLowerCase().includes(q) || r.lastName.toLowerCase().includes(q)
            || r.hn.includes(q) || r.tambon.toLowerCase().includes(q);
    });
    const { page, setPage, totalPages, paged, pageSize } = usePagination(filtered, 20);

    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e8f5ee] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Users size={15} style={{ color: C.green }} />
                    <p className="text-sm font-bold" style={{ color: C.dark }}>รายชื่อผู้ป่วยมินิธัญญารักษ์</p>
                    <span className="text-xs text-gray-400">{rows.length} ราย</span>
                </div>
                <input type="text" placeholder="ค้นหาชื่อ / HN / ตำบล..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-[#a8d5ba] rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-[#3aa36a]" />
            </div>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="sticky top-0" style={{ backgroundColor: C.dark }}>
                            {["#", "HN", "ชื่อ-สกุล", "อายุ", "ตำบล", "โปรแกรม", "สถานะ", "รายละเอียด", "สี", "V2",
                                "บำบัด (สัปดาห์)", "ติดตาม", "เริ่มบำบัด"].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-[#236b43] whitespace-nowrap">{h}</th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((r, i) => (
                            <tr key={`${r.hn}-${i}`} className={`border-b border-[#e8f5ee] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#f0faf4]"} hover:bg-[#e8f5ee]`}>
                                <td className="px-3 py-2 text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.prefix}{r.firstName} {r.lastName}</td>
                                <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.tambon}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.program || "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{
                                            background: r.treatStatus === "บำบัด" ? C.greenL : r.treatStatus === "จำหน่าย" ? C.blueL : C.amberL,
                                            color: r.treatStatus === "บำบัด" ? C.dark : r.treatStatus === "จำหน่าย" ? "#185FA5" : "#BA7517",
                                        }}>{r.treatStatus || "-"}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[10px] whitespace-nowrap">{r.detailStatus || "-"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ background: (COLOR_MAP[r.colorSeverity] ?? C.gray) + "22", color: COLOR_MAP[r.colorSeverity] ?? C.gray }}>
                                        {r.colorSeverity}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-700 text-center font-semibold tabular-nums">{r.v2Score ?? "-"}</td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${(r.lastWeekIndex / 16) * 100}%`, background: C.green }} />
                                        </div>
                                        <span className="text-[10px] text-gray-500 tabular-nums">{r.lastWeekIndex}/16</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums text-gray-600">{r.followUpAttended}/7</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.startDate || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <MiniPagination page={page} totalPages={totalPages} onChange={setPage} count={filtered.length} />
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function MiniThanDashboardPage() {
    const { data, loading, error, connected, secondsLeft, refetch } =
        useAutoRefresh<MiniThanDashboardData>("/api/minithan-sheets", REFRESH_INTERVAL_MS);
    const s = data?.summary;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="rounded-2xl shadow-sm overflow-hidden">
                <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 100%)` }}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-bold text-white">มินิธัญญารักษ์ — ติดตามการบำบัดยาเสพติด</h1>
                            <LiveBadge />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: C.midL }}>
                            รพ.พลับพลาชัย · โปรแกรม MP · อัปเดตทุก 30 วินาที
                            {data && <span className="ml-2">· อัปเดต {timeAgo(data.updatedAt)}</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-white/80">
                            <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
                            <span className="tabular-nums font-medium">{secondsLeft}s</span>
                        </div>
                        <RefreshButton loading={loading} onClick={refetch} />
                        <ConnectionStatus error={!!error} connected={connected && !!data} />
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และ MINITHAN_SPREADSHEET_ID ใน .env</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />)}
                </div>
            )}

            {/* KPI Cards */}
            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(s.total)} ราย`}
                        sub={`ใหม่ ${s.newPatients} · เก่า ${s.oldPatients}`} accent={C.dark} bg={C.darkL} />
                    <KpiCard icon={Activity} label="กำลังบำบัด" value={`${fmt(s.inTreatment)} ราย`}
                        sub={`ติดตาม ${s.followUp} · จำหน่าย ${s.discharged}`} accent={C.green} bg={C.greenL} />
                    <KpiCard icon={CheckCircle2} label="บำบัดครบ" value={`${fmt(s.treatComplete)} ราย`}
                        sub={`Dropout ${s.dropout} ราย`} accent={C.teal} bg={C.tealL} />
                    <KpiCard icon={HeartPulse} label="Retention Rate" value={`${s.retentionRate}%`}
                        sub="ติดตามต่อเนื่องหลังบำบัด" accent={C.blue} bg={C.blueL} />
                    <KpiCard icon={ShieldCheck} label="V2 เฉลี่ย" value={`${s.avgV2} pts`}
                        sub={`อายุเฉลี่ย ${s.avgAge} ปี`} accent={C.amber} bg={C.amberL} />
                    <KpiCard icon={Users} label="สัดส่วนเพศ" value={`${s.male} : ${s.female}`}
                        sub="ชาย : หญิง" accent={C.purple} bg={C.purpleL} />
                </div>
            )}

            {s && s.total > 0 && <DashboardCharts s={s} />}
            {data && data.rows.length > 0 && <PatientTable rows={data.rows} />}

            {/* Empty */}
            {!loading && !error && data && s?.total === 0 && (
                <div className="bg-[#f0faf4] border border-[#d6f0e0] rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
                    <Info size={24} style={{ color: C.green }} />
                    <p className="text-sm font-semibold" style={{ color: C.dark }}>ยังไม่มีข้อมูลผู้ป่วยมินิธัญญารักษ์ (MP)</p>
                    <p className="text-xs text-gray-500">ตรวจสอบว่าคอลัมน์ HW/IMC/MP ในชีตมีค่า MP และ Service Account มีสิทธิ์เข้าถึง</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1">Sheet: {data.sheetName}</p>
                </div>
            )}

            {/* AI */}
            <AiSummaryCard
                summary={s}
                context="Dashboard มินิธัญญารักษ์ (โปรแกรม MP) รพ.พลับพลาชัย — ติดตามผู้ป่วยยาเสพติดที่บำบัดแบบผู้ป่วยนอก เน้นการคงอยู่ในการบำบัด 16 สัปดาห์ (Retention) การติดตามหลังบำบัด 2สัปดาห์–1ปี (Remission) ระดับความรุนแรง (สี) และคะแนน V2"
                disabled={!s}
            />
        </div>
    );
}