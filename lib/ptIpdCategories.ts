// lib/ptIpdCategories.ts
// ─────────────────────────────────────────────────────────────────────────────
// หมวดหมู่ของทะเบียนผู้ป่วยในงานกายภาพ — มี 2 ชุด
//
//   1) PT_SERVICE_CATEGORIES = "หมวดหมู่รายละเอียดการให้บริการ"  ← ชุดหลักที่ใช้กรอง
//      จัดจากข้อความที่นักกายภาพบันทึกไว้เอง (physic_main_ipd.service_text)
//      เป็นภาษาที่คนกายภาพใช้จริง เช่น "กายภาพทรวงอก", "ฝึกยืน–ฝึกเดิน"
//
//   2) PT_DX_GROUPS = "กลุ่มโรค" จัดจากรหัส ICD-10 ของการวินิจฉัย
//      ไม่ได้ใช้เป็นตัวกรองแล้ว เหลือไว้เป็นกราฟประกอบ (ดูว่าคนไข้กลุ่มโรคไหนบ้าง)
//
// แยกออกจาก lib/ptIpdRegister.service.ts เพราะหน้าเว็บ (client component) ต้องใช้
// ชื่อ/สีของหมวดด้วย — ถ้า import จากไฟล์ service ที่ import lib/db
// จะลาก mysql2 เข้าไปอยู่ใน bundle ฝั่ง browser (build ไม่ผ่าน)
// ไฟล์นี้จึงเป็น pure TypeScript ไม่มี dependency ภายนอก
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 1) หมวดหมู่รายละเอียดการให้บริการ (ชุดหลัก) ═══════════════════════════════
//
// วิธีจัด: จับ keyword จาก service_text ซึ่งเป็นข้อความอิสระ
//   - 1 ครั้งอาจเข้าได้หลายหมวด (เช่น "เคาะปอด + ฝึกเดิน") → เก็บไว้ทั้งหมดใน tags
//   - แต่ "หมวดหลัก" ของแถวนั้นเอาหมวดแรกที่ตรงตามลำดับในรายการนี้
//     (เรียงตามงานที่เป็นเนื้องานหลักก่อน) เพื่อให้ยอดในการ์ด/กราฟรวมกันได้ 100%
//   - ปรับ keyword เพิ่มได้ตลอดถ้าห้องกายภาพเขียนคำอื่น — แก้ที่ไฟล์นี้ที่เดียว

export interface PtServiceCategoryDef {
  key: string;
  label: string;
  /** สีประจำหมวด — ใช้ทั้งการ์ด กราฟ และป้ายในตาราง */
  color: string;
  bg: string;
  /** ตัวอย่างคำที่ใช้จับหมวดนี้ (แสดงใต้ชื่อหมวดในตัวเลือก) */
  hint: string;
  /** ไม่มี keyword = หมวดปลายทาง (other / none) ที่ไม่ได้จับจากคำ */
  keywords: string[];
}

export const PT_SERVICE_CATEGORIES: PtServiceCategoryDef[] = [
  {
    key: "chest",
    label: "กายภาพทรวงอก / ระบายเสมหะ",
    color: "#0369A1",
    bg: "#E0F2FE",
    hint: "เคาะปอด, ระบายเสมหะ, ฝึกหายใจ, chest PT, percussion",
    keywords: [
      "เคาะปอด", "เคาะระบาย", "ระบายเสมหะ", "ขับเสมหะ", "เสมหะ", "ดูดเสมหะ",
      "ฝึกหายใจ", "หายใจ", "บริหารปอด", "ขยายปอด", "chest", "percussion",
      "postural drainage", "suction", "breathing", "incentive",
    ],
  },
  {
    key: "ambulation",
    label: "ฝึกยืน–ฝึกเดิน / ฝึกเคลื่อนย้าย",
    color: "#185FA5",
    bg: "#E6F1FB",
    hint: "ฝึกเดิน, ฝึกยืน, ลุกนั่ง, ย้ายตัว, walker, gait, transfer",
    keywords: [
      "ฝึกเดิน", "หัดเดิน", "เดิน", "ฝึกยืน", "หัดยืน", "ยืน", "ลุกนั่ง",
      "ฝึกนั่ง", "ทรงตัว", "ย้ายตัว", "เคลื่อนย้าย", "ไม้เท้า", "วอล์คเกอร์",
      "walker", "walk", "ambulat", "gait", "transfer", "standing", "sitting",
      "balance",
    ],
  },
  {
    key: "exercise",
    label: "ออกกำลังกาย / บริหารข้อ (ROM)",
    color: "#0F766E",
    bg: "#CCFBF1",
    hint: "ออกกำลังกาย, บริหารข้อ, ยืดกล้ามเนื้อ, ROM, exercise",
    keywords: [
      "ออกกำลัง", "บริหารข้อ", "บริหารกล้าม", "บริหาร", "ยืดกล้าม", "ยืดเหยียด",
      "ยืด", "เพิ่มกำลังกล้าม", "กำลังกล้ามเนื้อ", "องศาการเคลื่อนไหว",
      "exercise", "ex.", "rom", "range of motion", "stretch", "strength",
      "active", "passive",
    ],
  },
  {
    key: "manual",
    label: "นวด / ดัดดึงข้อต่อ",
    color: "#9D174D",
    bg: "#FCE7F3",
    hint: "นวด, คลึง, ดัดดึง, massage, mobilization",
    keywords: ["นวด", "คลึง", "ดัดดึง", "ดึงข้อ", "massage", "mobiliz", "manual", "traction"],
  },
  {
    key: "modality",
    label: "เครื่องมือกายภาพ (ประคบ / กระตุ้นไฟฟ้า)",
    color: "#B45309",
    bg: "#FEF3C7",
    hint: "ประคบร้อน–เย็น, อัลตราซาวด์, กระตุ้นไฟฟ้า, TENS, laser",
    keywords: [
      "ประคบ", "แผ่นความร้อน", "ความร้อน", "ความเย็น", "ผ้าเย็น", "hot pack",
      "cold pack", "อัลตราซาวด์", "อัลตร้าซาวด์", "ultrasound", "กระตุ้นไฟฟ้า",
      "กระตุ้นกล้าม", "tens", "stimulat", "laser", "short wave", "infrared",
    ],
  },
  {
    key: "positioning",
    label: "จัดท่า / พลิกตะแคง / ป้องกันแผลกดทับ",
    color: "#7C3AED",
    bg: "#EDE9FE",
    hint: "จัดท่านอน, พลิกตะแคงตัว, ป้องกันแผลกดทับ, positioning",
    keywords: [
      "จัดท่า", "จัดท่านอน", "พลิกตะแคง", "ตะแคง", "พลิกตัว", "แผลกดทับ",
      "ป้องกันข้อติด", "ดามข้อ", "position", "turning", "splint",
    ],
  },
  {
    key: "education",
    label: "ให้คำแนะนำ / สอนญาติ / เตรียมกลับบ้าน",
    color: "#4D7C0F",
    bg: "#ECFCCB",
    hint: "แนะนำ, สอนญาติ, home program, เตรียมจำหน่าย",
    keywords: [
      "แนะนำ", "ให้ความรู้", "สอนญาติ", "สอน", "ญาติ", "กลับบ้าน", "จำหน่าย",
      "home program", "advice", "educat", "teaching", "discharge",
    ],
  },
  {
    key: "assessment",
    label: "ประเมิน / ติดตามอาการ",
    color: "#DB2777",
    bg: "#FCE7F3",
    hint: "ประเมินอาการ, ติดตามผล, F/U, assessment",
    keywords: [
      "ประเมิน", "ตรวจประเมิน", "ติดตามอาการ", "ติดตาม", "เยี่ยม", "assess",
      "evaluat", "follow", "f/u",
    ],
  },
  {
    key: "other",
    label: "อื่น ๆ (มีบันทึกแต่ไม่เข้าหมวด)",
    color: "#6B7280",
    bg: "#F3F4F6",
    hint: "มีข้อความบันทึกไว้ แต่ไม่ตรง keyword หมวดใดเลย",
    keywords: [],
  },
  {
    key: "none",
    label: "ไม่ได้บันทึกรายละเอียด",
    color: "#9CA3AF",
    bg: "#F9FAFB",
    hint: "service_text ว่าง",
    keywords: [],
  },
];

