// lib/ptIpdRegister.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// รายงาน "ทะเบียนผู้ป่วยในสำหรับงานกายภาพ"
//
// ที่มาของข้อมูล (query ต้นฉบับที่ใช้ตรวจสอบหน้างาน):
//   select a.an, p.hn, concat(p.pname,p.fname,' ',p.lname) as ptname, a.age_y, a.age_m,
//          a.pdx, a.dx0..a.dx5, pmi.vstdate, pmi.service_time, pmi.service_text,
//          py.name, a.regdate, a.dchdate, p.addrpart, p.moopart, t.full_name
//     from physic_main_ipd pmi
//     inner join an_stat a     on a.an = pmi.an
//     inner join patient p     on p.hn = pmi.hn
//     left outer join pttype py on py.pttype = a.pttype
//     inner join thaiaddress t  on t.chwpart=p.chwpart and t.amppart=p.amppart
//                              and t.tmbpart=p.tmbpart
//    where pmi.vstdate between ? and ?
//    order by pmi.vstdate
//
// ปรับจากต้นฉบับ 2 จุด (ตั้งใจ — ตัวเลขจึงอาจมากกว่า query เดิมเล็กน้อย):
//   1) ต้นฉบับ inner join thaiaddress → คนไข้ที่ที่อยู่ในทะเบียนไม่ครบ (ตำบล/อำเภอ/
//      จังหวัดว่างหรือไม่ตรงทะเบียน) จะหายไปทั้งแถว → ที่นี่ใช้ left join
//      แล้วแสดงที่อยู่เท่าที่มี (ข้อมูลการให้บริการกายภาพไม่หาย)
//   2) ต้นฉบับ inner join patient → เช่นเดียวกัน ที่นี่ใช้ left join
//   เพิ่มเติม: join icd101 เพื่อเอา "ชื่อ" ของ pdx มาแสดง/จัดหมวดหมู่
//
// นิยาม 1 แถวของรายงาน:
//   1 แถว = การให้บริการกายภาพ 1 ครั้ง (1 แถวใน physic_main_ipd) ของ admission (AN) หนึ่ง
//   → ผู้ป่วยใน 1 คนที่ได้รับกายภาพหลายวัน จะมีหลายแถว (นับเป็นหลายครั้ง)
//   วันที่ที่ใช้รายงาน = physic_main_ipd.vstdate (วันที่ให้บริการกายภาพ)
//
// "หมวดหมู่เฉพาะงานกายภาพ" (แยกตามการวินิจฉัย):
//   HOSxP ไม่มีทะเบียนหมวดหมู่กายภาพให้ → จัดกลุ่มเองจากรหัส ICD-10 ของ pdx
//   (ถ้า pdx จัดไม่ได้ → ไล่ดู dx0–dx5 ต่อ) ตามกลุ่มงานที่นักกายภาพใช้จริง
//   เช่น Stroke / อัมพาต-ไขสันหลัง / กระดูกหัก / กายภาพทรวงอก ฯลฯ ดู PT_CATEGORIES
//
// "กิจกรรมกายภาพ" (แยกตามสิ่งที่ทำ):
//   อ่านจาก service_text ซึ่งเป็นข้อความอิสระที่นักกายภาพพิมพ์เอง
//   → จับ keyword แบบ best-effort 1 ครั้งอาจอยู่ได้หลายกิจกรรม (ดู PT_ACTIVITIES)
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import {
  PT_ACTIVITIES,
  PT_CATEGORIES,
  PT_CATEGORY_BY_KEY,
  classifyPtCategory,
  classifyPtActivities,
  normalizeIcd,
} from "@/lib/ptIpdCategories";

// re-export ให้ฝั่ง API/หน้าเว็บ import จากที่เดียวได้เหมือนเดิม
export {
  PT_CATEGORIES,
  PT_CATEGORY_BY_KEY,
  PT_ACTIVITIES,
  classifyPtCategory,
  classifyPtActivities,
} from "@/lib/ptIpdCategories";
export type { PtIpdCategoryDef, PtActivityDef } from "@/lib/ptIpdCategories";

// ─── Types ────────────────────────────────────────────────────────────────────

