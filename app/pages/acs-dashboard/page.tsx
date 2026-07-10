"use client";

import { useState, memo } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
} from "recharts";
import {
  Info, Clock, Users, Activity, HeartPulse, Zap, Ambulance,
  Target, Cigarette, ClipboardList,
} from "lucide-react";
import {
  useAutoRefresh, timeAgo, CountdownRing, KpiCard, HBarList,
  SectionCard, MiniPagination, LiveBadge, ConnectionStatus, RefreshButton,
} from "@/app/components/dashboard/live";
import { usePagination } from "@/hooks/usePagination";
import type { AcsSheetsData, AcsPatient } from "@/app/api/acs-sheets/route";
import AiSummaryCard from "@/app/components/ai/AiSummaryCard";

// ─── Colors (ชุดเดียวกับ drug/sepsis) ────────────────────────────────────────
const C = {
  green: "#639922", greenL: "#EAF3DE", blue: "#378ADD", blueL: "#E6F1FB",
  amber: "#EF9F27", amberL: "#FAEEDA", red: "#E24B4A", redL: "#FCEBEB",
  teal: "#1D9E75", tealL: "#E1F5EE", coral: "#D85A30", purple: "#7F77DD",
  gray: "#888780", grayL: "#F1EFE8",
};
const DX_COLOR_MAP: Record<string, string> = {
  STEMI: C.red, NSTEMI: C.amber, ไม่ระบุ: C.gray,
};
const BAR_COLORS = [C.blue, C.green, C.amber, C.teal, C.coral, C.purple, C.red, C.gray];

const REFRESH_INTERVAL_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("th-TH");

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

