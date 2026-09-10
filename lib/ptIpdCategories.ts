// lib/ptIpdCategories.ts
// ─────────────────────────────────────────────────────────────────────────────
// "หมวดหมู่เฉพาะงานกายภาพ" + "กิจกรรมกายภาพ" ของทะเบียนผู้ป่วยในงานกายภาพ
//
// แยกออกจาก lib/ptIpdRegister.service.ts เพราะหน้าเว็บ (client component) ต้องใช้
// ชื่อ/สีของหมวดและกิจกรรมด้วย — ถ้า import จากไฟล์ service ที่ import lib/db
// จะลาก mysql2 เข้าไปอยู่ใน bundle ฝั่ง browser (build ไม่ผ่าน)
// ไฟล์นี้จึงเป็น pure TypeScript ไม่มี dependency ภายนอก
// ─────────────────────────────────────────────────────────────────────────────

// ─── หมวดหมู่เฉพาะงานกายภาพ (จัดจากรหัส ICD-10) ───────────────────────────────
//
// เรียงจาก "เจาะจงที่สุด → กว้างที่สุด" เพราะจับหมวดแรกที่ตรงแล้วหยุด
// (เช่น I63 ต้องเป็น stroke ไม่ใช่ cardio, S72 ต้องเป็นกระดูกหักไม่ใช่ msk)

export interface PtIpdCategoryDef {
  key: string;
  label: string;
  /** สีประจำหมวด — ใช้ทั้งการ์ด กราฟ และป้ายในตาราง */
  color: string;
  bg: string;
  /** คำอธิบายว่าหมวดนี้ครอบคลุมรหัสอะไร (แสดงใน tooltip ของตัวเลือก) */
  hint: string;
  /** ตรวจว่ารหัส ICD-10 (ตัวพิมพ์ใหญ่ ไม่มีจุด) อยู่ในหมวดนี้ไหม */
  match: (code: string) => boolean;
}

/** "I63.9" → "I639" (ทะเบียน HOSxP เก็บแบบไม่มีจุดอยู่แล้ว แต่กันไว้) */
export const normalizeIcd = (code: string): string =>
  code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** ขึ้นต้นด้วยรหัสใดรหัสหนึ่งในรายการ */
const starts =
  (...prefixes: string[]) =>
  (code: string): boolean =>
    prefixes.some((p) => code.startsWith(p));

/** อยู่ในช่วงตัวเลขของหมวดเดียวกัน เช่น range("I",60,69) = I60–I69 */
const range =
  (letter: string, from: number, to: number) =>
  (code: string): boolean => {
    if (code[0] !== letter) return false;
    const n = Number(code.slice(1, 3));
    return Number.isFinite(n) && n >= from && n <= to;
  };

const any =
  (...tests: ((code: string) => boolean)[]) =>
  (code: string): boolean =>
    tests.some((t) => t(code));

export const PT_CATEGORIES: PtIpdCategoryDef[] = [
  {
    key: "stroke",
    label: "โรคหลอดเลือดสมอง (Stroke)",
    color: "#A32D2D",
    bg: "#FCEBEB",
    hint: "I60–I69, G45–G46",
    match: any(range("I", 60, 69), starts("G45", "G46")),
  },
  {
    key: "paralysis",
    label: "อัมพาต / บาดเจ็บไขสันหลัง",
    color: "#6B21A8",
    bg: "#F3E8FF",
    hint: "G80–G83, S14, S24, S34, T09.3",
    match: any(range("G", 80, 83), starts("S14", "S24", "S34", "T093")),
  },
  {
    key: "headinjury",
    label: "บาดเจ็บทางสมอง (Head injury)",
    color: "#B45309",
    bg: "#FEF3C7",
    hint: "S06, S02.0–S02.1",
    match: starts("S06", "S020", "S021"),
  },
  {
    key: "fracture",
    label: "กระดูกหัก / บาดเจ็บกระดูกและข้อ",
    color: "#185FA5",
    bg: "#E6F1FB",
    hint: "S12/S22/S32/S42/S52/S62/S72/S82/S92, T02, T12, M80",
    match: starts(
      "S12", "S22", "S32", "S42", "S52", "S62", "S72", "S82", "S92",
      "S43", "S53", "S63", "S73", "S83", "S93", "T02", "T12", "M80",
    ),
  },
  {
    key: "amputation",
    label: "ตัดแขน–ขา (Amputation)",
    color: "#9D174D",
    bg: "#FCE7F3",
    hint: "S68, S78, S88, S98, Z89",
    match: starts("S68", "S78", "S88", "S98", "Z89"),
  },
  {
    key: "msk",
    label: "กระดูก กล้ามเนื้อ และข้อ (Musculoskeletal)",
    color: "#0F766E",
    bg: "#CCFBF1",
    hint: "M00–M99",
    match: starts("M"),
  },
  {
    key: "respiratory",
    label: "ระบบหายใจ / กายภาพทรวงอก",
    color: "#0369A1",
    bg: "#E0F2FE",
    hint: "J00–J99",
    match: starts("J"),
  },
  {
    key: "neuro",
    label: "โรคระบบประสาทอื่น ๆ",
    color: "#7C3AED",
    bg: "#EDE9FE",
    hint: "G00–G99 (นอกเหนือจากอัมพาต)",
    match: starts("G"),
  },
  {
    key: "immobility",
    label: "ติดเตียง / แผลกดทับ / เดินลำบาก",
    color: "#854F0B",
    bg: "#FAEEDA",
    hint: "L89, R26, R29, Z74, M62.3",
    match: starts("L89", "R26", "R29", "Z74", "M623"),
  },
  {
    key: "cardio",
    label: "โรคหัวใจและหลอดเลือด",
    color: "#DB2777",
    bg: "#FCE7F3",
    hint: "I00–I59 (นอกเหนือจากหลอดเลือดสมอง)",
    match: starts("I"),
  },
  {
    key: "chronic",
    label: "เบาหวาน / โรคเรื้อรังอื่น",
    color: "#4D7C0F",
    bg: "#ECFCCB",
    hint: "E10–E14, N18",
    match: any(range("E", 10, 14), starts("N18")),
  },
  {
    key: "other",
    label: "อื่น ๆ / ไม่ระบุการวินิจฉัย",
    color: "#6B7280",
    bg: "#F3F4F6",
    hint: "รหัสที่ไม่เข้าหมวดข้างต้น หรือไม่มีการวินิจฉัย",
    match: () => true, // หมวดสุดท้าย — รับที่เหลือทั้งหมด
  },
];