/** 1 แถว = การให้บริการกายภาพ 1 ครั้งของผู้ป่วยใน 1 AN */
export interface PtIpdRow {
  an: string;
  hn: string;
  /** วันที่ให้บริการกายภาพ (YYYY-MM-DD) */
  serviceDate: string;
  /** เวลาที่ให้บริการ HH:MM (ว่าง = ไม่ได้บันทึก) */
  serviceTime: string;
  /** สิ่งที่ทำ (ข้อความอิสระจากนักกายภาพ) */
  serviceText: string;
  patientName: string;
  ageY: number;
  ageM: number;
  /** '1' = ชาย */
  sex: string;
  pttypeName: string;
  /** วินิจฉัยหลักของ admission (an_stat.pdx) */
  pdx: string;
  pdxName: string;
  /** วินิจฉัยรอง dx0–dx5 เฉพาะที่ไม่ว่าง */
  dxList: string[];
  /** วันรับไว้ / วันจำหน่าย (ว่าง = ยังไม่จำหน่าย) */
  regdate: string;
  dchdate: string;
  /** วันนอน (null = ยังไม่จำหน่าย) */
  los: number | null;
  address: string;
  /** หมวดหมู่งานกายภาพ (key ใน PT_CATEGORIES) */
  categoryKey: string;
  categoryLabel: string;
  /** รหัสวินิจฉัยที่ทำให้จัดเข้าหมวดนี้ ("" = จัดไม่ได้) */
  categoryCode: string;
  /** กิจกรรมที่จับได้จาก service_text */
  activities: string[];
}

export interface PtIpdCategoryItem {
  key: string;
  label: string;
  color: string;
  bg: string;
  hint: string;
  /** จำนวนครั้งที่ให้บริการในช่วงที่ขอ */
  count: number;
  /** จำนวน admission (AN ไม่ซ้ำ) */
  admissions: number;
}

export interface PtIpdRegisterData {
  updatedAt: string;
  start: string;
  end: string;
  /** หมวดหมู่กายภาพทั้งหมด (พร้อมยอดในช่วงที่ขอ) — ตัวเลือกของ filter */
  categories: PtIpdCategoryItem[];
  rows: PtIpdRow[];
  summary: {
    /** จำนวนครั้งที่ให้บริการกายภาพ */
    total: number;
    /** จำนวน admission ที่ได้รับกายภาพ (AN ไม่ซ้ำ) */
    admissions: number;
    /** จำนวนผู้ป่วย (HN ไม่ซ้ำ) */
    patients: number;
    /** ครั้งเฉลี่ยต่อ 1 admission */
    avgPerAdmission: number;
    /** วันนอนเฉลี่ยของ admission ที่จำหน่ายแล้ว */
    avgLos: number;
    byCategory: { key: string; label: string; count: number; admissions: number }[];
    byMonth: { month: string; count: number; admissions: number }[];
    byActivity: { key: string; label: string; count: number }[];
    byPdx: { code: string; name: string; count: number }[];
  };
}

interface QueryRow extends RowDataPacket {
  an: string;
  hn: string;
  service_date: string | Date | null;
  service_time: string | null;
  service_text: string | null;
  patient_name: string | null;
  age_y: number | null;
  age_m: number | null;
  sex: string | null;
  pttype_name: string | null;
  pdx: string | null;
  pdx_name: string | null;
  dx0: string | null;
  dx1: string | null;
  dx2: string | null;
  dx3: string | null;
  dx4: string | null;
  dx5: string | null;
  regdate: string | Date | null;
  dchdate: string | Date | null;
  addrpart: string | null;
  moopart: string | null;
  address_full: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** DATE/DATETIME จาก mysql2 → "YYYY-MM-DD" ("0000-00-00" → "") */
function dateKey(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) {
    return [
      v.getFullYear(),
      String(v.getMonth() + 1).padStart(2, "0"),
      String(v.getDate()).padStart(2, "0"),
    ].join("-");
  }
  const s = String(v).slice(0, 10);
  return s.startsWith("0000") ? "" : s;
}

