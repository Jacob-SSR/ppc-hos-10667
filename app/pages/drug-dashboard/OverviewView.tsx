"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";
import {
  Info, Clock, Users, Activity, ShieldCheck, TrendingUp,
  AlertTriangle, CheckCircle2, Target,
} from "lucide-react";
import {
  useAutoRefresh, timeAgo, CountdownRing, KpiCard, HBarList,
  SectionCard, MiniPagination, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { usePagination } from "@/hooks/usePagination";
import type { DrugDashboardSummary, DrugSheetsDashboardData, DrugKpiItem } from "@/app/api/drug-sheets/route";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green: "#639922", greenL: "#EAF3DE", blue: "#378ADD", blueL: "#E6F1FB",
  amber: "#EF9F27", amberL: "#FAEEDA", red: "#E24B4A", redL: "#FCEBEB",
  teal: "#1D9E75", tealL: "#E1F5EE", coral: "#D85A30", purple: "#7F77DD",
  gray: "#888780", grayL: "#F1EFE8",
};
const COLOR_MAP: Record<string, string> = {
  เขียว: C.green, ส้ม: C.amber, แดง: C.red, เหลือง: "#f1c40f", ไม่ระบุ: C.gray,
};
const STATUS_COLORS = [C.blue, C.green, C.red, C.amber, C.purple];
const PROGRAM_COLORS = [C.green, C.blue, C.amber, C.teal, C.coral, C.purple];
const REFERRAL_COLORS = [C.blue, C.green, C.amber, C.coral, C.teal, C.red, C.purple, C.gray];

const REFRESH_INTERVAL_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("th-TH");

