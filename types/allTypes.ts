export interface ReportRow {
  vn: string;
  hn: string;
  vstdate: string;

  pname: string;
  fname: string;
  lname: string;

  age: number;
  gender: string;

  hospmain: string;
  hospsub: string;

  pttype: string;
  pttype_name: string;
}

export interface ExportOptions {
  sheetName?: string;
  filePrefix: string;
  dateKeys?: string[];
}

export interface NoEndpointRow {
  DATE: string;
  vsttime: string;
  cid: string;
  income: number;
  vn: string;
  hn: string;
  Name: string;
  Department: string;
  cc: string;
  pttypename: string;
}

export interface UcOutsideDentalRow {
  vstdate: string;
  vn: string;
  hn: string;
  pdx: string;
  aid: string;
  pttype: string;
  pttype_name: string;
  hospmain: string;
  hospmain_name: string;
  income: number;
  paid_money: number;
  sum_other: number;
  sum_total: number;
  ss: number;
  cc: string;
  department: string;
}

export interface UcOutsideRow {
  vn: string;
  hn: string;
  vstdate: string;
  vsttime: string;
  department: string;
  pname: string;
  fname: string;
  lname: string;
  hometel: string;
  age: number;
  gender: string;
  hospmain: string;
  hospmain_name: string;
  province_name: string;
  pttype: string;
  pttype_name: string;
  income: number;
  hipdata_code: string;
}

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

export interface ReportTableProps {
  apiPath: string;
  exportFilePrefix: string;
  dateKeys?: string[];
  sheetName?: string;
  columnFilterKeys?: string[];
  columnFilterLabels?: Record<string, string>;
}

export interface ThaiDateInputProps {
  value?: string;
  onClick?: () => void;
}

export type ToastType = "success" | "error";

export interface ToastProps {
  message: string;
  type: ToastType;
}

export interface UseReportTableOptions {
  apiPath: string;
  columnFilterKeys?: string[];
}

export interface UseReportTableReturn<T = any> {
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