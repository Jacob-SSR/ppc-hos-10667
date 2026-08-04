// lib/permissions.ts
// ─────────────────────────────────────────────────────────────────────────────
// จุดเดียวที่กำหนดว่า "role (สายงาน) ไหน เห็น dashboard อะไรได้บ้าง"
//
// หลักการตาม req:
//   - แพทย์ (DOCTOR) และ ผอ. (DIRECTOR) → ดูได้ทุกอย่าง
//   - ADMIN / IT → ดูได้ทุกอย่าง (คนดูแลระบบ)
//   - สายงานอื่น → เห็นเฉพาะ dashboard ของสายงานตัวเอง + ภาพรวมกลาง (CORE)
//   - คนที่ยังไม่ถูกตั้ง role (NULL → "USER") → เห็นเฉพาะภาพรวมกลาง
//
// ไฟล์นี้เป็น pure TypeScript ไม่มี dependency ภายนอก
// → import ได้ทั้งจาก proxy.ts (edge) และจาก Sidebar (client)
//
// เพิ่มหน้าใหม่: เอา path (ทั้ง /pages/... และ /api/...) ไปใส่ใน FEATURE ที่ตรง
// เพิ่มสายงานใหม่: เพิ่มคีย์ใน ROLE_FEATURES แล้วตั้งค่า role ในตาราง ppchos.users
// ─────────────────────────────────────────────────────────────────────────────

/** role ที่เห็นได้ทุกอย่าง */
export const FULL_ACCESS_ROLES = [
  "ADMIN",
  "DIRECTOR", // ผู้อำนวยการ
  "DOCTOR", // แพทย์
  "IT",
] as const;

