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
  Stethoscope,
  Dumbbell,
  Leaf,
  Building2,
  Monitor,
  Baby,
  BedDouble,
  UserMinus,
  AlertTriangle,
  Banknote,
  Wallet,
  Receipt,
  Landmark,
  Settings,
  UserSearch,
  Pill,
  Brain,
  Microscope,
  Scissors,
  Ambulance,
  Droplet,
  Droplets,
  HeartHandshake,
  Syringe,
  Activity,
  MapPinned,
  Gauge,
} from "lucide-react";

import { SidebarItem, SidebarGroup, SidebarSubGroup } from "./types";


export const DASHBOARD_GROUPS: SidebarSubGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      {
        label: "Overview",
        href: "/pages/dashboard",
        icon: LayoutDashboard,
        group: "main",
      },
      {
        label: "สถานะผู้ป่วยตามแผนก",
        href: "/pages/dept-status",
        icon: Building2,
        group: "main",
      },
      {
        label: "สถิติผู้รับบริการแยกเวร",
        href: "/pages/shift-stats",
        icon: BarChart3,
        group: "main",
      },
      {
        label: "IP & Home Ward",
        href: "/pages/ip-homeward-dashboard",
        icon: BedDouble,
        group: "main",
      },
    ],
  },

  {
    title: "หน่วยบริการ",
    items: [
      {
        label: "กายภาพบำบัด",
        href: "/pages/pt-dashboard",
        icon: Dumbbell,
        group: "main",
      },
      {
        label: "ตรวจสุขภาพประจำปี",
        href: "/pages/health-checkup",
        icon: HeartPulse,
        group: "main",
      },
      {
        label: "ทันตกรรม",
        href: "/pages/dental-dashboard",
        icon: Smile,
        group: "main",
      },
      {
        label: "แพทย์แผนไทย",
        href: "/pages/ttm-dashboard",
        icon: Leaf,
        group: "main",
      },
      {
        label: "IMC",
        href: "/pages/imc-dashboard",
        icon: Stethoscope,
        group: "main",
      },
    ],
  },

  {
    title: "ผลิตภาพ & เวลาบริการ",
    items: [
      {
        label: "ผลิตภาพการพยาบาลห้องคลอด (LR)",
        href: "/pages/productivity-lr",
        icon: Baby,
        group: "main",
      },
      {
        label: "ผลิตภาพการพยาบาล ER",
        href: "/pages/productivity-er",
        icon: Ambulance,
        group: "main",
      },
      {
        label: "ผลิตภาพการพยาบาล IPD",
        href: "/pages/productivity-ipd",
        icon: BedDouble,
        group: "main",
      },
      {
        label: "ผลิตภาพการพยาบาล OPD",
        href: "/pages/productivity-opd",
        icon: Activity,
        group: "main",
      },
      {
        label: "R9 ระยะเวลารอคอย/ให้บริการ OPD",
        href: "/pages/servicetime-dashboard",
        icon: Gauge,
        group: "main",
      },
    ],
  },

  {
    title: "ระบบงาน",
    items: [
      {
        label: "บันทึกงาน IT",
        href: "/pages/it-worklog",
        icon: Monitor,
        group: "main",
      },
    ],
  },

  {
    title: "งานเคลม / การเงิน",
    items: [
      {
        label: "งานเคลม ANC ฝากครรภ์",
        href: "/pages/anc-dashboard",
        icon: Baby,
        group: "claim",
      },
      {
        label: "จัดสรรผลงานบริการ - MOPH CLAIM",
        href: "/pages/billing-dashboard",
        icon: Banknote,
        group: "claim",
      },
      {
        label: "DMTB",
        href: "/pages/dmtb-dashboard",
        icon: Receipt,
        group: "claim",
      },
      {
        label: "KTB",
        href: "/pages/ktb-dashboard",
        icon: Landmark,
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
    title: "จิตเวช / ยาเสพติด",
    items: [
      {
        label: "ผู้ป่วยยาเสพติด",
        href: "/pages/drug-dashboard",
        icon: Syringe,
        group: "disease",
      },
      {
        label: "แผนที่บ้านผู้ป่วยยาเสพติด",
        href: "/pages/drug-map",
        icon: MapPinned,
        group: "disease",
      },
      {
        label: "แผนที่บ้านมินิธัญญารักษ์",
        href: "/pages/minithan-map",
        icon: MapPinned,
        group: "disease",
      },
      {
        label: "แผนที่บ้าน Home Ward",
        href: "/pages/homeward-map",
        icon: MapPinned,
        group: "disease",
      },
      {
        label: "มินิธัญญารักษ์",
        href: "/pages/minithan-dashboard",
        icon: HeartHandshake,
        group: "disease",
      },
      {
        label: "Home Ward ยาเสพติด",
        href: "/pages/homeward-dashboard",
        icon: BedDouble,
        group: "disease",
      },
    ],
  },

  {
    title: "โรคติดเชื้อ",
    items: [
      {
        label: "วัณโรค (TB)",
        href: "/pages/tb-dashboard",
        icon: Microscope,
        group: "disease",
      },
      {
        label: "แผนที่บ้านผู้ป่วยวัณโรค",
        href: "/pages/tb-map",
        icon: MapPinned,
        group: "disease",
      },
      {
        label: "RDU Antibiotic Smart Use",
        href: "/pages/rdu-dashboard",
        icon: Pill,
        group: "disease",
      },
      {
        label: "Sepsis",
        href: "/pages/sepsis-dashboard",
        icon: Droplets,
        group: "disease",
      },
    ],
  },

  {
    title: "อุบัติเหตุ / ฉุกเฉิน / หัตถการ",
    items: [
      {
        label: "หัตถการเสี่ยงสูง",
        href: "/pages/high-risk-procedures",
        icon: Scissors,
        group: "disease",
      },
      {
        label: "อุบัติเหตุ",
        href: "/pages/accident-dashboard",
        icon: Ambulance,
        group: "disease",
      },
      {
        label: "Stroke Dashboard",
        href: "/pages/stroke-dashboard",
        icon: Brain,
        group: "disease",
      },
    ],
  },

  {
    title: "แม่และเด็ก",
    items: [
      {
        label: "งานการพยาบาลผู้คลอด (ANC)",
        href: "/pages/anc-nursing-dashboard",
        icon: Baby,
        group: "disease",
      },
      {
        label: "แผนที่บ้านหญิงตั้งครรภ์ที่ซีด",
        href: "/pages/anc-anemia-map",
        icon: MapPinned,
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
    label: "รายการจ่ายถุงยางอนามัย OPD",
    href: "/pages/condom-report",
    icon: Receipt,
    group: "report",
  },
  {
    label: "รายชื่อผู้ป่วยที่ไม่มี (CC/Diag/ICD10)",
    href: "/pages/incomplete-visit",
    icon: AlertTriangle,
    group: "report",
  },
  {
    label: "UC ต่างจังหวัดที่มาทำฟัน",
    href: "/pages/uc-outside-dental",
    icon: Smile,
    group: "report",
  },
];

// =========================
// PRIMARY CARE
// =========================
export const PRIMARY_CARE_ITEMS: SidebarItem[] = [
  {
    label: "ผลัดตกหกล้ม (W00–W09)",
    href: "/pages/fall-report",
    icon: AlertTriangle,
    group: "primarycare",
  },
  {
    label: "ผู้ป่วยที่ยังไม่นำเข้าบัญชี 1 ต.สะเดา",
    href: "/pages/patient-no-person",
    icon: UserSearch,
    group: "primarycare",
  },
  {
    label: "รายชื่อผู้ผิดนัดฉีดวัคซีนพิษสุนัขบ้า",
    href: "/pages/rabies-followup",
    icon: Syringe,
    group: "primarycare",
  },
  {
    label: "รายชื่อผู้เสียชีวิต/จำหน่าย ที่ยังไม่ถูกจำหน่ายในบัญชี1",
    href: "/pages/death-not-discharged",
    icon: UserMinus,
    group: "primarycare",
  },
  {
    label: "DM/HT รายใหม่ ประจำปีงบประมาณ",
    href: "/pages/dmht-new",
    icon: HeartPulse,
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
    icon: HeartHandshake,
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
    icon: Droplet,
    desc: "วินิจฉัย R73 หรือ R030",
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