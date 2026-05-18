"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";
import {
  UploadCloud, CheckCircle2, XCircle, RefreshCw, Building2, MapPin,
  TrendingUp, AlertTriangle, BadgeCheck, Info,
} from "lucide-react";
import type { BillingDashboardData, BillingUnitSummary, BillingItemSummary } from "@/types/allTypes";
import BillingCrossTab from "./BillingCrossTab";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("th-TH");

function pctBar(value: number, max: number, color: string) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-gray-400 min-w-[36px] text-right">{Math.round(pct)}%</span>
    </div>
  );
}

// ── Upload Dropzone ───────────────────────────────────────────────────────────
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
      const res = await fetch("/api/billing-upload", { method: "POST", body: form, credentials: "include" });
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
        <h4 className="text-sm font-bold text-[#717171]">อัปโหลดข้อมูลการเบิกจ่าย</h4>
        <span className="text-[11px] text-gray-400">billing.xlsx</span>
      </div>
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{ borderColor: dragging ? "#3aa36a" : "#d1d5db", backgroundColor: dragging ? "#f0faf4" : "#fafafa", scale: dragging ? 1.01 : 1 }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 py-6 px-4 select-none"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={28} className="text-green-600" />
              </motion.div>
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
              <p className="text-xs text-gray-400">.xlsx จาก หมอพร้อม / DMOR เท่านั้น</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, bg }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string; bg: string;
}) {
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: bg }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + "22" }}>
        <Icon size={20} style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-xs font-bold tracking-wide" style={{ color: accent }}>{label}</p>
        <p className="text-xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: accent + "99" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Item Table ────────────────────────────────────────────────────────────────
function ItemTable({ items }: { items: BillingItemSummary[] }) {
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
            const baseColor = i % 2 === 0 ? "#ffffff" : "#f9fafb";
            const remarks = Object.entries(item.หมายเหตุ);
            return (
              <tr key={i} className="border-b border-gray-100 transition-colors" style={{ backgroundColor: baseColor }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0faf4")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = baseColor)}
              >
                <td className="px-3 py-2 text-gray-800 max-w-[280px]">
                  <div className="font-medium">{item.รายการสั้น}</div>
                  <div className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{item.รายการขอเบิก}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {item.สถานะ}
                  </span>
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

// ── Unit Card ─────────────────────────────────────────────────────────────────
function UnitCard({ unit }: { unit: BillingUnitSummary }) {
  const [open, setOpen] = useState(unit.isHospital);
  const compRate = unit.อัตราชดเชย;
  const rateColor = compRate >= 90 ? "#3B6D11" : compRate >= 60 ? "#854F0B" : "#A32D2D";

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unit.isHospital ? "bg-blue-50" : "bg-green-50"}`}>
          {unit.isHospital
            ? <Building2 size={18} className="text-blue-700" strokeWidth={1.8} />
            : <MapPin size={18} className="text-green-700" strokeWidth={1.8} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{unit.หน่วยบริการ}</p>
          <p className="text-[11px] text-gray-400">HCODE {unit.hcodeKey} · {fmt(unit.รายการทั้งหมด)} รายการ</p>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-gray-400 font-medium">เรียกเก็บ</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums">{fmt(unit.เรียกเก็บ)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">ชดเชย</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>{fmt(unit.ชดเชย)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">อัตรา</p>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: rateColor }}>{compRate}%</p>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4">
              {/* Rate bar */}
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
                <span className="text-xs font-bold tabular-nums" style={{ color: rateColor }}>
                  {compRate}% ชดเชย
                </span>
              </div>
              <ItemTable items={unit.items} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BillingBarChart({ units }: { units: BillingUnitSummary[] }) {
  const data = units.map((u) => ({
    name: u.หน่วยบริการ.replace("โรงพยาบาล", "รพ.").replace("รพ.สต.", "รพสต."),
    เรียกเก็บ: u.เรียกเก็บ,
    ชดเชย: u.ชดเชย,
    ไม่ชดเชย: u.ไม่ชดเชย + (u.เรียกเก็บ - u.ชดเชย - u.ไม่ชดเชย),
    isHospital: u.isHospital,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <h4 className="text-sm font-bold text-gray-600 mb-4">เรียกเก็บ vs ชดเชย — แยกตามหน่วยบริการ</h4>
      <div className="flex gap-4 mb-3 flex-wrap">
        {[{ color: "#85B7EB", label: "เรียกเก็บ" }, { color: "#97C459", label: "ชดเชย" }, { color: "#F09595", label: "ยังไม่ได้รับ" }].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            formatter={(v) => [fmt(Number(v ?? 0)) + " ฿"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="เรียกเก็บ" fill="#85B7EB" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ชดเชย" fill="#97C459" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ไม่ชดเชย" radius={[3, 3, 0, 0]}>
            {data.map((entry: { ไม่ชดเชย: number }, i: number) => (
              <Cell key={i} fill={entry.ไม่ชดเชย > 0 ? "#F09595" : "#e5e7eb"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Remark Table ──────────────────────────────────────────────────────────────
function RemarkTable({ data }: { data: BillingDashboardData["remarkSummary"] }) {
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BillingDashboardPage() {
  const [data, setData] = useState<BillingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoFile(false);
    try {
      const res = await fetch("/api/billing-dashboard", { credentials: "include" });
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
          <h1 className="text-lg font-bold text-gray-800">Dashboard การเบิกจ่ายค่าบริการ</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            แยกตามประเภทที่ขอเบิก รพ.สต. และโรงพยาบาลพลับพลาชัย
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

      {/* No file state */}
      {noFile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-amber-700 mt-1">กรุณาอัปโหลดไฟล์ Excel จาก หมอพร้อม / DMOR ด้านล่าง</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* KPI Cards */}
      {(loading || data) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[130px] rounded-2xl bg-gray-100 animate-pulse" />
          )) : data && (
            <>
              <KpiCard icon={TrendingUp} label="รายการทั้งหมด" value={fmt(data.totalRows)} sub="รายการขอเบิก" accent="#0369A1" bg="#E0F2FE" />
              <KpiCard icon={TrendingUp} label="เรียกเก็บรวม" value={fmt(data.totalClaim)} sub="บาท" accent="#854D0E" bg="#FEF9C3" />
              <KpiCard icon={BadgeCheck} label="ชดเชยแล้ว" value={fmt(data.totalComp)}
                sub={`${data.totalClaim > 0 ? Math.round(data.totalComp / data.totalClaim * 1000) / 10 : 0}% ของที่เรียกเก็บ`}
                accent="#3B6D11" bg="#EAF3DE" />
              <KpiCard icon={AlertTriangle} label="ยังค้างชดเชย"
                value={fmt(totalPending)}
                sub={`${data.units.reduce((s: number, u: BillingUnitSummary) => s + u.items.filter((item: BillingItemSummary) => item.สถานะ === "ไม่ชดเชย").reduce((n: number, item: BillingItemSummary) => n + item.จำนวน, 0), 0)} รายการ`}
                accent="#991B1B" bg="#FEE2E2" />
            </>
          )}
        </div>
      )}

      {/* Bar Chart */}
      {data && <BillingBarChart units={data.units} />}

      {/* Cross-tab summary table */}
      {data && <BillingCrossTab data={data} />}

      {/* Unit cards */}
      {data && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">รายละเอียดแยกตามหน่วยบริการ</p>
          {data.units.map((unit) => <UnitCard key={unit.hcodeKey} unit={unit} />)}
        </div>
      )}

      {/* Remark table */}
      {data && <RemarkTable data={data.remarkSummary} />}

      {/* Upload dropzone */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}