/** จำนวนวันนอน (null = ยังไม่จำหน่าย/วันที่ไม่สมบูรณ์) */
function losDays(regdate: string, dchdate: string): number | null {
  if (!regdate || !dchdate) return null;
  const a = Date.parse(`${regdate}T00:00:00Z`);
  const b = Date.parse(`${dchdate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000);
}

/** ปีงบประมาณปัจจุบัน (1 ต.ค. – 30 ก.ย.) ใน timezone Asia/Bangkok */
export function defaultFiscalRange(): { start: string; end: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const fyStartYear =
    now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${fyStartYear}-10-01`, end: `${fyStartYear + 1}-09-30` };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * @param start   วันที่เริ่ม (YYYY-MM-DD) — เทียบกับ physic_main_ipd.vstdate
 * @param end     วันที่สิ้นสุด (รวมวันนั้นด้วย)
 * @param catKeys กรองเฉพาะหมวดหมู่กายภาพที่ระบุ (ว่าง = ทุกหมวด) — กรองฝั่ง app
 *                เพราะหมวดหมู่คำนวณจาก ICD-10 ในโค้ด ไม่ได้เก็บไว้ใน DB
 */
export async function getPtIpdRegister(
  start: string,
  end: string,
  catKeys: string[] = [],
): Promise<PtIpdRegisterData> {
  const [raw] = await db.query<QueryRow[]>(
    `
    SELECT
      pmi.an                                        AS an,
      pmi.hn                                        AS hn,
      DATE(pmi.vstdate)                             AS service_date,
      COALESCE(pmi.service_time, '')                AS service_time,
      COALESCE(pmi.service_text, '')                AS service_text,
      TRIM(CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ',
                  COALESCE(p.lname, '')))           AS patient_name,
      COALESCE(a.age_y, 0)                          AS age_y,
      COALESCE(a.age_m, 0)                          AS age_m,
      COALESCE(p.sex, '')                           AS sex,
      COALESCE(py.name, '')                         AS pttype_name,
      COALESCE(a.pdx, '')                           AS pdx,
      COALESCE(icd.name, '')                        AS pdx_name,
      COALESCE(a.dx0, '')                           AS dx0,
      COALESCE(a.dx1, '')                           AS dx1,
      COALESCE(a.dx2, '')                           AS dx2,
      COALESCE(a.dx3, '')                           AS dx3,
      COALESCE(a.dx4, '')                           AS dx4,
      COALESCE(a.dx5, '')                           AS dx5,
      DATE(a.regdate)                               AS regdate,
      DATE(a.dchdate)                               AS dchdate,
      COALESCE(p.addrpart, '')                      AS addrpart,
      COALESCE(p.moopart, '')                       AS moopart,
      COALESCE(t.full_name, '')                     AS address_full
    FROM physic_main_ipd pmi
    INNER JOIN an_stat a      ON a.an = pmi.an
    LEFT  JOIN patient p      ON p.hn = pmi.hn
    LEFT  JOIN pttype py      ON py.pttype = a.pttype
    LEFT  JOIN icd101 icd     ON icd.code = a.pdx
    LEFT  JOIN thaiaddress t  ON t.chwpart = p.chwpart
                             AND t.amppart = p.amppart
                             AND t.tmbpart = p.tmbpart
    WHERE pmi.vstdate BETWEEN ? AND ?
    ORDER BY pmi.vstdate DESC, pmi.service_time DESC
    `,
    [start, end],
  );

  const allRows: PtIpdRow[] = raw.map((r) => {
    const dxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
      .map((d) => (d ?? "").trim())
      .filter(Boolean);
    const pdx = (r.pdx ?? "").trim();
    const codes = [pdx, ...dxList];
    const categoryKey = classifyPtCategory(codes);
    const categoryCode =
      categoryKey === "other"
        ? ""
        : (codes.find((c) => {
            const n = normalizeIcd(c);
            return n && PT_CATEGORY_BY_KEY.get(categoryKey)?.match(n);
          }) ?? "");
    const regdate = dateKey(r.regdate);
    const dchdate = dateKey(r.dchdate);
    const moo = (r.moopart ?? "").trim();
    const address = [
      (r.addrpart ?? "").trim() && `บ้านเลขที่ ${(r.addrpart ?? "").trim()}`,
      moo && `หมู่ ${moo}`,
      (r.address_full ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      an: String(r.an ?? ""),
      hn: String(r.hn ?? ""),
      serviceDate: dateKey(r.service_date),
      serviceTime: String(r.service_time ?? "").slice(0, 5),
      serviceText: (r.service_text ?? "").trim(),
      patientName: (r.patient_name ?? "").trim(),
      ageY: toNum(r.age_y),
      ageM: toNum(r.age_m),
      sex: String(r.sex ?? ""),
      pttypeName: (r.pttype_name ?? "").trim(),
      pdx,
      pdxName: (r.pdx_name ?? "").trim(),
      dxList,
      regdate,
      dchdate,
      los: losDays(regdate, dchdate),
      address,
      categoryKey,
      categoryLabel: PT_CATEGORY_BY_KEY.get(categoryKey)?.label ?? categoryKey,
      categoryCode,
      activities: classifyPtActivities(r.service_text ?? ""),
    };
  });

  // catalog ของ filter คิดจาก "ทุกแถวในช่วง" เสมอ → ยังเห็นยอดหมวดที่ไม่ได้เลือก
  const categories = buildCategories(allRows);
  const keySet = new Set(catKeys);
  const rows = keySet.size
    ? allRows.filter((r) => keySet.has(r.categoryKey))
    : allRows;

  return {
    updatedAt: new Date().toISOString(),
    start,
    end,
    categories,
    rows,
    summary: buildSummary(rows),
  };
}

/** ทุกหมวดในทะเบียน + ยอดในช่วงนี้ (หมวดที่ยอด 0 ก็แสดง — เป็นข้อมูลของรายงาน) */
function buildCategories(rows: PtIpdRow[]): PtIpdCategoryItem[] {
  const count = new Map<string, number>();
  const anSet = new Map<string, Set<string>>();
  for (const r of rows) {
    count.set(r.categoryKey, (count.get(r.categoryKey) ?? 0) + 1);
    if (!anSet.has(r.categoryKey)) anSet.set(r.categoryKey, new Set());
    if (r.an) anSet.get(r.categoryKey)!.add(r.an);
  }
  return PT_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    bg: c.bg,
    hint: c.hint,
    count: count.get(c.key) ?? 0,
    admissions: anSet.get(c.key)?.size ?? 0,
  }));
}

