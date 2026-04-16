// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useOpdData }       from "./hooks/useOpdData";
export { useIpdData }       from "./hooks/useIpdData";
export { useBedOccupancy }  from "./hooks/useBedOccupancy";
export { usePatientModal, usePatientHistory } from "./hooks/usePatientModal";

// ─── Constants ────────────────────────────────────────────────────────────────
export { OPD_CARDS, DATE_PRESETS, WARD_CONFIG, getBedOccupancyColor } from "./constants/dashboard.constants";

// ─── Utils ────────────────────────────────────────────────────────────────────
export { fmtDate, toThaiDate, toThaiDateLabel, getPresetRange, isMale } from "./utils/dashboard.utils";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  OpdSummary, OpdCardKey, DatePreset,
  WardDisplayItem, IpdApiSummary,
  PatientRow, HistoryRow, GenderFilter,
  OccupancyRow, ModalState,
} from "./types/dashboard.types";

// ─── Components ───────────────────────────────────────────────────────────────
export { default as OpdSection }           from "./components/OpdSection";
export { default as IpdSection }           from "./components/IpdSection";
export { default as BedOccupancyChart }    from "./components/BedOccupancyChart";
export { default as PatientDetailModal }   from "./components/PatientDetailModal";
export { Shimmer, SectionShell, DateRangeToolbar } from "./components/ui/DashboardUI";