// ─── Shared chart helpers (declared at module level — not re-created on render) ──
const tip = { contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" } };

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

// ─── ตัวชี้วัด KPI (จากชีต "kpi") ────────────────────────────────────────────
const THAI_MONTH_SHORT: Record<string, string> = {
  มกราคม: "ม.ค.", กุมภาพันธ์: "ก.พ.", มีนาคม: "มี.ค.", เมษายน: "เม.ย.",
  พฤษภาคม: "พ.ค.", มิถุนายน: "มิ.ย.", กรกฎาคม: "ก.ค.", สิงหาคม: "ส.ค.",
  กันยายน: "ก.ย.", ตุลาคม: "ต.ค.", พฤศจิกายน: "พ.ย.", ธันวาคม: "ธ.ค.",
};
const shortMonth = (m: string) => THAI_MONTH_SHORT[m] ?? m;

function kpiColor(percent: number | null): { accent: string; bg: string } {
  if (percent == null) return { accent: C.gray, bg: C.grayL };
  if (percent >= 90) return { accent: C.green, bg: C.greenL };
  if (percent >= 70) return { accent: C.amber, bg: C.amberL };
  return { accent: C.red, bg: C.redL };
}

function DrugKpiIndicatorCard({ item }: { item: DrugKpiItem }) {
  // เดือนล่าสุดที่มีข้อมูล (ไล่จากท้ายมาหน้า)
  const filled = [...item.months].reverse().find((m) => m.percent != null) ?? item.months[item.months.length - 1];
  const { accent, bg } = kpiColor(filled?.percent ?? null);
  const barWidth = filled?.percent != null ? Math.min(Math.max(filled.percent, 0), 100) : 0;

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold leading-snug" style={{ color: accent }}>{item.name}</p>
        <Target size={16} style={{ color: accent }} className="shrink-0 mt-0.5" />
      </div>

      <div className="flex items-end gap-2">
        <p className="text-3xl font-extrabold tabular-nums" style={{ color: accent }}>
          {filled?.percent != null ? `${filled.percent}%` : "-"}
        </p>
        {filled && (
          <p className="text-[11px] pb-1" style={{ color: accent + "99" }}>{filled.month}</p>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: accent }} />
      </div>

      {filled && (filled.numerator != null || filled.denominator != null) && (
        <p className="text-[11px]" style={{ color: accent + "99" }}>
          {filled.numerator ?? "-"} / {filled.denominator ?? "-"} ราย
          {filled.formulaText ? ` · ${filled.formulaText}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t" style={{ borderColor: accent + "22" }}>
        {item.months.map((m) => (
          <span key={m.month} className="text-[10px]" style={{ color: accent + "99" }}>
            {shortMonth(m.month)} {m.percent != null ? `${m.percent}%` : "-"}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
const DashboardCharts = memo(function DashboardCharts({ s }: { s: DrugDashboardSummary }) {
  const colorData = Object.entries(s.byColor).filter(([k]) => k !== "ไม่ระบุ")
    .map(([name, value]) => ({ name, value, color: COLOR_MAP[name] ?? C.gray }));
  const statusData = Object.entries(s.byDetailStatus).sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({ name, value, color: STATUS_COLORS[i % STATUS_COLORS.length] }));
  const programData = Object.entries(s.byProgram).sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({ name, value, color: PROGRAM_COLORS[i % PROGRAM_COLORS.length] }));
  const referralData = Object.entries(s.byReferral).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];
  const tambonData = Object.entries(s.byTambon).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];
  const ageData = Object.entries(s.byAgeGroup).map(([name, value]) => ({ name, value }));
  const v2Data = Object.entries(s.byV2Group).map(([name, value], i) => ({
    name, value, color: [C.green, C.amber, C.coral, C.red][i],
  }));
  const genderData = [
    { name: `ชาย ${s.male}`, value: s.male, color: C.blue },
    { name: `หญิง ${s.female}`, value: s.female, color: C.teal },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="แนวโน้มผู้ป่วยรายเดือน (วันที่รับเข้าบำบัด)" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={s.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="drugGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip {...tip} formatter={(v) => [`${v ?? 0} ราย`, "จำนวน"]} />
            <Area type="monotone" dataKey="count" stroke={C.green} strokeWidth={2.5}
              fill="url(#drugGrad)" dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }}
              isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="สัดส่วนเพศ" icon={Users}><Donut data={genderData} /></SectionCard>
        <SectionCard title="สถานะการรักษา" icon={Activity}><Donut data={statusData} /></SectionCard>
        <SectionCard title="ระดับความรุนแรง (สี)" icon={ShieldCheck}><Donut data={colorData} /></SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="ประเภทโปรแกรมบำบัด" icon={Activity}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={programData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {programData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="ระดับการติดยา (คะแนน V2)" icon={AlertTriangle}>
          <p className="text-xs text-gray-400 mb-3">
            เฉลี่ย <strong className="text-gray-700">{s.avgV2}</strong> pts · ต่ำสุด {s.minV2} · สูงสุด {s.maxV2}
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={v2Data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {v2Data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="กลุ่มอายุ" icon={Users}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v ?? 0} ราย`]} {...tip} />
              <Bar dataKey="value" fill={C.blue} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="ตำบลที่พักอาศัย" icon={Activity}>
          <HBarList data={tambonData} colors={PROGRAM_COLORS} total={s.total} labelWidth={112} />
        </SectionCard>
        <SectionCard title="ช่องทางการนำส่ง" icon={TrendingUp}>
          <HBarList data={referralData} colors={REFERRAL_COLORS} total={s.total} labelWidth={112} />
        </SectionCard>
      </div>
    </div>
  );
});

