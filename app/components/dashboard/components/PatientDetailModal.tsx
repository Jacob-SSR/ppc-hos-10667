"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Users, GripHorizontal, Shield, Activity, Car, AlertTriangle,
  ChevronRight, ChevronDown,
} from "lucide-react";
import type { PatientRow } from "@/app/components/dashboard/types/dashboard.types";
import { PttypeRow, PttypeSummary, TotalsCard } from "./PatientSummaryCard";

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardLabel: string;
  cardType: string;
  start: string;
  end: string;
  infoLabel: string;
}

// ── Color maps ─────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, { bar: string; text: string }> = {
  "Resuscitate (กู้ชีพทันที)": { bar: "#A32D2D", text: "#A32D2D" },
  "Emergency (ฉุกเฉินเร่งด่วน)": { bar: "#BA7517", text: "#854F0B" },
  "Urgency (ด่วนมาก)": { bar: "#BA7517", text: "#854D0E" },
  "Semi Urgency (ด่วน)": { bar: "#185FA5", text: "#185FA5" },
  "Non Urgency (รอได้)": { bar: "#3B6D11", text: "#3B6D11" },
  "ไม่ระบุ level": { bar: "#888780", text: "#5F5E5A" },
};

// ลำดับความเสี่ยง — เลขน้อย = เสี่ยงสูง อยู่บนสุด
const LEVEL_ORDER: Record<string, number> = {
  "Resuscitate (กู้ชีพทันที)": 1,
  "Emergency (ฉุกเฉินเร่งด่วน)": 2,
  "Urgency (ด่วนมาก)": 3,
  "Semi Urgency (ด่วน)": 4,
  "Non Urgency (รอได้)": 5,
  "ไม่ระบุ level": 99,
};

const PT_TYPE_COLOR: Record<string, { bar: string; text: string; icon: string }> = {
  "ผู้ป่วยฉุกเฉิน": { bar: "#A32D2D", text: "#A32D2D", icon: "🚨" },
  "ผู้ป่วยอุบัติเหตุ": { bar: "#BA7517", text: "#854F0B", icon: "🚗" },
  "ผู้ป่วยตรวจโรคทั่วไป": { bar: "#185FA5", text: "#185FA5", icon: "🩺" },
  "ผู้ป่วยรับบริการอื่น ๆ": { bar: "#3B6D11", text: "#3B6D11", icon: "📋" },
  "ไม่ระบุประเภท": { bar: "#888780", text: "#5F5E5A", icon: "❓" },
};

const VEHICLE_COLOR: Record<string, string> = {
  "รถจักรยานยนต์": "#EF9F27",
  "รถจักรยานและสามล้อถีบ": "#97C459",
  "รถปิคอัพ": "#85B7EB",
  "คนเดินทางเท้า": "#D4537E",
  "รถยนต์ 4 ล้อ": "#60a5fa",
};

