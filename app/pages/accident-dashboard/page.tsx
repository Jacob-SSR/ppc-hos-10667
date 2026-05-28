"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  RefreshCw, Info, AlertTriangle, TrendingUp, Shield, Car, Users, Activity,
  Wifi, WifiOff, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccidentSummary {
  total: number; dead: number; admit: number; refer: number; dc: number; followUp: number;
  avgAge: number; minAge: number; maxAge: number; male: number; female: number;
  drinkCount: number; motorcycleCount: number; helmetWorn: number; helmetNot: number;
  byVehicle: Record<string, number>;
  bySeverity: Record<string, number>;
  byTambon: Record<string, number>;
  byTimeSlot: Record<string, number>;
  byStatus: Record<string, number>;
  byProtection: Record<string, number>;
  byAgeGroup: { group: string; male: number; female: number }[];
  byDay: { date: string; count: number }[];
  byRoad: Record<string, number>;
}

interface AccidentDashboardData {
  updatedAt: string;
  sheetName: string;
  summary: AccidentSummary;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000; // auto-refresh ทุก 30 วินาที

const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const SEVERITY_COLOR: Record<string, string> = {
  "Dead": "#A32D2D", "Resuscitation": "#791F1F", "Emergency": "#E24B4A",
  "Urgent": "#BA7517", "semi - urgent": "#378ADD", "non - urgent": "#639922",
};
const VEHICLE_COLOR: Record<string, string> = {
  "จักรยานยนต์": "#EF9F27", "ผู้โดยสาร": "#85B7EB",
  "รถยนต์ 4 ล้อ": "#97C459", "เดินทางเท้า": "#888780", "จักรยาน": "#D4537E",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toThaiDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const thaiMonths = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, bg }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string; bg: string;
}) {
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent + "22" }}>
        <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>{label}</p>
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: accent + "99" }}>{sub}</p>}
    </motion.div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <p className="text-sm font-bold text-gray-600 mb-4">{title}</p>
      {children}
    </div>
  );
}

