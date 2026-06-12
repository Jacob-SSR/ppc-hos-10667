// lib/dmht.service.ts
// SQL service สำหรับ Dashboard "DM/HT รายใหม่" — งานปฐมภูมิ
//
// นิยาม "รายใหม่":
//   ผู้ที่ขึ้นทะเบียนเป็นสมาชิกคลินิกโรคเรื้อรัง (clinicmember) ในช่วงเวลาที่เลือก
//   - clinic '001' = คลินิก DM (เบาหวาน)
//   - clinic '002' = คลินิก HT (ความดันโลหิตสูง)
//   อ้างอิง pattern เดียวกับรายงานนับรายใหม่ที่ระบบใช้อยู่ (clinicmember.regdate)
//   นับเฉพาะที่ยังไม่ถูกจำหน่าย (dchdate IS NULL OR '')
//
// พื้นที่ (เขตรับผิดชอบ): chwpart='31' (บุรีรัมย์) amppart='15' (พลับพลาชัย)
//   - แยกรายตำบล  = patient.tmbpart
//   - แยกรายหมู่บ้าน = patient.moopart (ภายในแต่ละตำบล)
//
// หมายเหตุ: ปรับ DM_CLINIC / HT_CLINIC / CHW / AMP ให้ตรง master ของ รพ. ได้

import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

const DM_CLINIC = "001";
const HT_CLINIC = "002";
const CHW = "31";
const AMP = "15";

export type DiseaseKey = "DM" | "HT";

export interface DmhtMooRow {
  tmbpart: string;
  tmb_name: string;
  moopart: string;
  moo_name: string;
  dm: number;
  ht: number;
  total: number;
}

export interface DmhtTambonRow {
  tmbpart: string;
  tmb_name: string;
  dm: number;
  ht: number;
  total: number;
  moo: DmhtMooRow[];
}

export interface DmhtSummary {
  start: string;
  end: string;
  fiscalYear: string; // เช่น "2569"
  totalDM: number;
  totalHT: number;
  grandTotal: number;
  byTambon: DmhtTambonRow[];
}

interface CountRow extends RowDataPacket {
  clinic: string;
  tmbpart: string;
  tmb_name: string | null;
  moopart: string;
  cc: number | string;
}

// ปีงบประมาณไทยจากวันที่เริ่ม (เริ่ม 1 ต.ค.) → คืน พ.ศ.
function fiscalYearOf(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  const beYear = y + 543;
  // ต.ค.–ธ.ค. นับเป็นปีงบถัดไป
  return String(m >= 10 ? beYear + 1 : beYear);
}

export async function getDmhtNew(
  start: string,
  end: string,
): Promise<DmhtSummary> {
  // นับสมาชิกรายใหม่แยกตาม clinic + ตำบล + หมู่บ้าน ในครั้งเดียว
  // ใช้ COUNT(DISTINCT c.hn) กันการนับซ้ำกรณีมีหลายแถวต่อ hn
  const [rows] = await db.query<CountRow[]>(
    `
    SELECT
      c.clinic                                   AS clinic,
      p.tmbpart                                  AS tmbpart,
      t.full_name                                AS tmb_name,
      p.moopart                                  AS moopart,
      COUNT(DISTINCT c.hn)                        AS cc
    FROM clinicmember c
    INNER JOIN patient p ON c.hn = p.hn
    INNER JOIN thaiaddress t
      ON t.chwpart = p.chwpart
      AND t.amppart = p.amppart
      AND t.tmbpart = p.tmbpart
    WHERE c.clinic IN (?, ?)
      AND c.regdate BETWEEN ? AND ?
      AND p.chwpart = ?
      AND p.amppart = ?
      AND (c.dchdate IS NULL OR c.dchdate = '')
    GROUP BY c.clinic, p.tmbpart, p.moopart
    ORDER BY p.tmbpart, p.moopart
    `,
    [DM_CLINIC, HT_CLINIC, start, end, CHW, AMP],
  );

  // จัดกลุ่ม: tambon → moo
  const tambonMap = new Map<string, DmhtTambonRow>();
  const mooMap = new Map<string, DmhtMooRow>();

  const n = (v: unknown) => Number(v ?? 0);

  for (const r of rows) {
    const tmb = String(r.tmbpart ?? "").trim();
    const moo = String(r.moopart ?? "").trim();
    const tmbName = (r.tmb_name ?? "").trim() || `ตำบล ${tmb}`;
    const mooName = `หมู่ ${Number(moo) || moo}`;
    const cnt = n(r.cc);
    const isDM = String(r.clinic) === DM_CLINIC;

    // ── tambon ──
    let trow = tambonMap.get(tmb);
    if (!trow) {
      trow = {
        tmbpart: tmb,
        tmb_name: tmbName,
        dm: 0,
        ht: 0,
        total: 0,
        moo: [],
      };
      tambonMap.set(tmb, trow);
    }
    if (isDM) trow.dm += cnt;
    else trow.ht += cnt;
    trow.total += cnt;

    // ── moo ──
    const mooKey = `${tmb}__${moo}`;
    let mrow = mooMap.get(mooKey);
    if (!mrow) {
      mrow = {
        tmbpart: tmb,
        tmb_name: tmbName,
        moopart: moo,
        moo_name: mooName,
        dm: 0,
        ht: 0,
        total: 0,
      };
      mooMap.set(mooKey, mrow);
    }
    if (isDM) mrow.dm += cnt;
    else mrow.ht += cnt;
    mrow.total += cnt;
  }

  // ผูก moo เข้า tambon + sort
  for (const m of mooMap.values()) {
    tambonMap.get(m.tmbpart)?.moo.push(m);
  }

  const sortByCode = <T extends { moopart?: string; tmbpart: string }>(
    a: T,
    b: T,
  ) => {
    const av = Number(a.moopart ?? a.tmbpart);
    const bv = Number(b.moopart ?? b.tmbpart);
    if (!isNaN(av) && !isNaN(bv)) return av - bv;
    return String(a.moopart ?? a.tmbpart).localeCompare(
      String(b.moopart ?? b.tmbpart),
      "th",
    );
  };

  const byTambon = Array.from(tambonMap.values()).sort((a, b) => {
    const av = Number(a.tmbpart);
    const bv = Number(b.tmbpart);
    return !isNaN(av) && !isNaN(bv)
      ? av - bv
      : a.tmbpart.localeCompare(b.tmbpart, "th");
  });
  byTambon.forEach((t) => t.moo.sort(sortByCode));

  const totalDM = byTambon.reduce((s, t) => s + t.dm, 0);
  const totalHT = byTambon.reduce((s, t) => s + t.ht, 0);

  return {
    start,
    end,
    fiscalYear: fiscalYearOf(start),
    totalDM,
    totalHT,
    grandTotal: totalDM + totalHT,
    byTambon,
  };
}