export const PT_SERVICE_BY_KEY = new Map(
  PT_SERVICE_CATEGORIES.map((c) => [c.key, c]),
);

/** หมวดที่ "จับจาก keyword ได้จริง" (ไม่รวม other/none) */
const KEYWORD_CATEGORIES = PT_SERVICE_CATEGORIES.filter((c) => c.keywords.length);

/**
 * service_text → หมวดหมู่การให้บริการ
 * @returns primary = หมวดหลักของแถวนั้น (ใช้กรอง/นับ), tags = ทุกหมวดที่จับได้
 */
export function classifyPtService(text: string): {
  primary: string;
  tags: string[];
} {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return { primary: "none", tags: [] };

  const tags = KEYWORD_CATEGORIES.filter((c) =>
    c.keywords.some((k) => t.includes(k.toLowerCase())),
  ).map((c) => c.key);

  return { primary: tags[0] ?? "other", tags };
}

// ═══ 2) กลุ่มโรค (จัดจากรหัส ICD-10) — ใช้เป็นกราฟประกอบ ═════════════════════
//
// เรียงจาก "เจาะจงที่สุด → กว้างที่สุด" เพราะจับกลุ่มแรกที่ตรงแล้วหยุด
// (เช่น I63 ต้องเป็น stroke ไม่ใช่ cardio, S72 ต้องเป็นกระดูกหักไม่ใช่ msk)

export interface PtDxGroupDef {
  key: string;
  label: string;
  color: string;
  bg: string;
  /** คำอธิบายว่ากลุ่มนี้ครอบคลุมรหัสอะไร */
  hint: string;
  /** ตรวจว่ารหัส ICD-10 (ตัวพิมพ์ใหญ่ ไม่มีจุด) อยู่ในกลุ่มนี้ไหม */
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

export const PT_DX_GROUPS: PtDxGroupDef[] = [
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
    label: "โรคระบบหายใจ",
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
    hint: "รหัสที่ไม่เข้ากลุ่มข้างต้น หรือไม่มีการวินิจฉัย",
    match: () => true, // กลุ่มสุดท้าย — รับที่เหลือทั้งหมด
  },
];

export const PT_DX_GROUP_BY_KEY = new Map(PT_DX_GROUPS.map((g) => [g.key, g]));

/**
 * จัดกลุ่มโรคจากรหัสวินิจฉัย — ไล่ pdx ก่อน ถ้าไม่เข้ากลุ่มใดเลย
 * ค่อยลอง dx รอง ๆ ต่อ เพื่อไม่ให้เคสอย่าง "pdx = ปอดบวม, dx1 = อัมพาตครึ่งซีก"
 * หล่นไปกอง "อื่น ๆ" ทั้งที่เป็นงานกายภาพชัดเจน
 */
export function classifyPtDxGroup(codes: string[]): string {
  for (const raw of codes) {
    const code = normalizeIcd(raw ?? "");
    if (!code) continue;
    const hit = PT_DX_GROUPS.find((g) => g.key !== "other" && g.match(code));
    if (hit) return hit.key;
  }
  return "other";
}
