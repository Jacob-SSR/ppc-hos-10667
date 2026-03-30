// ─────────────────────────────────────────────────────────────
//  Shared primitive / utility types
// ─────────────────────────────────────────────────────────────
export type ToastType = "success" | "error";

export interface ToastProps {
  message: string;
  type: ToastType;
}

export interface ThaiDateInputProps {
  value?: string;
  onClick?: () => void;
}

export interface ExportOptions {
  sheetName?: string;
  filePrefix: string;
  dateKeys?: string[];
}

// ─────────────────────────────────────────────────────────────
//  Report rows
// ─────────────────────────────────────────────────────────────
export interface ReportRow {
  vn: string;
  hn: string;
  วันที่: string;
  คำนำหน้า: string;
  ชื่อ: string;
  นามสกุล: string;
  อายุ: number;
  เพศ: string;
  รหัสโรงพยาบาลหลัก: string;
  รหัสโรงพยาบาลรอง: string;
  รหัสสิทธิ์: string;
  ชื่อสิทธิ์: string;
}

export interface NoEndpointRow {
  วันที่: string;
  เวลา: string;
  cid: string;
  มูลค่า: number;
  vn: string;
  hn: string;
  ชื่อ: string;
  แผนก: string;
  อาการสำคัญ: string;
  ชื่อสิทธิ์: string;
}

export interface UcOutsideDentalRow {
  วันที่: string;
  vn: string;
  hn: string;
  การวินิจฉัย: string;
  รหัสที่อยู่: string;
  รหัสสิทธิ์: string;
  ชื่อสิทธิ์: string;
  รหัสโรงพยาบาลหลัก: string;
  ชื่อโรงพยาบาลหลัก: string;
  มูลค่า: number;
  เงินที่จ่าย: number;
  รวมอื่นๆ: number;
  รวมทั้งหมด: number;
  ส่วนต่าง: number;
  อาการสำคัญ: string;
  แผนก: string;
}

export interface UcOutsideRow {
  vn: string;
  hn: string;
  วันที่: string;
  เวลา: string;
  แผนก: string;
  คำนำหน้า: string;
  ชื่อ: string;
  นามสกุล: string;
  เบอร์โทร: string;
  อายุ: number;
  เพศ: string;
  รหัสโรงพยาบาลหลัก: string;
  ชื่อโรงพยาบาลหลัก: string;
  จังหวัด: string;
  รหัสสิทธิ์: string;
  ชื่อสิทธิ์: string;
  มูลค่า: number;
  รหัสสิทธิ์หลัก: string;
}

export interface ServiceUnitRow {
  "ชื่อ-นามสกุล": string;
  hn: string;
  cid: string;
  เบอร์โทร: string;
  เบอร์ผู้แจ้ง: string;
  บ้านเลขที่: string;
  หมู่: string;
  ที่อยู่: string;
  วันที่: string;
  ชื่อสิทธิ์: string;
  ชื่อโรงพยาบาลหลัก: string;
  รหัสโรงพยาบาลหลัก: string;
  รหัสสิทธิ์: string;
  หน่วยบริการ: string;
}

// ─────────────────────────────────────────────────────────────
//  Dashboard
// ─────────────────────────────────────────────────────────────
export interface DashboardSummary {
  totalVisit: number;
  noEndpoint: number;
  ucOutside: number;
  unpaidTotal: number;
}

export interface DashboardDaily {
  date: string;
  total: number;
  noEndpoint?: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  daily: DashboardDaily[];
}

// ─────────────────────────────────────────────────────────────
//  IPD
// ─────────────────────────────────────────────────────────────
export interface IpdDischargeRow {
  dchtype_name: string;
  hn: string;
  cid: string;
  an: string;
  pname: string;
  fname: string;
  lname: string;
  regdate: string;
  regtime: string;
  dchdate: string;
  dchtime: string;
  ward_code: string;
  doctor_name: string;
  admdate: string;
  pdx: string;
  pttype_name: string;
  los: number;
  address: string;
}

export interface IpdWardStat {
  ward_code: string;
  total: number;
  unique_patients: number;
  avg_los: number;
  discharge_normal: number;
  discharge_other: number;
  admit_total: number;
}

export interface IpdPttypeRow {
  pttype_name: string;
  total: number;
}

export interface IpdDchtypeRow {
  dchtype_name: string;
  total: number;
}

export interface IpdSummaryData {
  summary: {
    total: number;
    unique_patients: number;
    avg_los: number;
  };
  byWard: IpdWardStat[];
  byPttype: IpdPttypeRow[];
  byDchtype: IpdDchtypeRow[];
}

// ─────────────────────────────────────────────────────────────
//  Shift stats
// ─────────────────────────────────────────────────────────────
export interface ShiftSlotStat {
  shiftName: string;
  slotLabel: string;
  visits: number;
  patients: number;
}

export interface ShiftSummary {
  shiftName: string;
  totalVisits: number;
  totalPatients: number;
}

export interface ShiftStatsResult {
  month: string;
  slots: ShiftSlotStat[];
  summary: ShiftSummary[];
}

// ─────────────────────────────────────────────────────────────
//  Monthly dashboard
// ─────────────────────────────────────────────────────────────
export interface MonthlyDashboardRow {
  month: string;
  label: string;
  totalVisit: number;
  totalPatient: number;
  noEndpoint: number;
  ucOutside: number;
  unpaidTotal: number;
  visitChange: number | null;
  patientChange: number | null;
  noEndpointChange: number | null;
  ucOutsideChange: number | null;
}

// ─────────────────────────────────────────────────────────────
//  Component props
// ─────────────────────────────────────────────────────────────
export interface ReportTableProps {
  apiPath: string;
  exportFilePrefix: string;
  dateKeys?: string[];
  sheetName?: string;
  columnFilterKeys?: string[];
  columnFilterLabels?: Record<string, string>;
}

export interface UseReportTableOptions {
  apiPath: string;
  columnFilterKeys?: string[];
}

export interface UseReportTableReturn<T = Record<string, unknown>> {
  data: T[];
  loading: boolean;
  start: Date | null;
  setStart: (date: Date | null) => void;
  end: Date | null;
  setEnd: (date: Date | null) => void;
  search: string;
  handleSearch: (val: string) => void;
  sortKey: string | null;
  sortAsc: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  columnFilters: Record<string, string>;
  columnFilterOptions: Record<string, string[]>;
  setColumnFilter: (key: string, val: string) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  sortedData: T[];
  paginatedData: T[];
  totalPages: number;
  fetchData: () => Promise<void>;
  handleSort: (key: string) => void;
}