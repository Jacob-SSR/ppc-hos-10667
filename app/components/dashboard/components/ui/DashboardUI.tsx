"use client";

import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import ThaiDateInput from "@/app/components/ThaiDateInput";
import type { DatePreset } from "../../types/dashboard.types";
import { DATE_PRESETS } from "../../constants/dashboard.constants";

// ─── Shimmer ──────────────────────────────────────────────────────────────────

export function Shimmer({ className = "h-40" }: { className?: string }) {
  return (
    <div className={`${className} rounded-xl bg-gray-100 animate-pulse`} />
  );
}

// ─── Section Shell ────────────────────────────────────────────────────────────

interface SectionShellProps {
  title: string;
  children: React.ReactNode;
}

export function SectionShell({ title, children }: SectionShellProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-lg font-bold text-[#717171] mb-3">{title}</h4>
      {children}
    </div>
  );
}

// ─── Date Range Toolbar ───────────────────────────────────────────────────────

interface DateRangeToolbarProps {
  preset?: DatePreset;
  presets?: DatePreset[];
  onPresetChange?: (p: DatePreset) => void;
  start: Date | null;
  end: Date | null;
  onStartChange: (d: Date | null) => void;
  onEndChange: (d: Date | null) => void;
  onSearch: () => void;
  loading?: boolean;
  infoLabel?: string;
}

export function DateRangeToolbar({
  preset,
  presets = DATE_PRESETS,
  onPresetChange,
  start,
  end,
  onStartChange,
  onEndChange,
  onSearch,
  loading = false,
  infoLabel,
}: DateRangeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
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

      <DatePicker
        selected={start}
        onChange={onStartChange}
        dateFormat="dd/MM/yyyy"
        locale={th}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        customInput={<ThaiDateInput />}
      />

      <DatePicker
        selected={end}
        onChange={onEndChange}
        dateFormat="dd/MM/yyyy"
        locale={th}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        customInput={<ThaiDateInput />}
      />

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

      {infoLabel && (
        <span className="text-sm text-[#717171] ml-1">
          ข้อมูล: <strong>{infoLabel}</strong>
        </span>
      )}
    </div>
  );
}
