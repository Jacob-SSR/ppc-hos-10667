// components/ui/DateRangeToolbar.tsx
// แทนที่ toolbar ที่เขียนซ้ำใน:
//   - OpdSection.tsx    (DatePicker คู่ + preset select + Search)
//   - IpdSection.tsx    (DatePicker เดี่ยว + Search)
//   - ShiftStatsPage    (DatePicker คู่ + Search)
//   - ReportTable.tsx   (DatePicker คู่ + Search) ← ใช้ผ่าน useReportTable อยู่แล้ว
//
// แทนที่ไฟล์ DashboardUI.tsx ที่มีอยู่แต่ใช้ได้ไม่ครบ

"use client";

import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import ThaiDateInput from "@/app/components/ThaiDateInput";

// ── Preset options ─────────────────────────────────────────────────────────────
export type DatePreset = "วันนี้" | "สัปดาห์นี้" | "เดือนนี้" | "ปีนี้" | "กำหนดเอง";

export const DATE_PRESETS: DatePreset[] = ["วันนี้", "สัปดาห์นี้", "เดือนนี้", "ปีนี้"];

// ── Props ──────────────────────────────────────────────────────────────────────

interface DateRangeToolbarProps {
  // Date values
  start: Date | null;
  end: Date | null;
  onStartChange: (d: Date | null) => void;
  onEndChange: (d: Date | null) => void;

  // Search
  onSearch: () => void;
  loading?: boolean;

  // Preset (optional — ถ้าไม่ส่งมาจะไม่แสดง select)
  preset?: DatePreset;
  presets?: DatePreset[];
  onPresetChange?: (p: DatePreset) => void;

  // Mode: "range" = 2 picker, "single" = 1 picker (IpdSection)
  mode?: "range" | "single";

  // Info label ใต้ toolbar (optional)
  infoLabel?: string;
}

export function DateRangeToolbar({
  start,
  end,
  onStartChange,
  onEndChange,
  onSearch,
  loading = false,
  preset,
  presets = DATE_PRESETS,
  onPresetChange,
  mode = "range",
  infoLabel,
}: DateRangeToolbarProps) {
  const commonPickerProps = {
    dateFormat: "dd/MM/yyyy",
    locale: th,
    showMonthDropdown: true,
    showYearDropdown: true,
    dropdownMode: "select" as const,
    yearDropdownItemNumber: 20,
    customInput: <ThaiDateInput />,
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      {/* Preset select */}
      {onPresetChange && (
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as DatePreset)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"
        >
          {presets.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      )}

      {/* Start picker */}
      <DatePicker
        selected={start}
        onChange={onStartChange}
        {...commonPickerProps}
      />

      {/* End picker (range mode only) */}
      {mode === "range" && (
        <DatePicker
          selected={end}
          onChange={onEndChange}
          {...commonPickerProps}
        />
      )}

      {/* Search button */}
      <motion.button
        onClick={onSearch}
        disabled={loading}
        className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
        whileTap={{ scale: 0.95 }}
      >
        {loading ? (
          <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin inline-block" />
        ) : (
          <Search size={14} />
        )}
        ค้นหา
      </motion.button>

      {/* Info label */}
      {infoLabel && (
        <span className="text-sm text-[#717171] ml-1">
          ข้อมูล: <strong>{infoLabel}</strong>
        </span>
      )}
    </div>
  );
}

/*
  วิธีใช้:
  ─────────────────────────────────────────────────────────────────────────────
  import { DateRangeToolbar } from "@/components/ui/DateRangeToolbar";

  // OpdSection (range + preset):
  <DateRangeToolbar
    start={start}   end={end}
    onStartChange={(d) => { if (d) { setStart(d); setPreset("กำหนดเอง"); } }}
    onEndChange={(d)   => { if (d) { setEnd(d);   setPreset("กำหนดเอง"); } }}
    preset={preset}
    onPresetChange={handlePreset}
    onSearch={handleSearch}
    loading={loading}
    infoLabel={infoLabel}
  />

  // IpdSection (single date):
  <DateRangeToolbar
    mode="single"
    start={date}  end={null}
    onStartChange={(d) => { if (d) setDate(d); }}
    onEndChange={() => {}}
    onSearch={handleSearch}
    loading={loading}
    infoLabel={infoLabel}
  />

  // ShiftStatsPage (range ไม่มี preset):
  <DateRangeToolbar
    start={start}  end={end}
    onStartChange={setStart}
    onEndChange={setEnd}
    onSearch={fetchData}
    loading={loading}
  />
  ─────────────────────────────────────────────────────────────────────────────
*/