"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  RefreshCw, Info, UploadCloud, CheckCircle2, XCircle,
  AlertTriangle, TrendingUp, Shield, Car, Users, Activity,
} from "lucide-react";
import { useRef } from "react";

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
  updatedAt: string; sheetName: string; summary: AccidentSummary;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const SEVERITY_COLOR: Record<string, string> = {
  "Dead": "#A32D2D", "Resuscitation": "#791F1F", "Emergency": "#E24B4A",
  "Urgent": "#BA7517", "semi - urgent": "#378ADD", "non - urgent": "#639922",
};
const STATUS_COLOR: Record<string, string> = {
  "Dead": "#A32D2D", "Admit": "#185FA5", "D/C": "#3B6D11",
  "follow up": "#854F0B",
};
const VEHICLE_COLOR: Record<string, string> = {
  "จักรยานยนต์": "#EF9F27", "ผู้โดยสาร": "#85B7EB",
  "รถยนต์ 4 ล้อ": "#97C459", "เดินทางเท้า": "#888780", "จักรยาน": "#D4537E",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toThaiDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const thaiMonths = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`;
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

function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true); setResult(null);
    const form = new FormData(); form.append("file", file);
    try {
      const res = await fetch("/api/accident-upload", { method: "POST", body: form, credentials: "include" });
      const json = await res.json();
      setResult({ ok: json.success, msg: json.message ?? json.error });
      if (json.success) setTimeout(onSuccess, 600);
    } catch { setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" }); }
    finally { setUploading(false); }
  }, [onSuccess]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูลอุบัติเหตุ</h4>
        <span className="text-[11px] text-gray-400">accident.xlsx</span>
      </div>
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa", scale: dragging ? 1.01 : 1 }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center gap-2 py-6 select-none"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
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
              <UploadCloud size={28} style={{ color: dragging ? "#3aa36a" : "#9ca3af" }} />
              <p className="text-sm font-semibold text-gray-600">{dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}</p>
              <p className="text-xs text-gray-400">ไฟล์ Excel ข้อมูลอุบัติเหตุ RTI</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AccidentDashboardPage() {
  const [data, setData] = useState<AccidentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setNoFile(false);
    try {
      const res = await fetch("/api/accident-dashboard", { credentials: "include" });
      if (res.status === 404) { setNoFile(true); setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const order = ["00:00–04:00","04:00–08:00","08:00–12:00","12:00–16:00","16:00–20:00","20:00–24:00"];
    const raw = s?.byTimeSlot ?? {};
    return order.map((t) => ({ t, count: raw[t] ?? 0 }));
  }, [s]);

  const dayData = useMemo(() =>
    (s?.byDay ?? []).map((d) => ({ label: toThaiDate(d.date).slice(0, 6), count: d.count, date: d.date })),
    [s]);

  const shimmer = <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            Dashboard อุบัติเหตุทางถนน (RTI)
            {data?.sheetName && (
              <span className="ml-2 text-sm font-normal text-gray-400">— {data.sheetName}</span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            ข้อมูลอุบัติเหตุทางถนน · ไม่แสดงชื่อ-นามสกุลผู้ป่วย
            {data && <span className="ml-2">· อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}</span>}
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}>
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
            <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel ข้อมูลอุบัติเหตุ RTI ด้านล่าง</p>
          </div>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">⚠️ {error}</div>}

      {/* KPI Cards */}
      {(loading || s) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />)
            : s && (
              <>
                <KpiCard icon={Users} label="ผู้บาดเจ็บทั้งหมด" value={fmt(s.total)} sub="ราย" accent="#0369A1" bg="#E0F2FE" />
                <KpiCard icon={AlertTriangle} label="เสียชีวิต" value={fmt(s.dead)} sub={`${fmtB((s.dead / s.total) * 100)}%`} accent="#A32D2D" bg="#FCEBEB" />
                <KpiCard icon={Activity} label="Admit" value={fmt(s.admit)} sub={`${fmtB((s.admit / s.total) * 100)}%`} accent="#185FA5" bg="#E6F1FB" />
                <KpiCard icon={TrendingUp} label="Refer รพ.อื่น" value={fmt(s.refer)} sub={`${fmtB((s.refer / s.total) * 100)}%`} accent="#854F0B" bg="#FAEEDA" />
                <KpiCard icon={Users} label="กลับบ้าน (D/C)" value={fmt(s.dc)} sub={`${fmtB((s.dc / s.total) * 100)}%`} accent="#3B6D11" bg="#EAF3DE" />
                <KpiCard icon={Car} label="จักรยานยนต์" value={fmt(s.motorcycleCount)} sub={`${fmtB((s.motorcycleCount / s.total) * 100)}%`} accent="#854F0B" bg="#FAEEDA" />
                <KpiCard icon={AlertTriangle} label="ดื่มแล้วขับ" value={fmt(s.drinkCount)} sub={`${fmtB((s.drinkCount / s.total) * 100)}%`} accent="#A32D2D" bg="#FCEBEB" />
                <KpiCard icon={Shield} label="อายุเฉลี่ย" value={`${s.avgAge} ปี`} sub={`${s.minAge}–${s.maxAge} ปี`} accent="#185FA5" bg="#E6F1FB" />
              </>
            )}
        </div>
      )}

      {/* Charts row 1 */}
      {s && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Daily trend */}
          <SectionCard title="จำนวนผู้บาดเจ็บรายวัน">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [v + " ราย", "ผู้บาดเจ็บ"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="count" fill="#378ADD" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Age x sex */}
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
          {/* Severity */}
          <SectionCard title="ระดับความรุนแรง">
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
          </SectionCard>

          {/* Vehicle */}
          <SectionCard title="ประเภทพาหนะ">
            <HBarChart data={vehicleData} colorMap={VEHICLE_COLOR} />
          </SectionCard>

          {/* Time slot */}
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
          {/* Tambon */}
          <SectionCard title="ตำบลที่เกิดเหตุ">
            <HBarChart data={tambonData} />
          </SectionCard>

          {/* Protection + Alcohol */}
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
                    { label: "ไม่ดื่ม", count: s.total - s.drinkCount - 2, color: "#639922" },
                    { label: "ดื่ม", count: s.drinkCount, color: "#A32D2D" },
                    { label: "ไม่ทราบ", count: 2, color: "#888780" },
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
                          animate={{ width: `${(d.count / s.total) * 100}%` }}
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

      {/* Upload */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}