// lib/rdu.constants.ts
// ข้อมูลคงที่สำหรับ RDU Dashboard — แยกออกมาใช้ร่วมกันระหว่าง API และ Page

// ─── ATB icodes (จาก drugitems WHERE antibiotic = 'Y') ────────────────────────
// ดึงจากฐานข้อมูลจริงของโรงพยาบาลพลับพลาชัย
export const ATB_ICODES = [
  "1000034","1000060","1000082","1000083","1000084","1000085",
  "1000129","1000184","1000188","1000221","1000231","1000233",
  "1015001","1152002","1430203","1440207","1440208","1440403",
  "1450504","1460208","1460340","1460541","1460566","1480155",
  "1480182","1490328","1490346","1500029","1500032","1510006",
  "1510059","1510076","1520008","1520056","1520069","1520072",
  "1520073","1520074","1530003","1530010","1530013","1540005",
  "1540009","1550010","1560007","1560025","1560038","1560039",
  "1570019","1580011","1580015","1580020","1620003","1640019",
  "1640029","1640049","1640062",
] as const;

export const ATB_ICODES_SQL = ATB_ICODES.map(c => `'${c}'`).join(",");

// ─── ICD10 กลุ่ม 4 โรคเป้าหมาย RDU ──────────────────────────────────────────

/** URI / โรคหวัด */
export const URI_ICD10 = [
  "J00",
  "J060","J068","J069","J06",
  "J020","J029","J02",
  "J030","J039","J03",
  "J040","J041","J042","J04",
  "J050","J051","J05",
  "J101","J111",
] as const;

/** Acute Diarrhea */
export const DIA_ICD10 = [
  "A09","A090","A099",
  "A080","A081","A082","A083","A084","A085","A08",
  "K529","K528","K52",
] as const;

/** แผลสด — ใช้ prefix LIKE เพราะ code หลากหลาย */
export const WOUND_ICD10_PREFIXES = [
  "S01","S11","S21","S31","S41","S51","S61","S71","S81","S91",
  "T01","T14",
] as const;

/** แผลฝีเย็บ */
export const PERI_ICD10 = [
  "O700","O701","O702","O703","O709","O70",
  "O810","O811","O812","O813","O814","O819","O81",
  "O820","O821","O822","O828","O829","O82",
  "Z390","Z392",
] as const;

// ─── Disease metadata ─────────────────────────────────────────────────────────
export const DISEASE_META = [
  { key: "uri",   name: "URI / โรคหวัด",       full: "Upper Respiratory Infection",  icon: "🤧", color: "#1e6fd9", target: 20 },
  { key: "dia",   name: "Acute Diarrhea",       full: "โรคอุจจาระร่วงเฉียบพลัน",      icon: "💧", color: "#0aa7a0", target: 20 },
  { key: "wound", name: "แผลสด (Fresh Wound)",  full: "Fresh Traumatic Wound",        icon: "🩹", color: "#d97706", target: 40 },
  { key: "peri",  name: "แผลฝีเย็บ",             full: "Episiotomy / Perineal Wound", icon: "👶", color: "#7c3aed", target: 10 },
] as const;

export type DiseaseKey = "uri" | "dia" | "wound" | "peri";

// ─── แผนกที่เกี่ยวข้องกับ RDU (จาก kskdepartment จริง) ─────────────────────
// ใช้สำหรับ dropdown filter
export const RDU_DEPARTMENTS = [
  { depcode: "",    label: "ทุกแผนก" },
  { depcode: "002", label: "ห้องตรวจ 1" },
  { depcode: "003", label: "ห้องตรวจ 2" },
  { depcode: "004", label: "ห้องตรวจ 3" },
  { depcode: "009", label: "ห้องฉุกเฉิน (ER)" },
  { depcode: "010", label: "ห้องคลอด" },
  { depcode: "015", label: "คลินิกเด็กดี (WBC)" },
  { depcode: "017", label: "เวชปฏิบัติครอบครัว" },
  { depcode: "047", label: "คลินิก ARI" },
  { depcode: "059", label: "ห้องตรวจ" },
] as const;

// ─── Targets ──────────────────────────────────────────────────────────────────
export const TARGETS: Record<DiseaseKey, number> = {
  uri: 20, dia: 20, wound: 40, peri: 10,
};

// ─── Thai month labels ────────────────────────────────────────────────────────
export const THAI_MONTHS_SHORT = [
  "","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
] as const;