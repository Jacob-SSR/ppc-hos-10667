// lib/d506.service.ts
// รายงานโรคที่ต้องเฝ้าระวังทางระบาดวิทยา (รง.506) — ดึงตรงจาก HOSxP (ตาราง surveil_member)
// ป้อนหน้า /pages/d506-report : การ์ดสรุป + แนวโน้มรายเดือน + ตารางรายโรค + รายชื่อผู้ป่วย
import { db } from "@/lib/db";
import { cachedQuery } from "./cache";
import { disease506Name, cleanDiseaseName } from "./code506";

const TTL = 600; // 10 นาที — ทะเบียน 506 ไม่ได้เปลี่ยนถี่

// ─── Types ──────────────────────────────────────────────────────────────────
export interface D506PatientRow {
  reportDate: string; // วันที่รับรายงาน
  vstdate: string;
  onsetDate: string; // วันที่เริ่มป่วย
  hn: string;
  cid: string;
  prefix: string;
  fname: string;
  lname: string;
  sex: string; // ชาย / หญิง
  dob: string; // วันเกิด (YYYY-MM-DD)
  age: number | null;
  house: string; // บ้านเลขที่
  moo: string;
  tambon: string;
  amphoe: string;
  province: string;
  disease: string;
  code506: string;
  icd10: string;
  ptype: string; // OPD / IPD (surveil_member.department)
  status: string; // สถานะผู้ป่วย
  death: boolean;
}

export interface D506DiseaseSummary {
  code506: string;
  name: string;
  male: number;
  female: number;
  total: number;
  death: number;
}

export interface D506Report {
  updatedAt: string;
  range: { start: string; end: string };
  cards: {
    total: number;
    male: number;
    female: number;
    death: number;
    diseases: number;
  };
  summary: D506DiseaseSummary[]; // เรียงตามจำนวนมาก→น้อย
  monthly: number[]; // 12 เดือน (ม.ค.–ธ.ค.) ของปีตาม start
  patients: D506PatientRow[];
}

// ─── HOSxP status code (ptstat) → ข้อความ ─────────────────────────────────────
// surveil_member.ptstat: 1=หาย, 3=กำลังรักษา/ยังไม่หาย, 4=ไม่ทราบผล, 5=ตาย/ส่งต่อ
const PTSTAT_LABEL: Record<string, string> = {
  "1": "หาย",
  "2": "ยังมีอาการ",
  "3": "กำลังรักษา",
  "4": "ไม่ทราบผล",
  "5": "เสียชีวิต/ส่งต่อ",
};

// ─── Raw row จาก SQL ──────────────────────────────────────────────────────────
interface RawRow {
  report_date: string | Date | null;
  vstdate: string | Date | null;
  begin_date: string | Date | null;
  hn: string | null;
  cid: string | null;
  pname: string | null;
  fname: string | null;
  lname: string | null;
  sex: string | null;
  birthday: string | Date | null;
  age: number | null;
  house: string | null;
  moo: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  disease506: string | null; // ชื่อโรคจากตาราง name506 (อาจ null ถ้า join ไม่เจอ)
  code506: string | null;
  icd10: string | null;
  ptype: string | null;
  ptstat: string | null;
  is_dead: number | null;
}

const asDate = (v: string | Date | null): string => {
  if (!v) return "";
  if (v instanceof Date) {
    return [
      v.getFullYear(),
      String(v.getMonth() + 1).padStart(2, "0"),
      String(v.getDate()).padStart(2, "0"),
    ].join("-");
  }
  return String(v).slice(0, 10);
};
// coerce ทุกชนิด → string ก่อน trim (บางคอลัมน์ HOSxP เช่น ptstat เป็นตัวเลข/Buffer
// ถ้าเรียก .trim() ตรง ๆ จะพัง "x.trim is not a function")
const s = (v: unknown): string => (v == null ? "" : String(v).trim());

