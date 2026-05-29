// lib/ip-homeward.types.ts
// TypeScript interfaces สำหรับ IP & Home Ward Dashboard (รพ.พลับพลาชัย ปีงบ 2569)
// ใช้ร่วมกัน API (route.ts) ↔ Page (ip-homeward-dashboard)

/** กองทุน/สิทธิ หลัก 4 กลุ่ม */
export type FundKey = "UC" | "OFC/LGO" | "SSS" | "Other";

/** บรรทัด Statement IP UC (จากชีต "สรุป") */
export interface IpStatementRow {
  label: string; // "ต.ค.68"
  period: string; // งวด เช่น "6810"
  cases: number; // จำนวนราย (ผ่าน A)
  adjrw: number; // ผลรวม ADJRW
  cmi: number | null; // CMI/STM
  pay: number; // จ่ายชดเชย (บาท)
  deduct: number; // ยอดหักเงินเดือน สป.
  net: number; // ยอดหลังหักเงินเดือน
}

/** ข้อมูลรายเดือน (จากชีตรายเดือน 1068..0569) */
export interface IpMonthRow {
  label: string; // "ต.ค.68"
  sheet: string; // ชื่อแท็บ เช่น "1068"
  dc: number; // D/C ทั้งหมด (ทุกสิทธิ)
  uc: number;
  ofc: number; // OFC/LGO/BKK/ข้าราชการ
  sss: number;
  other: number;
  preRW: number; // ผลรวม Pre adj.RW
  postRW: number; // ผลรวม adj.RW (post)
  cmi: number | null; // จาก statement (UC)
  sendDays: number; // เฉลี่ยระยะส่งข้อมูล (วัน)
}

/** สรุปรายแพทย์ (รวมทุกเดือน) */
export interface IpDoctorRow {
  name: string;
  cases: number;
  adjrw: number;
  avgRw: number; // adjrw / cases
  avgLos: number; // วันนอนเฉลี่ย
  cost: number; // ค่ารักษารวม
  funds: Record<FundKey, number>;
  monthlyCases: number[]; // เรียงตาม months
  monthlyRw: number[];
}

/** สรุปรายกองทุน (รวมทุกเดือน) */
export interface IpFundRow {
  name: FundKey;
  cases: number;
  adjrw: number;
  avgRw: number;
  avgLos: number;
  cost: number;
  monthlyCases: number[];
  monthlyRw: number[];
}

/** Home Ward (จากชีต "Admit Home Ward") */
export interface HomeWardSummary {
  dc: number; // D/C ทั้งหมด
  coded: number; // ลงรหัสแล้ว
  sent: number; // ส่ง Claim แล้ว
  notSent: number; // ยังไม่ส่ง
  preRW: number;
  postRW: number;
  paid: number; // ชดเชยแล้ว (บาท)
  startDate: string; // เริ่มโครงการ
  funds: Record<FundKey, number>;
}

/** payload รวมที่ API ส่งกลับ */
export interface IpHomeWardData {
  updatedAt: string;
  fiscalYear: string; // "2569"
  months: string[]; // labels เรียงเวลา
  monthly: IpMonthRow[];
  statement: IpStatementRow[];
  statementTotal: IpStatementRow; // แถวรวม
  doctors: IpDoctorRow[]; // เรียง cases มาก→น้อย
  funds: IpFundRow[];
  homeward: HomeWardSummary;
  kpi: {
    dcTotal: number; // D/C รวมทุกสิทธิ
    ucPassA: number; // UC ผ่าน A (ส่งเบิก)
    adjrwTotal: number;
    cmiAvg: number;
    payTotal: number;
    netTotal: number;
    doctorCount: number;
    avgSendDays: number;
  };
}