function HBarChart({ data, colorMap }: {
  data: { label: string; count: number }[];
  colorMap?: Record<string, string>;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const color = colorMap?.[d.label] ?? "#85B7EB";
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 text-right shrink-0" style={{ width: 110 }}>
              {d.label}
            </span>
            <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-gray-700 shrink-0 w-6">{d.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const pct = secondsLeft / total;
  const r = 10;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" className="-rotate-90">
      <circle cx={14} cy={14} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
      <circle cx={14} cy={14} r={r} fill="none" stroke="#3aa36a" strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AccidentDashboardPage() {
  const [data, setData] = useState<AccidentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accident-sheets", { credentials: "include" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
    // รีเซ็ต countdown
    setSecondsLeft(REFRESH_INTERVAL_MS / 1000);
  }, []);

  // auto-refresh
  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? REFRESH_INTERVAL_MS / 1000 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const s = data?.summary;

  const severityData = useMemo(() =>
    Object.entries(s?.bySeverity ?? {})
      .map(([label, count]) => ({ label, count, color: SEVERITY_COLOR[label] ?? "#85B7EB" }))
      .sort((a, b) => b.count - a.count),
    [s]);

  const vehicleData = useMemo(() =>
    Object.entries(s?.byVehicle ?? {})
      .map(([label, count]) => ({ label, count, color: VEHICLE_COLOR[label] ?? "#888780" }))
      .sort((a, b) => b.count - a.count),
    [s]);

  const tambonData = useMemo(() =>
    Object.entries(s?.byTambon ?? {})
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    [s]);

  const timeSlotData = useMemo(() => {
    const order = ["00:00–04:00", "04:00–08:00", "08:00–12:00", "12:00–16:00", "16:00–20:00", "20:00–24:00"];
    const raw = s?.byTimeSlot ?? {};
    return order.map((t) => ({ t, count: raw[t] ?? 0 }));
  }, [s]);

  const dayData = useMemo(() =>
    (s?.byDay ?? []).map((d) => ({ label: toThaiDate(d.date).slice(0, 6), count: d.count })),
    [s]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-800">
              Dashboard อุบัติเหตุทางถนน (RTI)
            </h1>
            {/* Live badge */}
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
              style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              LIVE
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            <span>ดึงข้อมูลจาก Google Sheets แบบ Real-time</span>
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
          {/* Countdown */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CountdownRing secondsLeft={secondsLeft} total={REFRESH_INTERVAL_MS / 1000} />
            <span className="tabular-nums font-medium">{secondsLeft}s</span>
          </div>

          <button onClick={() => fetchData()} disabled={loading}
            className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
              <RefreshCw size={14} />
            </motion.span>
            รีเฟรช
          </button>

          {/* Connection status */}
          {error
            ? <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><WifiOff size={13} />ไม่เชื่อมต่อ</span>
            : data
              ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Wifi size={13} />เชื่อมต่อแล้ว</span>
              : null}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">ไม่สามารถดึงข้อมูลได้</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <p className="text-xs text-gray-400 mt-1">ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ใน .env</p>
          </div>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard icon={Users} label="ผู้บาดเจ็บทั้งหมด" value={fmt(s.total)} sub="ราย" accent="#0369A1" bg="#E0F2FE" />
          <KpiCard icon={AlertTriangle} label="เสียชีวิต" value={fmt(s.dead)}
            sub={s.total > 0 ? `${fmtB((s.dead / s.total) * 100)}%` : "0%"} accent="#A32D2D" bg="#FCEBEB" />
          <KpiCard icon={Activity} label="Admit" value={fmt(s.admit)}
            sub={s.total > 0 ? `${fmtB((s.admit / s.total) * 100)}%` : "0%"} accent="#185FA5" bg="#E6F1FB" />
          <KpiCard icon={TrendingUp} label="Refer รพ.อื่น" value={fmt(s.refer)}
            sub={s.total > 0 ? `${fmtB((s.refer / s.total) * 100)}%` : "0%"} accent="#854F0B" bg="#FAEEDA" />
          <KpiCard icon={Users} label="กลับบ้าน (D/C)" value={fmt(s.dc)}
            sub={s.total > 0 ? `${fmtB((s.dc / s.total) * 100)}%` : "0%"} accent="#3B6D11" bg="#EAF3DE" />
          <KpiCard icon={Car} label="จักรยานยนต์" value={fmt(s.motorcycleCount)}
            sub={s.total > 0 ? `${fmtB((s.motorcycleCount / s.total) * 100)}%` : "0%"} accent="#854F0B" bg="#FAEEDA" />
          <KpiCard icon={AlertTriangle} label="ดื่มแล้วขับ" value={fmt(s.drinkCount)}
            sub={s.total > 0 ? `${fmtB((s.drinkCount / s.total) * 100)}%` : "0%"} accent="#A32D2D" bg="#FCEBEB" />
          <KpiCard icon={Shield} label="อายุเฉลี่ย" value={`${s.avgAge} ปี`}
            sub={`${s.minAge}–${s.maxAge} ปี`} accent="#185FA5" bg="#E6F1FB" />
        </div>
      )}

      {/* Charts row 1 */}
      {s && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="จำนวนผู้บาดเจ็บรายวัน">
            {dayData.length === 0
              ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v + " ราย", "ผู้บาดเจ็บ"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="count" fill="#378ADD" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </SectionCard>

          <SectionCard title="กลุ่มอายุแยกเพศ">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.byAgeGroup} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%" barGap={2}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Bar dataKey="male" name="ชาย" fill="#378ADD" radius={[3, 3, 0, 0]} />
                <Bar dataKey="female" name="หญิง" fill="#ED93B1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#378ADD" }} />ชาย {s.male} ราย</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#ED93B1" }} />หญิง {s.female} ราย</span>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Charts row 2 */}
      {s && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard title="ระดับความรุนแรง">
            {severityData.length === 0
              ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
              : (
                <div className="flex flex-col items-center">
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={severityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          dataKey="count" paddingAngle={2}>
                          {severityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number, n: string) => [v + " ราย", n]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-1.5 mt-2">
                    {severityData.map((d) => (
                      <div key={d.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                          <span className="text-gray-600">{d.label}</span>
                        </span>
                        <span className="font-bold text-gray-800 tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </SectionCard>

          <SectionCard title="ประเภทพาหนะ">
            {vehicleData.length === 0
              ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
              : <HBarChart data={vehicleData} colorMap={VEHICLE_COLOR} />}
          </SectionCard>

          <SectionCard title="ช่วงเวลาที่เกิดเหตุ">
            <div className="space-y-2">
              {timeSlotData.map((d) => {
                const max = Math.max(...timeSlotData.map((x) => x.count), 1);
                const pct = (d.count / max) * 100;
                const hot = d.t === "12:00–16:00";
                return (
                  <div key={d.t} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 text-right shrink-0 font-mono" style={{ width: 95 }}>{d.t}</span>
                    <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden">
                      <motion.div className="h-full rounded"
                        style={{ backgroundColor: hot ? "#EF9F27" : "#85B7EB" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 tabular-nums shrink-0 w-5">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Charts row 3 */}
      {s && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="ตำบลที่เกิดเหตุ">
            {tambonData.length === 0
              ? <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
              : <HBarChart data={tambonData} />}
          </SectionCard>

          <SectionCard title="การป้องกันและปัจจัยเสี่ยง">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-3">การสวมหมวก/เข็มขัด</p>
                <HBarChart
                  data={Object.entries(s.byProtection)
                    .map(([label, count]) => ({ label, count }))
                    .sort((a, b) => b.count - a.count)}
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-3">การดื่มสุรา</p>
                <div className="space-y-3 mt-1">
                  {[
                    { label: "ไม่ดื่ม", count: Math.max(0, s.total - s.drinkCount), color: "#639922" },
                    { label: "ดื่ม", count: s.drinkCount, color: "#A32D2D" },
                  ].map((d) => (
                    <div key={d.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.label}</span>
                        <span className="font-bold tabular-nums" style={{ color: d.color }}>{d.count} ราย</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ backgroundColor: d.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.total > 0 ? (d.count / s.total) * 100 : 0}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400 font-medium mt-5 mb-3">ประเภทถนน</p>
                <HBarChart
                  data={Object.entries(s.byRoad)
                    .map(([label, count]) => ({ label, count }))
                    .sort((a, b) => b.count - a.count)}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && s?.total === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Info size={32} className="text-amber-500" />
          <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูลใน Spreadsheet</p>
          <p className="text-xs text-amber-700">เพิ่มข้อมูลลงใน Google Sheets แล้ว Dashboard จะอัปเดตอัตโนมัติทุก 30 วินาที</p>
          <p className="text-[11px] text-gray-400 font-mono mt-1">
            ID: 1XlHb3jU93RzZ7kkE-LY1vL2sFRTiesh2nxRw9vGDeWY
          </p>
        </div>
      )}
    </div>
  );
}