// ─── Patient Table ────────────────────────────────────────────────────────────
function PatientTable({ rows }: { rows: DrugSheetsDashboardData["rows"] }) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.firstName.toLowerCase().includes(q) || r.lastName.toLowerCase().includes(q)
      || r.hn.includes(q) || r.tambon.toLowerCase().includes(q);
  });
  const { page, setPage, totalPages, paged, pageSize } = usePagination(filtered, 20);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-gray-400" />
          <p className="text-sm font-bold text-gray-600">รายชื่อผู้ป่วย</p>
          <span className="text-xs text-gray-400">{rows.length} ราย</span>
        </div>
        <input type="text" placeholder="ค้นหาชื่อ / HN / ตำบล..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-green-400" />
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-green-700 sticky top-0">
              {["#", "HN", "ชื่อ-สกุล", "อายุ", "ตำบล", "โปรแกรม", "สถานะ", "รายละเอียด", "สี", "V2", "วันเริ่มบำบัด"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={`${r.hn}-${i}`} className={`border-b border-gray-100 hover:bg-green-50/40 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="px-3 py-2 text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn}</td>
                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.prefix}{r.firstName} {r.lastName}</td>
                <td className="px-3 py-2 text-gray-600 text-center">{r.age || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.tambon || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.program || "-"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: r.treatStatus === "บำบัด" ? "#EAF3DE" : r.treatStatus === "จำหน่าย" ? "#E6F1FB" : "#FAEEDA",
                      color: r.treatStatus === "บำบัด" ? "#639922" : r.treatStatus === "จำหน่าย" ? "#185FA5" : "#BA7517",
                    }}>{r.treatStatus || "-"}</span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-[10px]">{r.detailStatus || "-"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: (COLOR_MAP[r.colorSeverity] ?? C.gray) + "22", color: COLOR_MAP[r.colorSeverity] ?? C.gray }}>
                    {r.colorSeverity}</span>
                </td>
                <td className="px-3 py-2 text-gray-700 text-center font-semibold tabular-nums">{r.v2Score || "-"}</td>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DrugDashboardOverview() {
  const { data, loading, error, connected, secondsLeft, refetch } =
    useAutoRefresh<DrugSheetsDashboardData>("/api/drug-sheets", REFRESH_INTERVAL_MS);
  const s = data?.summary;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-800">Dashboard ผู้ป่วยยาเสพติด</h1>
            <LiveBadge />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
            {data && (<><span>·</span><Clock size={11} /><span>อัปเดต {timeAgo(data.updatedAt)}</span>
              <span>·</span><span>Sheet: {data.sheetName}</span></>)}
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
            <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และ DRUG_SPREADSHEET_ID ใน .env</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {/* ตัวชี้วัดผลการดำเนินงาน (KPI กระทรวงสาธารณสุข) */}
      {data?.kpi && data.kpi.items.length > 0 && (
        <SectionCard title={data.kpi.title} icon={Target} titleColor="#1a5233">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.kpi.items.map((item) => (
              <DrugKpiIndicatorCard key={item.name} item={item} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={Users} label="ผู้ป่วยทั้งหมด" value={`${fmt(s.total)} ราย`}
            sub={`ใหม่ ${s.newPatients} · เก่า ${s.oldPatients}`} accent={C.blue} bg={C.blueL} />
          <KpiCard icon={Activity} label="กำลังบำบัด" value={`${fmt(s.inTreatment)} ราย`}
            sub={`Retention ${s.retentionRate}%`} accent={C.green} bg={C.greenL} />
          <KpiCard icon={CheckCircle2} label="treat ครบ / ติดตาม" value={`${fmt(s.treatComplete + s.followUp)} ราย`}
            sub={`จำหน่าย ${s.discharged} · Dropout ${s.dropout}`} accent={C.amber} bg={C.amberL} />
          <KpiCard icon={ShieldCheck} label="V2 เฉลี่ย" value={`${s.avgV2} pts`}
            sub={`min ${s.minV2} · max ${s.maxV2}`} accent={C.teal} bg={C.tealL} />
          <KpiCard icon={TrendingUp} label="อายุเฉลี่ย" value={`${s.avgAge} ปี`}
            sub={`ชาย ${s.male} · หญิง ${s.female} ราย`} accent={C.purple} bg="#EEEDFE" />
        </div>
      )}

      {s && s.total > 0 && <DashboardCharts s={s} />}
      {data && data.rows.length > 0 && <PatientTable rows={data.rows} />}

      {/* Empty */}
      {!loading && !error && data && s?.total === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Info size={32} className="text-amber-500" />
          <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
          <p className="text-xs text-amber-700">เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที</p>
          <p className="text-[11px] text-gray-400 font-mono mt-1">Sheet: {data.sheetName}</p>
        </div>
      )}

      {/* AI */}
      <AiSummaryCard
        summary={s}
        context="Dashboard ผู้ป่วยยาเสพติด โรงพยาบาลพลับพลาชัย (สถานะการบำบัด ระดับความรุนแรง โปรแกรมบำบัด คะแนน V2 กลุ่มอายุ ตำบล)"
        disabled={!s}
      />
    </div >
  );
}