"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  TrendingUp,
  BadgeCheck,
  AlertTriangle,
  Banknote,
  Info,
  Building2,
  MapPin,
  ChevronDown,
  UploadCloud,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KtbServiceSummary {
  รายการขอเบิก: string;
  รายการสั้น: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  สถานะ: string;
}

interface KtbUnitSummary {
  หน่วยบริการ: string;
  hcodeKey: string;
  isHospital: boolean;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  รายการ: KtbServiceSummary[];
}

interface KtbBatchSummary {
  งวดจ่าย: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  หน่วยบริการ: KtbUnitSummary[];
}

interface KtbDashboardData {
  updatedAt: string;
  totalRows: number;
  totalClaim: number;
  totalComp: number;
  totalNoComp: number;
  totalPending: number;
  batches: KtbBatchSummary[];
  units: KtbUnitSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("th-TH");
const fmtB = (n: number) =>
  n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
        <p
          className="text-xl font-extrabold tabular-nums"
          style={{ color: accent }}
        >
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

// ─── BatchCard ────────────────────────────────────────────────────────────────

function BatchCard({ batch }: { batch: KtbBatchSummary }) {
  const [open, setOpen] = useState(false);
  const pending = Math.max(0, batch.ชดเชย - batch.ไม่ชดเชย);

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        {/* งวดจ่าย badge */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
            งวดจ่าย
          </p>
          <p className="text-sm font-extrabold text-amber-800 tabular-nums">
            {batch.งวดจ่าย}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">
            {fmt(batch.จำนวน)} รายการ ·{" "}
            {batch.หน่วยบริการ.length} หน่วยบริการ
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">ชดเชยแล้ว</p>
            <p className="text-sm font-bold text-green-700 tabular-nums">
              {fmtB(batch.ชดเชย)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">รอโอน KTB</p>
            <p className="text-sm font-extrabold text-orange-600 tabular-nums">
              {fmtB(pending)}
            </p>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} className="text-gray-400" />
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
            <div className="px-5 py-4 space-y-3">
              {batch.หน่วยบริการ.map((unit) => (
                <UnitRow key={unit.hcodeKey} unit={unit} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── UnitRow ──────────────────────────────────────────────────────────────────

function UnitRow({ unit }: { unit: KtbUnitSummary }) {
  const [open, setOpen] = useState(false);
  const pending = Math.max(0, unit.ชดเชย - unit.ไม่ชดเชย);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            unit.isHospital ? "bg-blue-50" : "bg-green-50"
          }`}
        >
          {unit.isHospital ? (
            <Building2 size={15} className="text-blue-700" strokeWidth={1.8} />
          ) : (
            <MapPin size={15} className="text-green-700" strokeWidth={1.8} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {unit.หน่วยบริการ}
          </p>
          <p className="text-[11px] text-gray-400">
            {fmt(unit.จำนวน)} รายการ
          </p>
        </div>
        <div className="flex gap-4 items-center shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">ชดเชย</p>
            <p className="text-xs font-bold text-green-700 tabular-nums">
              {fmtB(unit.ชดเชย)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">รอโอน</p>
            <p className="text-xs font-extrabold text-orange-600 tabular-nums">
              {fmtB(pending)}
            </p>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown size={14} className="text-gray-300" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-4 py-3">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-700">
                    {[
                      "รายการบริการ",
                      "สถานะ",
                      "จำนวน",
                      "เรียกเก็บ (฿)",
                      "ชดเชย (฿)",
                      "รอโอน (฿)",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-white font-semibold border-r border-green-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unit.รายการ.map((svc, i) => {
                    const svPending = Math.max(0, svc.ชดเชย - svc.ไม่ชดเชย);
                    const baseColor = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                    return (
                      <tr
                        key={i}
                        className="border-b border-gray-100 transition-colors"
                        style={{ backgroundColor: baseColor }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f0faf4")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = baseColor)
                        }
                      >
                        <td className="px-3 py-2 text-gray-700 max-w-[240px]">
                          <div className="font-medium">{svc.รายการสั้น}</div>
                          <div className="text-[10px] text-gray-400 leading-snug">
                            {svc.รายการขอเบิก !== svc.รายการสั้น &&
                              svc.รายการขอเบิก}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              svc.สถานะ === "ชดเชย"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {svc.สถานะ}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                          {fmt(svc.จำนวน)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {fmtB(svc.เรียกเก็บ)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700 font-bold">
                          {fmtB(svc.ชดเชย)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-orange-600 font-bold">
                          {fmtB(svPending)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UnitOverviewCard (สรุปรวมทุกงวด) ────────────────────────────────────────

function UnitOverviewCard({ unit }: { unit: KtbUnitSummary }) {
  const [open, setOpen] = useState(unit.isHospital);
  const pending = Math.max(0, unit.ชดเชย - unit.ไม่ชดเชย);
  const rate = unit.เรียกเก็บ > 0
    ? Math.round((unit.ชดเชย / unit.เรียกเก็บ) * 1000) / 10
    : 0;

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
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            unit.isHospital ? "bg-blue-50" : "bg-green-50"
          }`}
        >
          {unit.isHospital ? (
            <Building2 size={18} className="text-blue-700" strokeWidth={1.8} />
          ) : (
            <MapPin size={18} className="text-green-700" strokeWidth={1.8} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">
            {unit.หน่วยบริการ}
          </p>
          <p className="text-[11px] text-gray-400">
            HCODE {unit.hcodeKey} · {fmt(unit.จำนวน)} รายการ
          </p>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">ชดเชยแล้ว</p>
            <p className="text-sm font-bold text-green-700 tabular-nums">
              {fmtB(unit.ชดเชย)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">รอโอน KTB</p>
            <p className="text-sm font-extrabold text-orange-600 tabular-nums">
              {fmtB(pending)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">อัตราชดเชย</p>
            <p
              className="text-sm font-extrabold tabular-nums"
              style={{ color: rate >= 90 ? "#15803d" : rate >= 60 ? "#b45309" : "#b91c1c" }}
            >
              {rate}%
            </p>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} className="text-gray-300" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4">
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-green-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(rate, 100)}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs font-bold text-green-700 tabular-nums">
                  {rate}% ชดเชย
                </span>
              </div>
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-700">
                    {["รายการบริการ", "สถานะ", "จำนวน", "เรียกเก็บ (฿)", "ชดเชย (฿)", "รอโอน (฿)"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {unit.รายการ.map((svc, i) => {
                    const svPending = Math.max(0, svc.ชดเชย - svc.ไม่ชดเชย);
                    const baseColor = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                    return (
                      <tr
                        key={i}
                        className="border-b border-gray-100 transition-colors"
                        style={{ backgroundColor: baseColor }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f0faf4")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = baseColor)
                        }
                      >
                        <td className="px-3 py-2 text-gray-700 max-w-[240px]">
                          <div className="font-medium">{svc.รายการสั้น}</div>
                          {svc.รายการขอเบิก !== svc.รายการสั้น && (
                            <div className="text-[10px] text-gray-400 leading-snug line-clamp-1">
                              {svc.รายการขอเบิก}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              svc.สถานะ === "ชดเชย"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {svc.สถานะ}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                          {fmt(svc.จำนวน)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {fmtB(svc.เรียกเก็บ)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700 font-bold">
                          {fmtB(svc.ชดเชย)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-orange-600 font-bold">
                          {fmtB(svPending)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── BatchSummaryTable ────────────────────────────────────────────────────────

function BatchSummaryTable({ batches }: { batches: KtbBatchSummary[] }) {
  const totalClaim = batches.reduce((s, b) => s + b.เรียกเก็บ, 0);
  const totalComp = batches.reduce((s, b) => s + b.ชดเชย, 0);
  const totalPending = batches.reduce(
    (s, b) => s + Math.max(0, b.ชดเชย - b.ไม่ชดเชย),
    0
  );
  const totalCount = batches.reduce((s, b) => s + b.จำนวน, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <h4 className="text-sm font-bold text-gray-600 mb-4">
        สรุปยอดรอโอน KTB แยกตามงวดจ่าย
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#1a5233]">
              {["งวดจ่าย", "จำนวน (รายการ)", "เรียกเก็บ (฿)", "ชดเชยแล้ว (฿)", "รอโอน KTB (฿)"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-800 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {batches.map((b, i) => {
              const pending = Math.max(0, b.ชดเชย - b.ไม่ชดเชย);
              const baseColor = i % 2 === 0 ? "#ffffff" : "#f9fafb";
              return (
                <tr
                  key={b.งวดจ่าย}
                  className="border-b border-gray-100 transition-colors"
                  style={{ backgroundColor: baseColor }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f0faf4")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = baseColor)
                  }
                >
                  <td className="px-3 py-2">
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold font-mono">
                      {b.งวดจ่าย}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">
                    {fmt(b.จำนวน)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                    {fmtB(b.เรียกเก็บ)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 font-bold">
                    {fmtB(b.ชดเชย)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600 font-extrabold">
                    {fmtB(pending)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#d6f0e0] border-t-2 border-[#55b882]">
              <td className="px-3 py-2 text-xs font-bold text-[#1a5233]">
                รวมทั้งหมด
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                {fmt(totalCount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                {fmtB(totalClaim)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-[#1a5233]">
                {fmtB(totalComp)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs font-extrabold text-orange-700">
                {fmtB(totalPending)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── UploadDropzone ───────────────────────────────────────────────────────────

function UploadDropzone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setResult(null);
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/ktb-upload", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const json = await res.json();
        setResult({ ok: json.success, msg: json.message ?? json.error });
        if (json.success) setTimeout(onSuccess, 600);
      } catch {
        setResult({ ok: false, msg: "เชื่อมต่อ server ไม่ได้" });
      } finally {
        setUploading(false);
      }
    },
    [onSuccess]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#717171]">
          อัปโหลดข้อมูลรายการยังไม่โอน KTB
        </h4>
        <span className="text-[11px] text-gray-400">ktb.xlsx</span>
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{
          borderColor: dragging ? "#3aa36a" : "#d1d5db",
          backgroundColor: dragging ? "#f0faf4" : "#fafafa",
          scale: dragging ? 1.01 : 1,
        }}
        className="border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 py-6 px-4 select-none"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="up"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw size={28} className="text-green-600" />
              </motion.div>
              <p className="text-sm font-semibold text-green-700">
                กำลังอัปโหลด...
              </p>
            </motion.div>
          ) : result?.ok ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1"
            >
              <CheckCircle2 size={28} className="text-green-600" />
              <p className="text-sm font-bold text-green-700">{result.msg}</p>
              <p
                className="text-xs text-gray-400 underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setResult(null);
                }}
              >
                อัปโหลดไฟล์ใหม่
              </p>
            </motion.div>
          ) : result ? (
            <motion.div
              key="err"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1"
            >
              <XCircle size={28} className="text-red-500" />
              <p className="text-sm font-semibold text-red-600">{result.msg}</p>
              <p
                className="text-xs text-gray-500 underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setResult(null);
                }}
              >
                ลองใหม่
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1 pointer-events-none"
            >
              <motion.div
                animate={dragging ? { y: -6 } : { y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <UploadCloud
                  size={28}
                  style={{ color: dragging ? "#3aa36a" : "#9ca3af" }}
                />
              </motion.div>
              <p className="text-sm font-semibold text-gray-600">
                {dragging ? "ปล่อยเพื่ออัปโหลด" : "ลากวางไฟล์ หรือคลิกเพื่อเลือก"}
              </p>
              <p className="text-xs text-gray-400">
                ไฟล์ Excel รายการยังไม่โอน KTB เท่านั้น
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KtbDashboardPage() {
  const [data, setData] = useState<KtbDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFile, setNoFile] = useState(false);
  const [activeTab, setActiveTab] = useState<"batch" | "unit">("batch");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoFile(false);
    try {
      const res = await fetch("/api/ktb-dashboard", { credentials: "include" });
      if (res.status === 404) {
        setNoFile(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPending = data
    ? data.batches.reduce((s, b) => s + Math.max(0, b.ชดเชย - b.ไม่ชดเชย), 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            Dashboard รายการยังไม่โอน KTB
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            รายการที่ได้รับการชดเชยแล้ว แต่ยังไม่ได้รับการโอนเงินเข้าบัญชี KTB
            {data && (
              <span className="ml-2">
                · อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <motion.span
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={
              loading ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}
            }
          >
            <RefreshCw size={14} />
          </motion.span>
          รีเฟรช
        </button>
      </div>

      {/* ── No file ── */}
      {noFile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">ยังไม่มีข้อมูล</p>
            <p className="text-xs text-amber-700 mt-1">
              กรุณาอัปโหลดไฟล์ Excel รายการยังไม่โอน KTB ด้านล่าง
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      {(loading || data) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[130px] rounded-2xl bg-gray-100 animate-pulse"
                />
              ))
            : data && (
                <>
                  <KpiCard
                    icon={TrendingUp}
                    label="รายการทั้งหมด"
                    value={fmt(data.totalRows)}
                    sub="รายการในระบบ"
                    accent="#0369A1"
                    bg="#E0F2FE"
                  />
                  <KpiCard
                    icon={Banknote}
                    label="เรียกเก็บรวม"
                    value={fmtB(data.totalClaim)}
                    sub="บาท"
                    accent="#854D0E"
                    bg="#FEF9C3"
                  />
                  <KpiCard
                    icon={BadgeCheck}
                    label="ชดเชยแล้ว"
                    value={fmtB(data.totalComp)}
                    sub={`${data.batches.length} งวดจ่าย`}
                    accent="#3B6D11"
                    bg="#EAF3DE"
                  />
                  <KpiCard
                    icon={AlertTriangle}
                    label="รอโอน KTB"
                    value={fmtB(totalPending)}
                    sub="ยังไม่ได้รับโอนเงิน"
                    accent="#C2410C"
                    bg="#FFF7ED"
                  />
                </>
              )}
        </div>
      )}

      {/* ── Summary Table ── */}
      {data && <BatchSummaryTable batches={data.batches} />}

      {/* ── Tabs ── */}
      {data && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-gray-100">
            {(
              [
                { key: "batch", label: `แยกตามงวดจ่าย (${data.batches.length})` },
                { key: "unit", label: `แยกตามหน่วยบริการ (${data.units.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-6 py-3 text-sm font-semibold transition-colors relative"
                style={{
                  color: activeTab === tab.key ? "#1a5233" : "#6b7280",
                  backgroundColor:
                    activeTab === tab.key ? "#f0faf4" : "transparent",
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-700"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-3">
            {activeTab === "batch" &&
              data.batches.map((b) => (
                <BatchCard key={b.งวดจ่าย} batch={b} />
              ))}
            {activeTab === "unit" &&
              data.units.map((u) => (
                <UnitOverviewCard key={u.hcodeKey} unit={u} />
              ))}
          </div>
        </div>
      )}

      {/* ── Upload ── */}
      <UploadDropzone onSuccess={fetchData} />
    </div>
  );
}