const DCH_COLOR: Record<string, { bar: string; text: string }> = {
  "กลับบ้าน": { bar: "#3B6D11", text: "#3B6D11" },
  "Admitted": { bar: "#185FA5", text: "#185FA5" },
  "ส่งต่อสถานพยาบาลอื่น": { bar: "#854F0B", text: "#854F0B" },
  "เสียชีวิต": { bar: "#A32D2D", text: "#A32D2D" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function SummaryCard({ title, icon: Icon, iconColor, children }: {
  title: string; icon: React.ElementType; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: iconColor }} />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BarRow({ label, count, total, bar, text, prefix }: {
  label: string; count: number; total: number; bar: string; text: string; prefix?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate max-w-[70%]" style={{ color: text }}>
          {prefix && <span className="mr-1.5">{prefix}</span>}{label}
        </span>
        <span className="text-xs font-extrabold tabular-nums shrink-0" style={{ color: text }}>
          {count} ราย <span className="font-normal text-[10px] opacity-60">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-100">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: bar }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }} />
      </div>
    </div>
  );
}

// ── ER pt_type with drill-down ──────────────────────────────────────────────────
interface DrillDownData {
  dchByPtType: Record<string, Record<string, number>>;
  vehicleSummary: Record<string, number>;
  transportDchSummary: Record<string, number>;
  accidentTypeSummary: Record<string, number>;
  otherDchSummary: Record<string, number>;
  transportCount: number;
  otherAccidentCount: number;
}

function AccidentSubRow({ label, count, total, bar, text, isExpanded, onToggle, children }: {
  label: string; count: number; total: number; bar: string; text: string;
  isExpanded: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: bar }} />
        <span className="flex-1 text-xs font-semibold" style={{ color: text }}>{label}</span>
        <span className="text-xs font-extrabold tabular-nums" style={{ color: text }}>
          {count} ราย ({pct}%)
        </span>
        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight size={14} className="text-gray-400" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isExpanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-gray-100 bg-gray-50/60"
          >
            <div className="px-3 py-3 space-y-2.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DchMiniRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const c = DCH_COLOR[label] ?? { bar: "#888780", text: "#5F5E5A" };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-600">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: c.text }}>
          {count} ราย ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: c.bar }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function ErPtTypeDrillDown({ data, total, drillDown }: {
  data: Record<string, number>;
  total: number;
  drillDown: DrillDownData;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // accident sub-expanded
  const [accExpanded, setAccExpanded] = useState<"transport" | "other" | null>(null);

  const toggle = (name: string) => setExpanded(p => p === name ? null : name);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <Car size={14} style={{ color: "#854F0B" }} />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">ประเภทผู้ป่วย ER</p>
        <span className="text-[10px] text-gray-400 ml-auto">คลิกเพื่อดูรายละเอียด</span>
      </div>

      <div className="space-y-2">
        {Object.entries(data).sort(([, a], [, b]) => b - a).map(([name, count]) => {
          const c = PT_TYPE_COLOR[name] ?? { bar: "#888780", text: "#5F5E5A", icon: "❓" };
          const isAccident = name === "ผู้ป่วยอุบัติเหตุ";
          const isExpanded = expanded === name;

          // dch for this pt_type
          const dchData = drillDown.dchByPtType[name] ?? {};

          return (
            <div key={name} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => toggle(name)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-base shrink-0">{c.icon}</span>
                <span className="flex-1 text-xs font-semibold" style={{ color: c.text }}>{name}</span>
                <span className="text-xs font-extrabold tabular-nums" style={{ color: c.text }}>
                  {count} ราย ({total > 0 ? Math.round((count / total) * 100) : 0}%)
                </span>
                <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                  <ChevronRight size={14} className="text-gray-400" />
                </motion.span>
              </button>

              {/* Bar */}
              <div className="h-1 w-full bg-gray-100">
                <motion.div className="h-full" style={{ backgroundColor: c.bar }}
                  initial={{ width: 0 }} animate={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }} />
              </div>

              {/* Drill-down content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="px-3 py-3 bg-gray-50/50 space-y-3">

                      {/* ── อุบัติเหตุ: แยก transport vs other ── */}
                      {isAccident && (drillDown.transportCount > 0 || drillDown.otherAccidentCount > 0) && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            แยกประเภทอุบัติเหตุ
                          </p>

                          {/* Transport */}
                          {drillDown.transportCount > 0 && (
                            <AccidentSubRow
                              label="อุบัติเหตุจากการขนส่ง"
                              count={drillDown.transportCount}
                              total={count}
                              bar="#EF9F27"
                              text="#854F0B"
                              isExpanded={accExpanded === "transport"}
                              onToggle={() => setAccExpanded(p => p === "transport" ? null : "transport")}
                            >
                              {/* Vehicle breakdown */}
                              {Object.keys(drillDown.vehicleSummary).length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-semibold text-gray-500">ยานพาหนะ</p>
                                  {Object.entries(drillDown.vehicleSummary)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([v, cnt]) => (
                                      <div key={v}>
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[11px] text-gray-600">{v}</span>
                                          <span className="text-[11px] font-bold tabular-nums"
                                            style={{ color: VEHICLE_COLOR[v] ?? "#6b7280" }}>
                                            {cnt} ราย ({drillDown.transportCount > 0 ? Math.round((cnt / drillDown.transportCount) * 100) : 0}%)
                                          </span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                                          <motion.div className="h-full rounded-full"
                                            style={{ backgroundColor: VEHICLE_COLOR[v] ?? "#85B7EB" }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${drillDown.transportCount > 0 ? (cnt / drillDown.transportCount) * 100 : 0}%` }}
                                            transition={{ duration: 0.4, ease: "easeOut" }} />
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* Dch for transport */}
                              {Object.keys(drillDown.transportDchSummary).length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                                  <p className="text-[10px] font-semibold text-gray-500">ผลการรักษา</p>
                                  {Object.entries(drillDown.transportDchSummary)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([d, cnt]) => (
                                      <DchMiniRow key={d} label={d} count={cnt} total={drillDown.transportCount} />
                                    ))}
                                </div>
                              )}
                            </AccidentSubRow>
                          )}

                          {/* Other accident */}
                          {drillDown.otherAccidentCount > 0 && (
                            <AccidentSubRow
                              label="อุบัติเหตุอื่นๆ"
                              count={drillDown.otherAccidentCount}
                              total={count}
                              bar="#f87171"
                              text="#b91c1c"
                              isExpanded={accExpanded === "other"}
                              onToggle={() => setAccExpanded(p => p === "other" ? null : "other")}
                            >
                              {/* Accident type breakdown */}
                              {Object.keys(drillDown.accidentTypeSummary).length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-semibold text-gray-500">ประเภทอุบัติเหตุ</p>
                                  {Object.entries(drillDown.accidentTypeSummary)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([a, cnt]) => (
                                      <div key={a}>
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[11px] text-gray-600 truncate max-w-[75%]">{a}</span>
                                          <span className="text-[11px] font-bold tabular-nums text-red-600">
                                            {cnt} ราย ({drillDown.otherAccidentCount > 0 ? Math.round((cnt / drillDown.otherAccidentCount) * 100) : 0}%)
                                          </span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                                          <motion.div className="h-full rounded-full bg-red-400"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${drillDown.otherAccidentCount > 0 ? (cnt / drillDown.otherAccidentCount) * 100 : 0}%` }}
                                            transition={{ duration: 0.4, ease: "easeOut" }} />
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* Dch for other */}
                              {Object.keys(drillDown.otherDchSummary).length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                                  <p className="text-[10px] font-semibold text-gray-500">ผลการรักษา</p>
                                  {Object.entries(drillDown.otherDchSummary)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([d, cnt]) => (
                                      <DchMiniRow key={d} label={d} count={cnt} total={drillDown.otherAccidentCount} />
                                    ))}
                                </div>
                              )}
                            </AccidentSubRow>
                          )}
                        </div>
                      )}

                      {/* ── ผลการรักษา for non-accident pt_types ── */}
                      {!isAccident && Object.keys(dchData).length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            ผลการรักษา
                          </p>
                          {Object.entries(dchData)
                            .sort(([, a], [, b]) => b - a)
                            .map(([d, cnt]) => (
                              <DchMiniRow key={d} label={d} count={cnt} total={count} />
                            ))}
                        </div>
                      )}

                      {/* Fallback if no sub-data */}
                      {!isAccident && Object.keys(dchData).length === 0 && (
                        <p className="text-[11px] text-gray-400 text-center py-2">ไม่มีข้อมูลเพิ่มเติม</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErLevelSummary({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <SummaryCard title="Emergency Level" icon={Activity} iconColor="#A32D2D">
      {Object.entries(data)
        .sort(([a], [b]) => (LEVEL_ORDER[a] ?? 98) - (LEVEL_ORDER[b] ?? 98))
        .map(([name, count]) => {
          const c = LEVEL_COLOR[name] ?? { bar: "#888780", text: "#5F5E5A" };
          return <BarRow key={name} label={name} count={count} total={total} bar={c.bar} text={c.text} />;
        })}
    </SummaryCard>
  );
}

function VehicleSummary({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <SummaryCard title="ประเภทพาหนะ" icon={Car} iconColor="#854F0B">
      {Object.entries(data).sort(([, a], [, b]) => b - a).map(([name, count]) => {
        const bar = VEHICLE_COLOR[name] ?? "#85B7EB";
        return <BarRow key={name} label={name} count={count} total={total} bar={bar} text={bar} />;
      })}
    </SummaryCard>
  );
}

function DchSummary({ data, total, title = "ผลการรักษา" }: {
  data: Record<string, number>; total: number; title?: string;
}) {
  return (
    <SummaryCard title={title} icon={Shield} iconColor="#185FA5">
      {Object.entries(data).sort(([, a], [, b]) => b - a).map(([name, count]) => {
        const c = DCH_COLOR[name] ?? { bar: "#888780", text: "#5F5E5A" };
        return <BarRow key={name} label={name} count={count} total={total} bar={c.bar} text={c.text} />;
      })}
    </SummaryCard>
  );
}

function TransporterSummary({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <SummaryCard title="ผู้นำส่ง" icon={Users} iconColor="#185FA5">
      {Object.entries(data).sort(([, a], [, b]) => b - a).map(([name, count]) => (
        <BarRow key={name} label={name} count={count} total={total} bar="#85B7EB" text="#185FA5" />
      ))}
    </SummaryCard>
  );
}

function AccidentTypeSummary({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <SummaryCard title="ประเภทอุบัติเหตุ" icon={AlertTriangle} iconColor="#854F0B">
      {Object.entries(data).sort(([, a], [, b]) => b - a).map(([name, count]) => (
        <BarRow key={name} label={name} count={count} total={total} bar="#EF9F27" text="#854F0B" />
      ))}
    </SummaryCard>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
function isMale(sex: string) { return sex === "1"; }

export default function PatientDetailModal({
  isOpen, onClose, cardLabel, cardType, start, end, infoLabel,
}: PatientDetailModalProps) {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [extras, setExtras] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [modalSize, setModalSize] = useState({ w: 520, h: 700 });

  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 520, h: 700 });

  const isErCard = cardType === "erEmergency";
  const isTransportCard = cardType === "erTransport";
  const isOtherAcc = cardType === "erOtherAccident";
  const isAccidentCard = isTransportCard || isOtherAcc;

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: modalSize.w, h: modalSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setModalSize({
        w: Math.max(420, Math.min(900, resizeStart.current.w + ev.clientX - resizeStart.current.x)),
        h: Math.max(400, Math.min(window.innerHeight * 0.95, resizeStart.current.h + ev.clientY - resizeStart.current.y)),
      });
    };
    const onUp = () => { isResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPatients([]);
      setExtras({});
      try {
        const res = await fetch(`/api/dashboard/patients?start=${start}&end=${end}&type=${cardType}`, { credentials: "include" });
        const data = await res.json();
        if (!cancelled) {
          setPatients(data.patients ?? []);
          const { patients: _, ...rest } = data;
          setExtras(rest as Record<string, unknown>);
        }
      } catch { }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, start, end, cardType]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Summaries
  const pttypeSummary = useMemo<PttypeSummary[]>(() => {
    if (isAccidentCard) return [];
    const map = new Map<string, PttypeSummary>();
    for (const p of patients) {
      const key = p.pttype || "_unknown";
      if (!map.has(key)) map.set(key, { pttype: key, pttype_name: p.pttype_name || "ไม่ระบุสิทธิ์", total: 0, male: 0, female: 0 });
      const row = map.get(key)!;
      row.total++;
      if (isMale(p.sex)) row.male++; else row.female++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [patients, isAccidentCard]);

  const totals = useMemo(() =>
    pttypeSummary.reduce((acc, r) => ({ total: acc.total + r.total, male: acc.male + r.male, female: acc.female + r.female }),
      { total: 0, male: 0, female: 0 }), [pttypeSummary]);

  const maxTotal = pttypeSummary[0]?.total ?? 0;
  const accTotal = patients.length;
  const accMale = useMemo(() => patients.filter(p => isMale(p.sex)).length, [patients]);
  const accFemale = useMemo(() => patients.filter(p => !isMale(p.sex)).length, [patients]);

  const erDrillDown: DrillDownData = {
    dchByPtType: (extras.dchByPtType as Record<string, Record<string, number>>) ?? {},
    vehicleSummary: (extras.vehicleSummary as Record<string, number>) ?? {},
    transportDchSummary: (extras.transportDchSummary as Record<string, number>) ?? {},
    accidentTypeSummary: (extras.accidentTypeSummary as Record<string, number>) ?? {},
    otherDchSummary: (extras.otherDchSummary as Record<string, number>) ?? {},
    transportCount: (extras.transportCount as number) ?? 0,
    otherAccidentCount: (extras.otherAccidentCount as number) ?? 0,
  };

  const headerIcon = isErCard ? Activity : isAccidentCard ? AlertTriangle : Users;
  const headerColor = isErCard ? "#A32D2D" : isAccidentCard ? "#854F0B" : "#1a5233";
  const headerBg = isErCard ? "#FCEBEB" : isAccidentCard ? "#FAEEDA" : "#f0faf4";
  const subtitleLabel = isErCard
    ? "ประเภท · Level · สิทธิ์ · คลิกดูรายละเอียด"
    : isAccidentCard
      ? "พาหนะ · ผู้นำส่ง · ผลการรักษา"
      : "สรุปตามสิทธิ์";

  const isEmpty = isAccidentCard ? patients.length === 0 : pttypeSummary.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
              className="relative bg-gray-50 rounded-2xl flex flex-col overflow-hidden"
              style={{ width: modalSize.w, height: modalSize.h, boxShadow: "0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)" }}
              initial={{ scale: 0.94, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* HEADER */}
              <div className="bg-white border-b border-gray-100 px-5 pt-4 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: headerBg }}>
                    {(() => { const Icon = headerIcon; return <Icon size={16} style={{ color: headerColor }} />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 truncate">{cardLabel}</h2>
                    <p className="text-[11px] text-gray-400">{subtitleLabel} · {infoLabel}</p>
                  </div>
                  <button onClick={onClose}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0">
                    <X size={12} strokeWidth={2.5} /> ปิด
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading && (
                  <>
                    <div className="h-[80px] rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="h-[160px] rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="h-[100px] rounded-2xl bg-gray-200 animate-pulse" />
                  </>
                )}

                {!loading && isEmpty && (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Shield size={22} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">ไม่พบข้อมูล</p>
                  </div>
                )}

                {/* ── อุบัติเหตุการขนส่ง ── */}
                {!loading && isTransportCard && patients.length > 0 && (
                  <>
                    <TotalsCard total={accTotal} male={accMale} female={accFemale} />
                    <VehicleSummary data={(extras.vehicleSummary as Record<string, number>) ?? {}} total={accTotal} />
                    <TransporterSummary data={(extras.transporterSummary as Record<string, number>) ?? {}} total={accTotal} />
                    <DchSummary data={(extras.dchSummary as Record<string, number>) ?? {}} total={accTotal} />
                  </>
                )}

                {/* ── อุบัติเหตุอื่นๆ ── */}
                {!loading && isOtherAcc && patients.length > 0 && (
                  <>
                    <TotalsCard total={accTotal} male={accMale} female={accFemale} />
                    <AccidentTypeSummary data={(extras.accidentTypeSummary as Record<string, number>) ?? {}} total={accTotal} />
                    <DchSummary data={(extras.dchSummary as Record<string, number>) ?? {}} total={accTotal} />
                  </>
                )}

                {/* ── ER with drill-down ── */}
                {!loading && isErCard && pttypeSummary.length > 0 && (
                  <>
                    <TotalsCard total={totals.total} male={totals.male} female={totals.female} />

                    {/* Pt Type with drill-down (new component) */}
                    {extras.ptTypeSummary && (
                      <ErPtTypeDrillDown
                        data={extras.ptTypeSummary as Record<string, number>}
                        total={totals.total}
                        drillDown={erDrillDown}
                      />
                    )}

                    {/* Emergency Level */}
                    {extras.levelSummary && (
                      <ErLevelSummary
                        data={extras.levelSummary as Record<string, number>}
                        total={totals.total}
                      />
                    )}

                    <SectionDivider label={`แยกตามสิทธิ์ (${pttypeSummary.length})`} />
                    <div className="space-y-2">
                      {pttypeSummary.map((row, i) => (
                        <PttypeRow key={row.pttype} row={row} maxTotal={maxTotal} index={i} />
                      ))}
                    </div>
                  </>
                )}

                {/* ── OPD ทั่วไป ── */}
                {!loading && !isErCard && !isAccidentCard && pttypeSummary.length > 0 && (
                  <>
                    <TotalsCard total={totals.total} male={totals.male} female={totals.female} />
                    <SectionDivider label={`แยกตามสิทธิ์ (${pttypeSummary.length})`} />
                    <div className="space-y-2">
                      {pttypeSummary.map((row, i) => (
                        <PttypeRow key={row.pttype} row={row} maxTotal={maxTotal} index={i} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* FOOTER */}
              {!loading && !isEmpty && (
                <div className="px-5 py-2.5 bg-white border-t border-gray-100 shrink-0">
                  <p className="text-[11px] text-gray-400 text-center">
                    รวม <span className="font-bold text-gray-700">
                      {isAccidentCard ? accTotal.toLocaleString() : totals.total.toLocaleString()}
                    </span> ราย
                  </p>
                </div>
              )}

              {/* RESIZE handle */}
              <div onMouseDown={startResize}
                className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize text-gray-300 hover:text-gray-500 z-40">
                <GripHorizontal size={14} className="rotate-45" />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}