// ─── Query หลัก ───────────────────────────────────────────────────────────────
async function fetchReport(start: string, end: string): Promise<D506Report> {
  // 1) รายการผู้ป่วยในช่วงวันที่ (ใช้ทำการ์ด + ตารางรายโรค + รายชื่อ)
  const [rawRows] = await db.query(
    `
    SELECT
      s.report_date, s.vstdate, s.begin_date,
      s.hn, p.cid, p.pname, p.fname, p.lname, p.sex, p.birthday,
      TIMESTAMPDIFF(YEAR, p.birthday, s.vstdate) AS age,
      s.addr AS house, s.moo,
      t3.name AS tambon, t2.name AS amphoe, t1.name AS province,
      n.name AS disease506,
      s.code506, s.pdx AS icd10, s.department AS ptype, s.ptstat,
      IF(s.death_date IS NOT NULL, 1, 0) AS is_dead
    FROM surveil_member s
    LEFT JOIN patient p       ON p.hn = s.hn
    LEFT JOIN name506  n      ON n.code506 = s.code506
    LEFT JOIN thaiaddress t1  ON t1.chwpart = s.chwpart AND t1.amppart = '00'     AND t1.tmbpart = '00'
    LEFT JOIN thaiaddress t2  ON t2.chwpart = s.chwpart AND t2.amppart = s.amppart AND t2.tmbpart = '00'
    LEFT JOIN thaiaddress t3  ON t3.chwpart = s.chwpart AND t3.amppart = s.amppart AND t3.tmbpart = s.tmbpart
    WHERE s.report_date >= ? AND s.report_date < DATE_ADD(?, INTERVAL 1 DAY)
    ORDER BY s.report_date DESC, s.hn
    `,
    [start, end],
  );

  const rows = rawRows as RawRow[];

  // 2) แนวโน้มรายเดือน — ทั้งปี (ปฏิทิน) ของปีที่อยู่ใน start
  const year = Number(start.slice(0, 4));
  const [monthRows] = await db.query(
    `
    SELECT MONTH(s.report_date) AS m, COUNT(*) AS cnt
    FROM surveil_member s
    WHERE YEAR(s.report_date) = ?
    GROUP BY MONTH(s.report_date)
    `,
    [year],
  );
  const monthly = Array<number>(12).fill(0);
  for (const r of monthRows as { m: number; cnt: number }[]) {
    if (r.m >= 1 && r.m <= 12) monthly[r.m - 1] = Number(r.cnt);
  }

  // ─── สร้าง patient list + summary + cards ───────────────────────────────────
  const patients: D506PatientRow[] = rows.map((r) => ({
    reportDate: asDate(r.report_date),
    vstdate: asDate(r.vstdate),
    onsetDate: asDate(r.begin_date),
    hn: s(r.hn),
    cid: s(r.cid),
    prefix: s(r.pname),
    fname: s(r.fname),
    lname: s(r.lname),
    sex: s(r.sex) === "1" ? "ชาย" : "หญิง",
    dob: asDate(r.birthday),
    age: r.age != null ? Number(r.age) : null,
    house: s(r.house),
    moo: s(r.moo),
    tambon: s(r.tambon),
    amphoe: s(r.amphoe),
    province: s(r.province),
    // ชื่อโรค: ใช้จาก name506 (ตัดวงเล็บรหัสท้ายออก) ถ้าไม่มีค่อย fallback map ในโค้ด
    disease: cleanDiseaseName(s(r.disease506)) || disease506Name(s(r.code506)),
    code506: s(r.code506),
    icd10: s(r.icd10),
    ptype: s(r.ptype),
    status: PTSTAT_LABEL[s(r.ptstat)] ?? s(r.ptstat),
    death: Number(r.is_dead) === 1,
  }));

  // summary รายโรค
  const map = new Map<string, D506DiseaseSummary>();
  let male = 0, female = 0, death = 0;
  for (const p of patients) {
    const key = p.code506 || p.disease;
    let e = map.get(key);
    if (!e) {
      e = { code506: p.code506, name: p.disease, male: 0, female: 0, total: 0, death: 0 };
      map.set(key, e);
    }
    e.total++;
    if (p.sex === "ชาย") { e.male++; male++; } else { e.female++; female++; }
    if (p.death) { e.death++; death++; }
  }
  const summary = [...map.values()].sort((a, b) => b.total - a.total);

  return {
    updatedAt: new Date().toISOString(),
    range: { start, end },
    cards: {
      total: patients.length,
      male,
      female,
      death,
      diseases: summary.filter((d) => d.total > 0).length,
    },
    summary,
    monthly,
    patients,
  };
}

export function getD506Report(start: string, end: string): Promise<D506Report> {
  return cachedQuery(["d506-report", start, end], () => fetchReport(start, end), TTL);
}
