"use client";

import { ArrowRight } from "lucide-react";
import { CalendarDays, Info } from "lucide-react";
import { OPD_CARDS, DATE_PRESETS } from "../constants/dashboard.constants";
import { DateRangeToolbar, Shimmer } from "./ui/DashboardUI";
import { useOpdData } from "../hooks/useOpdData";
import PatientDetailModal from "./PatientDetailModal";

import type { OpdSummary, DatePreset } from "../types/dashboard.types";
import { fmtDate } from "./utils/dashboard.utils";

// ─── OPD Card ─────────────────────────────────────────────────────────────────

interface OpdCardProps {
  label: string;
  bg: string;
  Icon: React.ElementType;
  displayValue: string;
  hasData: boolean;
  onDetail: () => void;
}

function OpdCard({
  label,
  bg,
  Icon,
  displayValue,
  hasData,
  onDetail,
}: OpdCardProps) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-3 text-white"
      style={{ backgroundColor: bg }}
    >
      <p className="text-sm font-semibold text-center leading-snug">{label}</p>
      <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
        <Icon size={24} color="white" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-bold text-center">{displayValue}</p>
      <button
        onClick={() => hasData && onDetail()}
        disabled={!hasData}
        className={`flex items-center gap-1.5 border border-white rounded-full px-4 py-1 text-xs transition-all
          ${hasData ? "hover:bg-white/20 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
      >
        รายละเอียด <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ─── Display value helper ─────────────────────────────────────────────────────

function getDisplayValue(
  summary: OpdSummary | null,
  visitKey: keyof OpdSummary,
  patKey: keyof OpdSummary | null,
): string {
  if (!summary) return "—";
  const visits = summary[visitKey];
  const patients = patKey ? summary[patKey] : null;
  if (visits == null) return "—";
  if (patients != null)
    return `${Number(patients).toLocaleString()} คน (${Number(visits).toLocaleString()} ครั้ง)`;
  return `${Number(visits).toLocaleString()} ราย`;
}

// ─── OpdSection ───────────────────────────────────────────────────────────────

export default function OpdSection() {
  const {
    summary,
    loading,
    infoLabel,
    start,
    end,
    preset,
    setStart,
    setEnd,
    setPreset,
    handlePreset,
    handleSearch,
    modal,
    openModal,
    closeModal,
  } = useOpdData();

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-lg font-bold text-[#717171] mb-3">
          ภาพรวมผู้รับบริการ OPD วันนี้
        </h4>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="flex items-center gap-2 text-[#717171]">
            <CalendarDays size={16} />
            <div>
              <p className="text-sm">ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)</p>
              <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
            </div>
          </div>
          <div className="ml-auto">
            <DateRangeToolbar
              preset={preset}
              presets={[...DATE_PRESETS, "กำหนดเอง"] as DatePreset[]}
              onPresetChange={handlePreset}
              start={start}
              end={end}
              onStartChange={(d) => {
                if (d) {
                  setStart(d);
                  setPreset("กำหนดเอง");
                }
              }}
              onEndChange={(d) => {
                if (d) {
                  setEnd(d);
                  setPreset("กำหนดเอง");
                }
              }}
              onSearch={handleSearch}
              loading={loading}
            />
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
          <Info size={14} />
          <span>
            แสดงข้อมูล การ์ด:{" "}
            <span className="font-bold">{infoLabel || "—"}</span>
          </span>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: OPD_CARDS.length }).map((_, i) => (
                <Shimmer key={i} className="h-[168px] rounded-2xl" />
              ))
            : OPD_CARDS.map((card) => (
                <OpdCard
                  key={card.cardType}
                  label={card.label}
                  bg={card.bg}
                  Icon={card.Icon}
                  displayValue={getDisplayValue(
                    summary,
                    card.visitKey,
                    card.patKey,
                  )}
                  hasData={Boolean(summary && summary[card.visitKey] != null)}
                  onDetail={() => openModal(card.label, card.cardType)}
                />
              ))}
        </div>
      </div>

      <PatientDetailModal
        isOpen={modal.open}
        onClose={closeModal}
        cardLabel={modal.cardLabel}
        cardType={modal.cardType}
        start={fmtDate(start)}
        end={fmtDate(end)}
        infoLabel={infoLabel}
      />
    </>
  );
}