function buildSummary(rows: PtIpdRow[]): PtIpdRegisterData["summary"] {
  const byCat = new Map<string, { count: number; an: Set<string> }>();
  const byMonth = new Map<string, { count: number; an: Set<string> }>();
  const byActivity = new Map<string, number>();
  const byPdx = new Map<string, { name: string; count: number }>();
  const anSet = new Set<string>();
  const hnSet = new Set<string>();
  const losByAn = new Map<string, number>();

  for (const r of rows) {
    const c = byCat.get(r.categoryKey) ?? { count: 0, an: new Set<string>() };
    c.count += 1;
    if (r.an) c.an.add(r.an);
    byCat.set(r.categoryKey, c);

    const month = r.serviceDate.slice(0, 7);
    if (month) {
      const m = byMonth.get(month) ?? { count: 0, an: new Set<string>() };
      m.count += 1;
      if (r.an) m.an.add(r.an);
      byMonth.set(month, m);
    }

    for (const a of r.activities) byActivity.set(a, (byActivity.get(a) ?? 0) + 1);

    if (r.pdx) {
      const p = byPdx.get(r.pdx) ?? { name: r.pdxName, count: 0 };
      p.count += 1;
      byPdx.set(r.pdx, p);
    }

    if (r.an) {
      anSet.add(r.an);
      if (r.los != null) losByAn.set(r.an, r.los); // นับวันนอน 1 ครั้งต่อ 1 AN
    }
    if (r.hn) hnSet.add(r.hn);
  }

  const losValues = [...losByAn.values()];
  const avgLos = losValues.length
    ? losValues.reduce((s, v) => s + v, 0) / losValues.length
    : 0;

  return {
    total: rows.length,
    admissions: anSet.size,
    patients: hnSet.size,
    avgPerAdmission: anSet.size
      ? Math.round((rows.length / anSet.size) * 10) / 10
      : 0,
    avgLos: Math.round(avgLos * 10) / 10,
    byCategory: PT_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      count: byCat.get(c.key)?.count ?? 0,
      admissions: byCat.get(c.key)?.an.size ?? 0,
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count),
    byMonth: [...byMonth.entries()]
      .map(([month, v]) => ({ month, count: v.count, admissions: v.an.size }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byActivity: PT_ACTIVITIES.map((a) => ({
      key: a.key,
      label: a.label,
      count: byActivity.get(a.key) ?? 0,
    }))
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count),
    byPdx: [...byPdx.entries()]
      .map(([code, v]) => ({ code, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
  };
}
