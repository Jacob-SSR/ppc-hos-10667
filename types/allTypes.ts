import { RowDataPacket } from "mysql2/promise";

export interface DbRow extends RowDataPacket { }

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

export interface IpdDischargeRow extends DbRow {
  dchtype_name: string | null;
  hn: string;
  cid: string | null;
  an: string;
  pname: string;
  fname: string;
  lname: string;
  regdate: string;
  regtime: string;
  dchdate: string;
  dchtime: string;
  ward_code: string;
  doctor_name: string | null;
  admdate: string;
  pdx: string;
  pttype_name: string;
  los: number;
  address: string;
}

export interface IpdWardStat extends DbRow {
  ward_code: string;
  total: number;
  unique_patients: number;
  avg_los: number;
  discharge_normal: number;
  discharge_other: number;
  admit_total: number;
}

export interface IpdPttypeRow extends DbRow {
  pttype_name: string;
  total: number;
}

export interface IpdDchtypeRow extends DbRow {
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