export const PT_CATEGORY_BY_KEY = new Map(PT_CATEGORIES.map((c) => [c.key, c]));

/**
 * จัดหมวดจากรหัสวินิจฉัย — ไล่ pdx ก่อน ถ้าไม่เข้าหมวดใดเลย (ตกไป "other")
 * ค่อยลอง dx รอง ๆ ต่อ เพื่อไม่ให้เคสอย่าง "pdx = ปอดบวม, dx1 = อัมพาตครึ่งซีก"
 * หล่นไปกอง "อื่น ๆ" ทั้งที่เป็นงานกายภาพชัดเจน
 */
export function classifyPtCategory(codes: string[]): string {
  for (const raw of codes) {
    const code = normalizeIcd(raw ?? "");
    if (!code) continue;
    const hit = PT_CATEGORIES.find((c) => c.key !== "other" && c.match(code));
    if (hit) return hit.key;
  }
  return "other";
}

// ─── กิจกรรมกายภาพ (จับ keyword จาก service_text) ────────────────────────────
// service_text เป็นข้อความอิสระ → จับได้เท่าที่พิมพ์มา ถือเป็นตัวเลข "ประมาณการ"
// 1 ครั้งอยู่ได้หลายกิจกรรม (เช่น "เคาะปอด + ฝึกเดิน") จึงรวมกันเกิน 100% ได้

export interface PtActivityDef {
  key: string;
  label: string;
  keywords: string[];
}

export const PT_ACTIVITIES: PtActivityDef[] = [
  {
    key: "chest",
    label: "กายภาพทรวงอก / ระบบหายใจ",
    keywords: ["เคาะปอด", "เคาะ", "ปอด", "หายใจ", "เสมหะ", "ดูดเสมหะ", "chest", "percussion", "suction", "breathing", "postural drainage"],
  },
  {
    key: "exercise",
    label: "ออกกำลังกาย / บริหารข้อ (ROM)",
    keywords: ["ออกกำลัง", "บริหาร", "ยืด", "กำลังกล้ามเนื้อ", "exercise", "rom", "range of motion", "stretch", "strength"],
  },
  {
    key: "ambulation",
    label: "ฝึกเดิน / ฝึกเคลื่อนย้าย",
    keywords: ["ฝึกเดิน", "เดิน", "ฝึกยืน", "ยืน", "ลุกนั่ง", "ย้ายตัว", "walk", "ambulat", "gait", "transfer", "standing", "sitting"],
  },
  {
    key: "positioning",
    label: "จัดท่า / พลิกตะแคงตัว",
    keywords: ["จัดท่า", "พลิกตะแคง", "ตะแคง", "จัดท่านอน", "position", "turning"],
  },
  {
    key: "modality",
    label: "เครื่องมือกายภาพ (ประคบ/กระตุ้น)",
    keywords: ["ประคบ", "แผ่นความร้อน", "ความร้อน", "กระตุ้นไฟฟ้า", "อัลตราซาวด์", "hot pack", "cold pack", "ultrasound", "tens", "stimulat", "laser", "short wave"],
  },
  {
    key: "manual",
    label: "นวด / ดัดดึงข้อต่อ",
    keywords: ["นวด", "ดัดดึง", "massage", "mobiliz", "manual"],
  },
  {
    key: "education",
    label: "ให้คำแนะนำ / สอนญาติ",
    keywords: ["แนะนำ", "สอน", "ญาติ", "home program", "advice", "educat"],
  },
];

/** service_text → กิจกรรมที่จับได้ (ว่าง = จับไม่ได้/ไม่ได้บันทึกข้อความ) */
export function classifyPtActivities(text: string): string[] {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return [];
  return PT_ACTIVITIES.filter((a) =>
    a.keywords.some((k) => t.includes(k.toLowerCase())),
  ).map((a) => a.key);
}