// ─── ตาราง KPI (แสดงตามชีตเลย — หน้างานคีย์เอง) ─────────────────────────────
function KpiSheetTable({ rows }: { rows: string[][] }) {
  const isBlank = (r: string[]) => r.every((c) => c === "");
  const isHeader = (r: string[]) =>
    r.some((c) => /^25\d{2}$/.test(c)) || r.includes("เป้าหมาย");

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <tbody>
          {rows.map((r, i) =>
            isBlank(r) ? (
              <tr key={i}><td colSpan={12} className="h-3" /></tr>
            ) : (
              <tr key={i}
                className={isHeader(r)
                  ? "bg-red-700 text-white font-semibold"
                  : i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {r.map((c, j) => (
                  <td key={j}
                    className={`border border-gray-100 px-3 py-2 ${j === 0
                      ? "min-w-[280px] max-w-[420px] whitespace-pre-wrap text-left"
                      : "whitespace-nowrap text-center tabular-nums"
                      }`}>
                    {c}
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-400">
        * ค่าตัวชี้วัดแสดงตามที่หน่วยงานคีย์ในชีต &quot;KPI&quot; โดยตรง
      </p>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
const DashboardCharts = memo(function DashboardCharts({ s }: { s: AcsSheetsData["summary"] }) {
  const dxData = Object.entries(s.byDiagnosis).sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({
      name, value, color: DX_COLOR_MAP[name.toUpperCase()] ?? BAR_COLORS[i % BAR_COLORS.length],
    }));
  const outcomeData = Object.entries(s.byOutcome).sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({ name, value, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const firstUnitData = Object.entries(s.byFirstUnit).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];
  const areaData = Object.entries(s.byArea).sort(([, a], [, b]) => b - a).slice(0, 8) as [string, number][];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SectionCard title="Diagnosis" icon={HeartPulse}><Donut data={dxData} /></SectionCard>
      <SectionCard title="Outcome" icon={Activity}><Donut data={outcomeData} /></SectionCard>
      <SectionCard title="หน่วยบริการแรกรับ" icon={ClipboardList}>
        <HBarList data={firstUnitData} colors={BAR_COLORS} total={s.total} labelWidth={112} />
      </SectionCard>
      <SectionCard title="เขตที่อยู่อาศัย" icon={Users}>
        <HBarList data={areaData} colors={BAR_COLORS} total={s.total} labelWidth={112} />
      </SectionCard>
    </div>
  );
});

// ─── Patient Table ────────────────────────────────────────────────────────────
function dxBadgeStyle(dx: string) {
  const up = dx.toUpperCase();
  if (up.includes("NSTEMI")) return { background: C.amberL, color: "#BA7517" };
  if (up.includes("STEMI")) return { background: C.redL, color: C.red };
  return { background: C.grayL, color: C.gray };
}

function PatientTable({ rows }: { rows: AcsPatient[] }) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.hn.includes(q)
      || r.area.toLowerCase().includes(q) || r.diagnosis.toLowerCase().includes(q);
  });
  const { page, setPage, totalPages, paged, pageSize } = usePagination(filtered, 20);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-gray-400" />
          <p className="text-sm font-bold text-gray-600">ทะเบียนผู้ป่วย ACS</p>
          <span className="text-xs text-gray-400">{rows.length} ราย</span>
        </div>
        <input type="text" placeholder="ค้นหาชื่อ / HN / เขต / Diagnosis..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-52 focus:outline-none focus:border-red-400" />
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-red-700 sticky top-0">
              {["#", "HN", "ชื่อ-สกุล", "อายุ", "โรคประจำตัว", "สูบบุหรี่", "วันที่รับบริการ", "แรกรับ",
                "Onset", "EKG (นาที)", "Diagnosis", "TropT", "SK", "เวลาให้ SK", "สถานะ", "ส่งตัวไป", "เขตที่อยู่", "Outcome"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-red-600 whitespace-nowrap">{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={`${r.hn}-${i}`}
                className={`border-b border-gray-100 hover:bg-red-50/40 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="px-3 py-2 text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                <td className="px-3 py-2 text-gray-500 font-mono">{r.hn || "-"}</td>
                <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 text-gray-600 text-center">{r.age ?? "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={r.underlying}>{r.underlying || "-"}</td>
                <td className="px-3 py-2 text-gray-600 text-center">{r.smoking || "-"}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.serviceDate || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.firstUnit || "-"}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.onsetTime || "-"}</td>
                <td className="px-3 py-2 text-gray-700 text-center font-semibold tabular-nums">{r.ekgMin ?? "-"}</td>
                <td className="px-3 py-2">
                  {r.diagnosis && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={dxBadgeStyle(r.diagnosis)}>{r.diagnosis}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.tropT || "-"}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={/^y/i.test(r.skGiven)
                      ? { background: C.greenL, color: C.green }
                      : { background: C.grayL, color: C.gray }}>
                    {r.skGiven || "-"}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.skTime || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.status || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={r.referUnit}>{r.referUnit || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.area || "-"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={r.outcome}>{r.outcome || "-"}</td>
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
export default function AcsDashboardPage() {
  const [year, setYear] = useState("");
  const { data, loading, error, connected, secondsLeft, refetch } =
    useAutoRefresh<AcsSheetsData>(`/api/acs-sheets${year ? `?year=${year}` : ""}`, REFRESH_INTERVAL_MS);
  const s = data?.summary;
  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "-");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-800">Dashboard โรคหลอดเลือดหัวใจ (ACS)</h1>
            <LiveBadge />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
            {data && (<><span>·</span><Clock size={11} /><span>อัปเดต {timeAgo(data.updatedAt)}</span>
              <span>·</span><span>ปี {data.year}</span></>)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={data?.year ?? year}
            onChange={(e) => setYear(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-400">
            {(data?.availableYears ?? []).map((y) => (
              <option key={y} value={y}>ปี {y}</option>
            ))}
          </select>
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
            <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY และ ACS_SPREADSHEET_ID ใน .env</p>
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
          <KpiCard icon={Users} label={`ผู้ป่วย ACS ปี ${data!.year}`} value={`${fmt(s.total)} ราย`}
            sub={`อายุเฉลี่ย ${s.avgAge ?? "-"} ปี`} accent={C.blue} bg={C.blueL} />
          <KpiCard icon={HeartPulse} label="STEMI" value={`${fmt(s.stemi)} ราย`}
            sub={pct(s.stemi, s.total)} accent={C.red} bg={C.redL} />
          <KpiCard icon={Activity} label="NSTEMI" value={`${fmt(s.nstemi)} ราย`}
            sub={pct(s.nstemi, s.total)} accent={C.amber} bg={C.amberL} />
          <KpiCard icon={Zap} label="ได้รับยา SK" value={`${fmt(s.skGiven)} ราย`}
            sub={pct(s.skGiven, s.total)} accent={C.green} bg={C.greenL} />
          <KpiCard icon={Target} label="EKG ≤ 10 นาที" value={`${s.ekgWithin10}/${s.ekgRecorded}`}
            sub={pct(s.ekgWithin10, s.ekgRecorded)} accent={C.teal} bg={C.tealL} />
          <KpiCard icon={Ambulance} label="Refer" value={`${fmt(s.refer)} ราย`}
            sub={`สูบบุหรี่ ${s.smoking} · 1669 ${s.ems1669}`} accent={C.purple} bg="#EEEDFE" />
        </div>
      )}

      {/* ตัวชี้วัด KPI จากชีต */}
      {data && data.kpiRows.length > 0 && (
        <SectionCard title="ตัวชี้วัด (KPI) — ตามข้อมูลที่หน่วยงานคีย์" icon={Target} titleColor="#991b1b">
          <KpiSheetTable rows={data.kpiRows} />
        </SectionCard>
      )}

      {s && s.total > 0 && <DashboardCharts s={s} />}
      {data && data.rows.length > 0 && <PatientTable rows={data.rows} />}

      {/* Empty */}
      {!loading && !error && data && s?.total === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Info size={32} className="text-amber-500" />
          <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลผู้ป่วยในปี {data.year}</p>
          <p className="text-xs text-amber-700">เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที</p>
        </div>
      )}

      {/* AI */}
      <AiSummaryCard
        summary={s}
        context={`Dashboard โรคหลอดเลือดหัวใจ ACS โรงพยาบาลพลับพลาชัย ปี ${data?.year ?? ""} (STEMI/NSTEMI การให้ยา SK เวลาทำ EKG หน่วยบริการแรกรับ เขตที่อยู่ Outcome)`}
        disabled={!s}
      />
    </div>
  );
}