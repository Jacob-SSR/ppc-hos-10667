// lib/sepsis.service.ts
import { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";

export interface AddressParts {
  houseNo: string; // เลขที่ (addrpart)
  moo: string; // หมู่ (moopart)
  tambon: string; // ตำบล
  amphur: string; // อำเภอ
  changwat: string; // จังหวัด
}

interface PatientAddrRow extends RowDataPacket {
  hn: string;
  houseNo: string | null;
  moo: string | null;
  tambon: string | null;
  amphur: string | null;
  changwat: string | null;
}

/** normalize HN: ตัดช่องว่าง + pad 0 ให้ครบ 9 หลัก (เฉพาะตัวเลขล้วน) */
function normHn(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? s.padStart(9, "0") : s;
}

/** ตัด prefix ต./อ./จ. ที่บางเวอร์ชัน HosXP ใส่มาใน thaiaddress.name */
function stripPrefix(v: string | null): string {
  return String(v ?? "")
    .trim()
    .replace(/^(ต\.|อ\.|จ\.|ตำบล|อำเภอ|จังหวัด)\s*/, "")
    .trim();
}

/**
 * รับรายการ HN → คืน Map<hn(ดิบจากชีต), AddressParts>
 */
export async function getAddressByHn(
  hns: string[],
): Promise<Map<string, AddressParts>> {
  const result = new Map<string, AddressParts>();

  // เก็บ mapping: hn ที่ normalize แล้ว → hn ดิบทั้งหมดที่ map มา
  const rawByNorm = new Map<string, string[]>();
  for (const raw of hns) {
    const r = String(raw ?? "").trim();
    if (!r) continue;
    const n = normHn(r);
    const arr = rawByNorm.get(n) ?? [];
    arr.push(r);
    rawByNorm.set(n, arr);
  }
  if (rawByNorm.size === 0) return result;

  // ยิงทั้งค่า normalize และค่าดิบ (กันกรณี hn ใน DB ไม่ได้ pad)
  const lookup = new Set<string>();
  for (const [n, raws] of rawByNorm) {
    lookup.add(n);
    raws.forEach((r) => lookup.add(r));
  }
  const hnList = [...lookup];

  // แบ่ง batch ละ 500 กัน IN clause ยาวเกิน
  const CHUNK = 500;
  const dbRows: PatientAddrRow[] = [];
  for (let i = 0; i < hnList.length; i += CHUNK) {
    const chunk = hnList.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const [rows] = await db.query<PatientAddrRow[]>(
      `
      SELECT
        p.hn                       AS hn,
        TRIM(p.addrpart)           AS houseNo,
        TRIM(p.moopart)            AS moo,
        ttmb.name                  AS tambon,
        tamp.name                  AS amphur,
        tchw.name                  AS changwat
      FROM patient p
      LEFT JOIN thaiaddress ttmb
        ON  ttmb.chwpart = p.chwpart
        AND ttmb.amppart = p.amppart
        AND ttmb.tmbpart = p.tmbpart
      LEFT JOIN thaiaddress tamp
        ON  tamp.chwpart = p.chwpart
        AND tamp.amppart = p.amppart
        AND tamp.tmbpart = '00'
      LEFT JOIN thaiaddress tchw
        ON  tchw.chwpart = p.chwpart
        AND tchw.amppart = '00'
        AND tchw.tmbpart = '00'
      WHERE p.hn IN (${placeholders})
      `,
      chunk,
    );
    dbRows.push(...rows);
  }

  // สร้าง lookup จากผล DB: ทั้ง hn ตรงตัว และ hn แบบ normalize
  const addrByHn = new Map<string, AddressParts>();
  for (const r of dbRows) {
    const parts: AddressParts = {
      houseNo: String(r.houseNo ?? "").trim(),
      moo: String(r.moo ?? "").trim(),
      tambon: stripPrefix(r.tambon),
      amphur: stripPrefix(r.amphur),
      changwat: stripPrefix(r.changwat),
    };
    // ข้าม record ที่ว่างทั้งหมด
    if (!Object.values(parts).some(Boolean)) continue;
    const dbHn = String(r.hn ?? "").trim();
    addrByHn.set(dbHn, parts);
    addrByHn.set(normHn(dbHn), parts);
  }

  // map กลับไปหา hn ดิบจากชีต
  for (const [n, raws] of rawByNorm) {
    for (const raw of raws) {
      const parts = addrByHn.get(raw) ?? addrByHn.get(n);
      if (parts) result.set(raw, parts);
    }
  }

  return result;
}