/** กลุ่มฟีเจอร์ (dashboard + API ที่หน้านั้นเรียกใช้) แยกตามสายงาน */
export const FEATURE_PATHS = {
  // ภาพรวมกลางของโรงพยาบาล — ทุกคนที่ login แล้วเห็นได้
  CORE: [
    "/pages/dashboard",
    "/api/dashboard",
    "/api/ipd",
    "/pages/dept-status",
    "/api/dept-status",
    "/pages/shift-stats",
    "/api/shift-stats",
    "/pages/ip-homeward-dashboard",
    "/api/ip-homeward-sheets",
    "/pages/settings",
    "/api/change-password",
    "/api/ai",
  ],

  // งานการพยาบาลผู้ป่วยนอก (OPD)
  NURSING_OPD: [
    "/pages/productivity-opd",
    "/api/productivity-opd",
    "/pages/servicetime-dashboard",
    "/api/servicetime",
    "/pages/health-checkup",
  ],

  // งานการพยาบาลผู้ป่วยใน (IPD)
  NURSING_IPD: ["/pages/productivity-ipd", "/api/productivity-ipd"],

  // งานการพยาบาลผู้ป่วยอุบัติเหตุฉุกเฉินและนิติเวช (ER)
  NURSING_ER: ["/pages/productivity-er", "/api/productivity-er"],

  // งานการพยาบาลผู้คลอดและทารกแรกเกิด (LR)
  NURSING_LR: ["/pages/productivity-lr", "/api/productivity-lr"],

  // แม่และเด็ก / งานคลอด / ANC (รวมงานเคลม ANC ฝากครรภ์ด้วย — LR ต้องเห็น)
  MCH: [
    "/pages/anc-nursing-dashboard",
    "/api/anc-nursing",
    "/pages/anc-anemia-map",
    "/api/anc-anemia-map",
    "/pages/anc-dashboard",
    "/api/anc-sheets",
  ],

  // อุบัติเหตุ / ฉุกเฉิน / โรควิกฤต
  EMERGENCY: [
    "/pages/accident-dashboard",
    "/pages/accident-map",
    "/api/accident-map",
    "/api/accident-sheets",
    "/pages/stroke-dashboard",
    "/pages/stroke-map",
    "/api/stroke-map",
    "/api/stroke-sheets",
    "/pages/acs-dashboard",
    "/pages/acs-map",
    "/api/acs-map",
    "/api/acs-sheets",
    "/pages/high-risk-procedures",
    "/api/high-risk-procedures",
  ],

  // Sepsis (ทั้ง ER และหน่วยควบคุมการติดเชื้อต้องเห็น)
  SEPSIS: [
    "/pages/sepsis-dashboard",
    "/pages/sepsis-map",
    "/api/sepsis-map",
    "/api/sepsis-sheets",
  ],

  // โรคติดเชื้อ (วัณโรค)
  INFECTIOUS: [
    "/pages/tb-dashboard",
    "/api/tb-dashboard",
    "/pages/tb-map",
    "/api/tb-map",
  ],

  // จิตเวช / ยาเสพติด
  MENTAL: [
    "/pages/drug-dashboard",
    "/pages/drug-map",
    "/api/drug-map",
    "/api/drug-sheets",
    "/pages/minithan-dashboard",
    "/pages/minithan-map",
    "/api/minithan-map",
    "/api/minithan-sheets",
    "/pages/homeward-dashboard",
    "/pages/homeward-map",
    "/api/homeward-map",
    "/api/homeward-sheets",
  ],

  // IMC (ดูได้ทั้งพยาบาลและกายภาพ)
  IMC: [
    "/pages/imc-dashboard",
    "/pages/imc-map",
    "/api/imc-map",
    "/api/imc-sheets",
  ],

  // กายภาพบำบัด
  PT: ["/pages/pt-dashboard", "/api/pt-dashboard"],

  // ทันตกรรม
  DENTAL: [
    "/pages/dental-dashboard",
    "/api/dental-dashboard",
    "/pages/uc-outside-dental",
    "/api/uc-outside-dental",
  ],

  // แพทย์แผนไทย
  TTM: ["/pages/ttm-dashboard", "/api/ttm-dashboard"],

  // เภสัชกรรม
  RDU: ["/pages/rdu-dashboard", "/api/rdu-dashboard"],

  // งานเคลม / การเงิน / งานประกัน
  CLAIM: [
    "/pages/anc-dashboard",
    "/api/anc-sheets",
    "/pages/billing-dashboard",
    "/api/billing-dashboard",
    "/api/billing-upload",
    "/pages/dmtb-dashboard",
    "/api/dmtb-dashboard",
    "/pages/ktb-dashboard",
    "/api/ktb-dashboard",
    "/pages/stm-dashboard",
    "/api/stm-dashboard",
    "/pages/medical-coding",
    "/api/medical-coding",
    "/pages/planfin",
    "/api/planfin",
  ],

  // รายงานเวชระเบียน / สิทธิ์การรักษา
  REPORT: [
    "/pages/report",
    "/api/report",
    "/pages/no-endpoint",
    "/api/no-endpoint",
    "/pages/uc-outside",
    "/api/uc-outside",
    "/pages/service-unit",
    "/api/service-unit",
    "/api/sync",
    "/pages/condom-report",
    "/api/condom-report",
    "/pages/incomplete-visit",
    "/api/incomplete-visit",
  ],

  // ปฐมภูมิ
  PRIMARY_CARE: [
    "/pages/fall-report",
    "/api/fall-report",
    "/pages/patient-no-person",
    "/api/patient-no-person",
    "/pages/rabies-followup",
    "/api/rabies-followup",
    "/pages/death-not-discharged",
    "/api/death-not-discharged",
    "/pages/dmht-new",
    "/api/dmht-new",
  ],

  // PPA
  PPA: ["/pages/ppa", "/api/ppa"],

  // เครื่องมือ IT
  IT_TOOLS: [
    "/pages/it-worklog",
    "/api/it-worklog-sheets",
    "/pages/it-worklog-form",
    "/api/it-worklog-form",
    "/pages/server-status",
    "/api/server-status",
  ],
} as const;

export type FeatureKey = keyof typeof FEATURE_PATHS;

