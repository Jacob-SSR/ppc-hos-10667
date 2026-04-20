"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, GripHorizontal, Mars, Venus, Shield } from "lucide-react";

export interface PatientRow {
  vn: string;
  hn: string;
  cid: string;
  pname: string;
  fname: string;
  lname: string;
  age_y: number;
  sex: string;
  vstdate: string;
  vsttime: string;
  pdx: string;
  dx_name: string;
  department: string;
  pttype: string;
  pttype_name: string;
  doctor_name: string;
  income: number;
}

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardLabel: string;
  cardType: string;
  start: string;
  end: string;
  infoLabel: string;
}

interface PttypeSummary {
  pttype: string;
  pttype_name: string;
  total: number;
  male: number;
  female: number;
}

function isMale(sex: string) {
  return sex === "1";
}

// ── Summary Row ────────────────────────────────────────────────────────────────
// แสดงสิทธิ์ 1 รายการ พร้อมแท่งสัดส่วน ช/ญ
function PttypeRow({
  row,
  maxTotal,
  index,
}: {
  row: PttypeSummary;
  maxTotal: number;
  index: number;
}) {
  const widthPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
  const malePct = row.total > 0 ? (row.male / row.total) * 100 : 0;

  return (
    <motion.div
      className="bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-green-300 hover:shadow-sm transition-all duration-150"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.2 }}
    >
      {/* Line 1: ชื่อสิทธิ์ + จำนวนรวม */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
            <Shield size={13} className="text-green-700" />
          </div>
          <span className="text-sm font-semibold text-gray-800 truncate">
            {row.pttype_name || "ไม่ระบุสิทธิ์"}
          </span>
        </div>
        <span className="text-sm font-extrabold text-gray-900 tabular-nums shrink-0">
          {row.total.toLocaleString()}
          <span className="text-[10px] font-medium text-gray-400 ml-1">
            ราย
          </span>
        </span>
      </div>

      {/* Proportion bar — สีฟ้า (ชาย) + ชมพู (หญิง) */}
      <div className="relative h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${(widthPct * malePct) / 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-y-0 bg-gradient-to-r from-pink-400 to-pink-500"
          initial={{ left: 0, width: 0 }}
          animate={{
            left: `${(widthPct * malePct) / 100}%`,
            width: `${widthPct - (widthPct * malePct) / 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Line 3: ช/ญ counts */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Mars size={11} className="text-blue-500" />
          <span className="text-gray-500">ชาย</span>
          <span className="font-bold text-blue-600 tabular-nums">
            {row.male.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Venus size={11} className="text-pink-500" />
          <span className="text-gray-500">หญิง</span>
          <span className="font-bold text-pink-600 tabular-nums">
            {row.female.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Totals card ────────────────────────────────────────────────────────────────
function TotalsCard({
  total,
  male,
  female,
}: {
  total: number;
  male: number;
  female: number;
}) {
  const malePct = total > 0 ? Math.round((male / total) * 100) : 0;
  const femalePct = total > 0 ? 100 - malePct : 0;

  return (
    <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-2xl px-5 py-4 text-white">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-green-200 mb-1">
        รวมทั้งหมด
      </p>
      <p className="text-3xl font-extrabold tabular-nums leading-tight">
        {total.toLocaleString()}
        <span className="text-sm font-medium text-green-200 ml-1.5">ราย</span>
      </p>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
          <Mars size={13} className="text-blue-200" />
          <span className="text-[11px] text-green-100">ชาย</span>
          <span className="text-sm font-bold tabular-nums ml-auto">
            {male.toLocaleString()}
          </span>
          <span className="text-[10px] text-green-200">({malePct}%)</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
          <Venus size={13} className="text-pink-200" />
          <span className="text-[11px] text-green-100">หญิง</span>
          <span className="text-sm font-bold tabular-nums ml-auto">
            {female.toLocaleString()}
          </span>
          <span className="text-[10px] text-green-200">({femalePct}%)</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function PatientDetailModal({
  isOpen,
  onClose,
  cardLabel,
  cardType,
  start,
  end,
  infoLabel,
}: PatientDetailModalProps) {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalSize, setModalSize] = useState({ w: 480, h: 640 });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 480, h: 640 });

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: modalSize.w,
      h: modalSize.h,
    };
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const dw = ev.clientX - resizeStart.current.x;
      const dh = ev.clientY - resizeStart.current.y;
      setModalSize({
        w: Math.max(360, Math.min(900, resizeStart.current.w + dw)),
        h: Math.max(
          400,
          Math.min(window.innerHeight * 0.95, resizeStart.current.h + dh),
        ),
      });
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Fetch
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setPatients([]);

      try {
        const res = await fetch(
          `/api/dashboard/patients?start=${start}&end=${end}&type=${cardType}`,
          { credentials: "include" },
        );
        const data = await res.json();
        if (!cancelled) setPatients(data.patients ?? []);
      } catch {
        // silently fail
      }

      if (!cancelled) setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isOpen, start, end, cardType]);

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ── Group ตามสิทธิ์ + แยก ช/ญ ─────────────────────────────────────────────
  const summary = useMemo(() => {
    const map = new Map<string, PttypeSummary>();

    for (const p of patients) {
      const key = p.pttype || "_unknown";
      const name = p.pttype_name || "ไม่ระบุสิทธิ์";

      if (!map.has(key)) {
        map.set(key, {
          pttype: key,
          pttype_name: name,
          total: 0,
          male: 0,
          female: 0,
        });
      }

      const row = map.get(key)!;
      row.total += 1;
      if (isMale(p.sex)) row.male += 1;
      else row.female += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [patients]);

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        male: acc.male + r.male,
        female: acc.female + r.female,
      }),
      { total: 0, male: 0, female: 0 },
    );
  }, [summary]);

  const maxTotal = summary[0]?.total ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              className="relative bg-gray-50 rounded-2xl flex flex-col overflow-hidden"
              style={{
                width: modalSize.w,
                height: modalSize.h,
                boxShadow:
                  "0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
              }}
              initial={{ scale: 0.94, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* HEADER */}
              <div className="bg-white border-b border-gray-100 px-5 pt-4 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 truncate">
                      {cardLabel}
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      สรุปตามสิทธิ์ · {infoLabel}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="ปิด"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                  >
                    <X size={12} strokeWidth={2.5} /> ปิด
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading && (
                  <>
                    <div className="h-[92px] rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-[84px] rounded-xl bg-white border border-gray-100 animate-pulse"
                          style={{ animationDelay: `${i * 40}ms` }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {!loading && summary.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Shield size={22} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">ไม่พบข้อมูล</p>
                  </div>
                )}

                {!loading && summary.length > 0 && (
                  <>
                    <TotalsCard
                      total={totals.total}
                      male={totals.male}
                      female={totals.female}
                    />

                    <div className="pt-1 pb-1">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          แยกตามสิทธิ์ ({summary.length})
                        </span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {summary.map((row, i) => (
                        <PttypeRow
                          key={row.pttype}
                          row={row}
                          maxTotal={maxTotal}
                          index={i}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* FOOTER */}
              {!loading && summary.length > 0 && (
                <div className="px-5 py-2.5 bg-white border-t border-gray-100 shrink-0">
                  <p className="text-[11px] text-gray-400 text-center">
                    <span className="font-bold text-gray-700">
                      {summary.length.toLocaleString()}
                    </span>{" "}
                    สิทธิ์ · รวม{" "}
                    <span className="font-bold text-gray-700">
                      {totals.total.toLocaleString()}
                    </span>{" "}
                    ราย
                  </p>
                </div>
              )}

              {/* RESIZE HANDLE */}
              <div
                onMouseDown={startResize}
                className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize text-gray-300 hover:text-gray-500 transition-colors z-40"
                title="ลากเพื่อขยาย"
              >
                <GripHorizontal size={14} className="rotate-45" />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
