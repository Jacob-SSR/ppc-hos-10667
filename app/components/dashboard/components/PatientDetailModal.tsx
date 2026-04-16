"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Stethoscope,
  Shield,
  Building2,
  ChevronRight,
  ArrowLeft,
  History,
  Calendar,
  Activity,
  Search,
  Users,
  UserRound,
  GripHorizontal,
  Mars,
  Venus,
} from "lucide-react";
import { formatThaiDate } from "@/lib/dateUtils";
import { usePatientModal, usePatientHistory } from "../hooks/usePatientModal";

import type {
  PatientRow,
  HistoryRow,
  GenderFilter,
} from "../types/dashboard.types";
import { isMale } from "./utils/dashboard.utils";

// ─── Slide animation preset ───────────────────────────────────────────────────

const slideIn = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
  transition: { type: "spring", stiffness: 400, damping: 36 },
} as const;

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 mb-1">{label}</p>
        <p className="text-sm text-gray-900 font-bold leading-snug">{value}</p>
      </div>
    </div>
  );
}

// ─── Visit Detail ─────────────────────────────────────────────────────────────

function VisitDetail({
  visit,
  patient,
  onBack,
}: {
  visit: HistoryRow;
  patient: PatientRow;
  onBack: () => void;
}) {
  const fields = [
    {
      icon: Calendar,
      label: "วันที่รับบริการ",
      value: `${formatThaiDate(visit.vstdate)}  ${visit.vsttime?.slice(0, 5) ?? ""}`,
    },
    {
      icon: Activity,
      label: "การวินิจฉัย (ICD-10)",
      value: visit.dx_name || visit.pdx || "—",
    },
    {
      icon: Building2,
      label: "แผนก / หน่วยบริการ",
      value: visit.department || "—",
    },
    { icon: Shield, label: "สิทธิ์การรักษา", value: visit.pttype_name || "—" },
    {
      icon: Stethoscope,
      label: "แพทย์ผู้ดูแล",
      value: visit.doctor_name || "—",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-white">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <BackButton onClick={onBack} />
          <div>
            <p className="text-sm font-bold text-gray-900">
              {formatThaiDate(visit.vstdate)}
            </p>
            <p className="text-xs text-gray-400">
              {patient.pname}
              {patient.fname} {patient.lname} · HN {patient.hn}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {fields.map((f) => (
          <FieldRow key={f.label} {...f} />
        ))}
      </div>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  patient,
  onBack,
}: {
  patient: PatientRow;
  onBack: () => void;
}) {
  const { history, loading } = usePatientHistory(patient.hn);
  const [selectedVisit, setSelectedVisit] = useState<HistoryRow | null>(null);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col bg-white rounded-2xl overflow-hidden z-10"
      {...slideIn}
    >
      <AnimatePresence>
        {selectedVisit && (
          <motion.div
            className="absolute inset-0 flex flex-col bg-white rounded-2xl overflow-hidden z-20"
            {...slideIn}
          >
            <VisitDetail
              visit={selectedVisit}
              patient={patient}
              onBack={() => setSelectedVisit(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        <BackButton onClick={onBack} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {patient.pname}
            {patient.fname} {patient.lname}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            HN {patient.hn} · ประวัติ 20 ครั้งล่าสุด
          </p>
        </div>
        <History size={15} className="text-green-600 shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <History size={32} className="text-gray-200" />
            <p className="text-sm text-gray-400">ไม่พบประวัติการรักษา</p>
          </div>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-2.5">
              {history.map((h, i) => (
                <motion.div
                  key={h.vn}
                  className="relative flex gap-3"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025 }}
                >
                  <div
                    className={`absolute -left-5 top-4 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${i === 0 ? "bg-green-500" : "bg-gray-300"}`}
                  />
                  <button
                    onClick={() => setSelectedVisit(h)}
                    className={`flex-1 rounded-xl px-4 py-3 border text-left w-full transition-all hover:shadow-sm group
                      ${i === 0 ? "bg-green-50 border-green-200 hover:border-green-400" : "bg-white border-gray-100 hover:border-green-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-gray-500">
                        {formatThaiDate(h.vstdate)}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-400 tabular-nums">
                          {h.vsttime?.slice(0, 5)}
                        </span>
                        <ChevronRight
                          size={12}
                          className="text-gray-300 group-hover:text-green-500 transition-colors"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 font-semibold mt-1 leading-snug">
                      {h.dx_name || h.pdx || "—"}
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {h.department && (
                        <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                          {h.department}
                        </span>
                      )}
                      {h.pttype_name && (
                        <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">
                          {h.pttype_name}
                        </span>
                      )}
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Patient Detail ───────────────────────────────────────────────────────────

function PatientDetail({
  patient,
  onClose,
}: {
  patient: PatientRow;
  onClose: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const male = isMale(patient.sex);

  const fields = [
    {
      icon: Calendar,
      label: "วันที่รับบริการ",
      value: `${formatThaiDate(patient.vstdate)}  ${patient.vsttime?.slice(0, 5) ?? ""}`,
    },
    {
      icon: Activity,
      label: "การวินิจฉัย (ICD-10)",
      value: patient.dx_name || patient.pdx || "—",
    },
    {
      icon: Building2,
      label: "แผนก / หน่วยบริการ",
      value: patient.department || "—",
    },
    {
      icon: Shield,
      label: "สิทธิ์การรักษา",
      value: patient.pttype_name || "—",
    },
    {
      icon: Stethoscope,
      label: "แพทย์ผู้ดูแล",
      value: patient.doctor_name || "—",
    },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-white rounded-2xl flex flex-col z-10 overflow-hidden"
      {...slideIn}
    >
      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            patient={patient}
            onBack={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-5 pt-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <BackButton onClick={onClose} />
          <span style={{ color: male ? "#2563eb" : "#ec4899" }}>
            {male ? <Mars size={16} /> : <Venus size={16} />}
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: male ? "#2563eb" : "#ec4899" }}
          >
            {male ? "ชาย" : "หญิง"}
          </span>
          <span className="text-xs text-gray-400">· {patient.age_y} ปี</span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black"
            style={{
              backgroundColor: male ? "#dbeafe" : "#fce7f3",
              color: male ? "#1d4ed8" : "#db2777",
            }}
          >
            {patient.pname?.charAt(0) ?? (male ? "ช" : "ญ")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-gray-900 leading-snug truncate">
              {patient.pname}
              {patient.fname} {patient.lname}
            </p>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              HN {patient.hn}
            </p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {fields.map((f) => (
          <FieldRow key={f.label} {...f} />
        ))}
        {patient.cid && (
          <div className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-black text-gray-500">ID</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-400 mb-1">
                เลขบัตรประชาชน
              </p>
              <p className="text-sm text-gray-900 font-bold font-mono tracking-wider">
                {patient.cid}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 shrink-0">
        <button
          onClick={() => setShowHistory(true)}
          className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 active:scale-[0.98] text-white text-sm font-bold py-3 rounded-xl transition-all"
        >
          <History size={15} /> ดูประวัติการรักษาย้อนหลัง
        </button>
      </div>
    </motion.div>
  );
}

// ─── Patient Card ─────────────────────────────────────────────────────────────

function PatientCard({
  patient,
  index,
  onSelect,
}: {
  patient: PatientRow;
  index: number;
  onSelect: (p: PatientRow) => void;
}) {
  const male = isMale(patient.sex);
  return (
    <motion.button
      onClick={() => onSelect(patient)}
      className="w-full text-left group"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.01, 0.2), duration: 0.15 }}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100 hover:border-green-300 hover:shadow-sm transition-all duration-150">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: male ? "#dbeafe" : "#fce7f3" }}
        >
          {male ? (
            <Mars size={18} style={{ color: "#2563eb" }} />
          ) : (
            <Venus size={18} style={{ color: "#ec4899" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {patient.pname}
              {patient.fname} {patient.lname}
            </span>
            <span
              className={`text-[10px] font-bold shrink-0 ${male ? "text-blue-500" : "text-pink-500"}`}
            >
              {patient.age_y}ป
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span className="text-[11px] text-gray-400 shrink-0">
              HN {patient.hn}
            </span>
            {patient.department && (
              <>
                <span className="text-gray-200 shrink-0">·</span>
                <span className="text-[11px] text-gray-400 truncate">
                  {patient.department}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400 tabular-nums">
            {patient.vsttime?.slice(0, 5)}
          </span>
          <ChevronRight
            size={14}
            className="text-gray-300 group-hover:text-green-500 transition-colors"
          />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({
  patients,
  genderFilter,
  setGenderFilter,
}: {
  patients: PatientRow[];
  genderFilter: GenderFilter;
  setGenderFilter: (g: GenderFilter) => void;
}) {
  const total = patients.length;
  const male = patients.filter((p) => isMale(p.sex)).length;
  const female = total - male;

  const buttons: Array<{
    key: GenderFilter;
    label: string;
    activeClass: string;
  }> = [
    {
      key: "all",
      label: `ทั้งหมด ${total} ราย`,
      activeClass:
        "bg-gray-800 text-white border-gray-800 ring-2 ring-gray-300",
    },
    {
      key: "male",
      label: `♂ ชาย ${male}`,
      activeClass:
        "bg-blue-500 text-white border-blue-500 ring-2 ring-blue-200",
    },
    {
      key: "female",
      label: `♀ หญิง ${female}`,
      activeClass:
        "bg-pink-500 text-white border-pink-500 ring-2 ring-pink-200",
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {buttons.map(({ key, label, activeClass }) => (
        <button
          key={key}
          onClick={() => setGenderFilter(key)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
            ${genderFilter === key ? activeClass : "bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-200"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Back Button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors shrink-0"
    >
      <ArrowLeft size={15} />
    </button>
  );
}

// ─── PatientDetailModal ───────────────────────────────────────────────────────

export interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardLabel: string;
  cardType: string;
  start: string;
  end: string;
  infoLabel: string;
}

export default function PatientDetailModal({
  isOpen,
  onClose,
  cardLabel,
  cardType,
  start,
  end,
  infoLabel,
}: PatientDetailModalProps) {
  const {
    patients,
    loading,
    search,
    setSearch,
    genderFilter,
    setGenderFilter,
    filtered,
    selectedPatient,
    selectPatient,
    clearPatient,
    modalSize,
    startResize,
  } = usePatientModal(isOpen, start, end, cardType);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
              {/* Header */}
              <div className="bg-white border-b border-gray-100 px-5 pt-4 pb-3 shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 truncate">
                      {cardLabel}
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      ข้อมูล {infoLabel}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                  >
                    <X size={12} strokeWidth={2.5} /> ปิด
                  </button>
                </div>

                {patients.length > 0 && !loading && (
                  <div className="mb-3">
                    <StatsRow
                      patients={patients}
                      genderFilter={genderFilter}
                      setGenderFilter={setGenderFilter}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-green-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-green-100 transition-all">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, HN, เลขบัตร, แผนก..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {loading && (
                  <div className="space-y-2 pt-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[60px] rounded-xl bg-white border border-gray-100 animate-pulse"
                        style={{ animationDelay: `${i * 40}ms` }}
                      />
                    ))}
                  </div>
                )}

                {!loading && filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <UserRound size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">
                      {search ? `ไม่พบ "${search}"` : "ไม่พบข้อมูล"}
                    </p>
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="text-xs text-green-700 underline font-semibold"
                      >
                        ล้างการค้นหา
                      </button>
                    )}
                  </div>
                )}

                {!loading &&
                  filtered.map((p, i) => (
                    <PatientCard
                      key={p.vn || `${p.hn}-${i}`}
                      patient={p}
                      index={i}
                      onSelect={selectPatient}
                    />
                  ))}
              </div>

              {/* Patient detail panel */}
              <AnimatePresence>
                {selectedPatient && (
                  <div className="absolute inset-0 z-30 rounded-2xl overflow-hidden">
                    <PatientDetail
                      patient={selectedPatient}
                      onClose={clearPatient}
                    />
                  </div>
                )}
              </AnimatePresence>

              {/* Footer */}
              {!loading && patients.length > 0 && (
                <div className="px-5 py-2.5 bg-white border-t border-gray-100 shrink-0">
                  <p className="text-[11px] text-gray-400 text-center">
                    {search || genderFilter !== "all" ? (
                      <>
                        แสดง{" "}
                        <span className="font-bold text-gray-700">
                          {filtered.length.toLocaleString()}
                        </span>{" "}
                        จาก {patients.length.toLocaleString()} ราย
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-gray-700">
                          {patients.length.toLocaleString()}
                        </span>{" "}
                        ราย · กดชื่อเพื่อดูรายละเอียด
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Resize handle */}
              <div
                onMouseDown={startResize}
                className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize text-gray-300 hover:text-gray-500 transition-colors z-40"
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