/**
 * สายงาน → ฟีเจอร์ที่เห็นได้
 * "*" = เห็นทุกอย่าง
 * role ที่ไม่อยู่ในตารางนี้ (รวม NULL → "USER") จะได้สิทธิ์เท่า USER
 */
export const ROLE_FEATURES: Record<string, FeatureKey[] | "*"> = {
  ADMIN: "*",
  DIRECTOR: "*",
  DOCTOR: "*",
  IT: "*",

  // บริหารกลุ่มการพยาบาล / หัวหน้าพยาบาล — เห็นงานพยาบาลทุกหน่วย
  NURSE: [
    "CORE",
    "NURSING_OPD",
    "NURSING_IPD",
    "NURSING_ER",
    "NURSING_LR",
    "MCH",
    "EMERGENCY",
    "SEPSIS",
    "INFECTIOUS",
    "MENTAL",
    "IMC",
  ],

  // งานการพยาบาลผู้ป่วยนอก
  NURSE_OPD: ["CORE", "NURSING_OPD"],

  // งานการพยาบาลผู้ป่วยใน
  NURSE_IPD: ["CORE", "NURSING_IPD", "IMC"],

  // งานการพยาบาลผู้ป่วยอุบัติเหตุฉุกเฉินและนิติเวช
  NURSE_ER: ["CORE", "NURSING_ER", "EMERGENCY", "SEPSIS"],

  // งานการพยาบาลผู้คลอดและทารกแรกเกิด — เห็นงานคลอด/ANC ทั้งหมด
  NURSE_LR: ["CORE", "NURSING_LR", "MCH"],

  // งานการพยาบาลหน่วยควบคุมการติดเชื้อและงานจ่ายกลาง
  NURSE_IC: ["CORE", "INFECTIOUS", "SEPSIS"],

  // งานสุขภาพจิตและยาเสพติด
  PSYCH: ["CORE", "MENTAL"],

  // ทันตกรรม
  DENTIST: ["CORE", "DENTAL"],

  // เภสัชกรรม
  PHARMACY: ["CORE", "RDU", "MENTAL"],

  // กายภาพบำบัด
  PT: ["CORE", "PT", "IMC"],

  // แพทย์แผนไทย
  TTM: ["CORE", "TTM"],

  // การเงิน / งานประกัน / เวชระเบียน
  FINANCE: ["CORE", "CLAIM", "REPORT"],

  // นักวิชาการสาธารณสุข / ปฐมภูมิ
  PUBLIC_HEALTH: ["CORE", "PRIMARY_CARE", "PPA", "REPORT", "INFECTIOUS"],

  // ยังไม่ถูกจัดสายงาน → เห็นเฉพาะภาพรวมกลาง
  USER: ["CORE"],
};

/** path ขึ้นต้นด้วย prefix ไหม (เทียบแบบเต็ม segment กัน /api/tb ชน /api/tb-map) */
function startsWithPath(pathname: string, prefix: string): boolean {
  return (
    pathname === prefix ||
    pathname.startsWith(prefix + "/") ||
    pathname.startsWith(prefix + "?")
  );
}

/** รายการ path prefix ทั้งหมดที่ role นี้เข้าได้ (null = เข้าได้ทุก path) */
export function allowedPathsForRole(role: string | null | undefined): string[] | null {
  const r = (role ?? "USER").toUpperCase();

  if ((FULL_ACCESS_ROLES as readonly string[]).includes(r)) return null;

  const features = ROLE_FEATURES[r] ?? ROLE_FEATURES.USER;
  if (features === "*") return null;

  return features.flatMap((f) => [...FEATURE_PATHS[f]]);
}

/**
 * role นี้เข้า path นี้ได้ไหม
 * ใช้เฉพาะกับโซนที่ต้อง login แล้ว (/pages/*, /api/*) — public/guest จัดการใน proxy
 */
export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  const allowed = allowedPathsForRole(role);
  if (allowed === null) return true; // full access

  return allowed.some((p) => startsWithPath(pathname, p));
}
