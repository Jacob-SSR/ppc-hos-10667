// app/pages/ktb-dashboard/types.ts
// Types สำหรับ KTB Dashboard — ใช้ร่วมกันระหว่าง page.tsx และ KtbCrossTab.tsx

export interface KtbServiceSummary {
  รายการขอเบิก: string;
  รายการสั้น: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  สถานะ: string;
}

export interface KtbUnitSummary {
  หน่วยบริการ: string;
  hcodeKey: string;
  isHospital: boolean;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  รายการ: KtbServiceSummary[];
}

export interface KtbBatchSummary {
  งวดจ่าย: string;
  จำนวน: number;
  เรียกเก็บ: number;
  ชดเชย: number;
  ไม่ชดเชย: number;
  หน่วยบริการ: KtbUnitSummary[];
}

export interface KtbDashboardData {
  updatedAt: string;
  totalRows: number;
  totalClaim: number;
  totalComp: number;
  totalNoComp: number;
  totalPending: number;
  batches: KtbBatchSummary[];
  units: KtbUnitSummary[];
}