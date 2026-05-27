import {
  LayoutDashboard,
  BarChart3,
  FileEdit,
  UserX,
  Smile,
  UserRound,
  UserCheck,
  Users,
  HeartPulse,
  Activity,
  Baby,
  BedDouble,
  UserMinus,
  AlertTriangle,
  Banknote,
  Wallet,
  Settings,
  UserSearch,
  Pill,
} from "lucide-react";

import { SidebarItem, SidebarGroup, SidebarSubGroup } from "./types";


export const DASHBOARD_GROUPS: SidebarSubGroup[] = [
  {
    title: "Dashboard หลัก",
    items: [
      {
        label: "Overview",
        href: "/pages/dashboard",
        icon: LayoutDashboard,
        group: "main",
      },
      {
        label: "สถิติผู้รับบริการแยกเวร",
        href: "/pages/shift-stats",
        icon: BarChart3,
        group: "main",
      },
      {
        label: "บันทึกงาน IT",
        href: "/pages/it-worklog",
        icon: Activity,
        group: "main",
      },
    ],
  },

  {
    title: "งานเคลม / การเงิน",
    items: [
      {
        label: "จัดสรรผลงานบริการ - MOPH CLAIM",
        href: "/pages/billing-dashboard",
        icon: Banknote,
        group: "claim",
      },
      {
        label: "KTB",
        href: "/pages/ktb-dashboard",
        icon: Wallet,
        group: "claim",
      },
      {
        label: "DMTB",
        href: "/pages/dmtb-dashboard",
        icon: Activity,
        group: "claim",
      },
      {
        label: "STM OPD-UCS",
        href: "/pages/stm-dashboard",
        icon: Banknote,
        group: "claim",
      },
    ],
  },

  {
    title: "งานโรค",
    items: [
      {
        label: "อุบัติเหตุ",
        href: "/pages/accident-dashboard",
        icon: AlertTriangle,
        group: "disease",
      },
      {
        label: "RDU Antibiotic Smart Use",
        href: "/pages/rdu-dashboard",
        icon: Pill,
        group: "disease",
      },
      {
        label: "ผู้ป่วยยาเสพติด",
        href: "/pages/drug-dashboard",
        icon: Activity,
        group: "disease",
      },
      {
        label: "Home Ward ยาเสพติด",
        href: "/pages/homeward-dashboard",
        icon: BedDouble,
        group: "disease",
      },
      {
        label: "Sepsis",
        href: "/pages/sepsis-dashboard",
        icon: Activity,
        group: "disease",
      },
      {
        label: "วัณโรค (TB)",
        href: "/pages/tb-dashboard",
        icon: Activity,
        group: "disease",
      },
    ],
  },
];

// =========================
// REPORT
// =========================
export const REPORT_ITEMS: SidebarItem[] = [
  {
    label: "แก้ไขสิทธิ์หลัก 10667 เป็น CUP Split",
    href: "/pages/report",
    icon: FileEdit,
    group: "report",
  },
  {
    label: "คนไทยที่ยังไม่มี endpoint",
    href: "/pages/no-endpoint",
    icon: UserX,
    group: "report",
  },
  {
    label: "UC ต่างจังหวัดที่มาทำฟัน",
    href: "/pages/uc-outside-dental",
    icon: Smile,
    group: "report",
  },
  {
    label: "ผู้ป่วยนอก UC สิทธิ์ต่างจังหวัด",
    href: "/pages/uc-outside",
    icon: UserRound,
    group: "report",
  },
  {
    label: "ผู้รับบริการแต่ขึ้นทะเบียนบัตรทองที่อื่น",
    href: "/pages/service-unit",
    icon: UserCheck,
    group: "report",
  },
  {
    label: "รายชื่อผู้ป่วยที่ไม่มี (CC/Diag/ICD10)",
    href: "/pages/incomplete-visit",
    icon: AlertTriangle,
    group: "report",
  },
];

// =========================
// PRIMARY CARE
// =========================
export const PRIMARY_CARE_ITEMS: SidebarItem[] = [
  {
    label: "รายชื่อผู้เสียชีวิต/จำหน่าย ที่ยังไม่ถูกจำหน่ายในบัญชี1",
    href: "/pages/death-not-discharged",
    icon: UserMinus,
    group: "primarycare",
  },
  {
    label: "ผู้ป่วยที่ยังไม่นำเข้าบัญชี 1 ต.สะเดา",
    href: "/pages/patient-no-person",
    icon: UserSearch,
    group: "primarycare",
  },
  {
    label: "ผลัดตกหกล้ม (W00–W09)",
    href: "/pages/fall-report",
    icon: AlertTriangle,
    group: "primarycare",
  },
];

// =========================
// PPA
// =========================
export const PPA_ITEMS: SidebarItem[] = [
  {
    label: "Aging (ผู้สูงอายุ)",
    href: "/pages/ppa/aging",
    icon: Users,
    desc: "คัดกรองสมอง/หกล้ม อายุ ≥ 50 ปี",
    group: "ppa",
  },
  {
    label: "NCD01 (คัดกรอง DM/HT)",
    href: "/pages/ppa/ncd01",
    icon: HeartPulse,
    desc: "ข้อมูลการคัดกรองโรคเรื้อรัง",
    group: "ppa",
  },
  {
    label: "NCD02 (R73/R030)",
    href: "/pages/ppa/ncd02",
    icon: Activity,
    desc: "วินิจฉัย R73 หรือ R030",
    group: "ppa",
  },
  {
    label: "MCH01 (ANC)",
    href: "/pages/ppa/mch01",
    icon: Baby,
    desc: "บริการฝากครรภ์",
    group: "ppa",
  },
  {
    label: "MCH02 (คลอด)",
    href: "/pages/ppa/mch02",
    icon: Baby,
    desc: "ข้อมูลการคลอด",
    group: "ppa",
  },
  {
    label: "MCH03 (วางแผนครอบครัว)",
    href: "/pages/ppa/mch-woman",
    icon: Baby,
    desc: "คุมกำเนิด/วางแผนครอบครัว อายุ 15-49 ปี",
    group: "ppa",
  },
  {
    label: "MCH04 (พัฒนาการเด็ก)",
    href: "/pages/ppa/mch04",
    icon: Baby,
    desc: "คัดกรองพัฒนาการเด็ก DSPM",
    group: "ppa",
  },
];

// =========================
// SETTINGS
// =========================
export const SETTINGS_ITEMS: SidebarItem[] = [
  {
    label: "ตั้งค่าระบบ",
    href: "/pages/settings",
    icon: Settings,
    desc: "รหัสผ่าน · ฟอนต์ · ธีม",
    group: "settings",
  },
];

// =========================
// ALL MENU
// =========================
export const ALL_SIDEBAR_ITEMS: SidebarItem[] = [
  ...DASHBOARD_GROUPS.flatMap(
    (group) => group.items
  ),

  ...REPORT_ITEMS,

  ...PRIMARY_CARE_ITEMS,

  ...PPA_ITEMS,

  ...SETTINGS_ITEMS,
];

// =========================
// HELPERS
// =========================
export const getSidebarByGroup = (group: SidebarGroup) => {
  return ALL_SIDEBAR_ITEMS.filter(
    (item) => item.group === group
  );
};