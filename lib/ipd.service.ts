import { db } from "@/lib/db";
import {
  IpdDischargeRow,
  IpdWardStat,
  IpdPttypeRow,
  IpdDchtypeRow,
  IpdSummaryData,
} from "@/types/allTypes";
import { RowDataPacket } from "mysql2";

interface IpdSummaryRow extends RowDataPacket {
  total: number;
  unique_patients: number;
  avg_los: number;
}

interface WardInfoRow extends RowDataPacket {
  ward_code: string;
  name: string;
  total_beds: number;
}

// ─── Ward Config (source of truth) ────────────────────────────────────────────
// key = ward_code ใน DB
// - label: ชื่อที่จะแสดงบน UI (ถ้าไม่ใส่ ใช้ชื่อจาก DB)
// - totalBeds: จำนวนเตียงจริง (override ค่าจาก bedno table)
// - isHomeWard: true = จะถูกยุบรวมเป็น "Home Ward" รายการเดียว
interface WardConfigItem {
  label?: string;
  totalBeds: number;
  isHomeWard?: boolean;
}

const WARD_CONFIG: Record<string, WardConfigItem> = {
  "01": { label: "ผู้ป่วยใน", totalBeds: 39 },
  "04": { label: "ห้องพิเศษ", totalBeds: 14 },
  "05": { label: "COHORT WARD", totalBeds: 2 },
  "11": { label: "Ward Colono 2 (PP)", totalBeds: 7 },
  "12": { label: "Ward Colono 1 (IP)", totalBeds: 3 },
  "13": { label: "Ward LR", totalBeds: 10 },
  "14": { label: "HW ยาเสพติด", totalBeds: 31, isHomeWard: true },
  "15": { label: "พลับพลารักษ์", totalBeds: 10, isHomeWard: true },
  "16": { label: "HW Palliative", totalBeds: 5, isHomeWard: true },
  "17": { label: "IMC", totalBeds: 3 },
};

const ACTIVE_WARD_CODES = Object.keys(WARD_CONFIG);

// ─── Cache ────────────────────────────────────────────────────────────────────
interface CachedWards {
  data: WardInfoRow[];
  expiresAt: number;
}
let wardCache: CachedWards | null = null;

async function getActiveWards(): Promise<WardInfoRow[]> {
  const now = Date.now();
  if (wardCache && wardCache.expiresAt > now) {
    return wardCache.data;
  }

  if (ACTIVE_WARD_CODES.length === 0) {
    wardCache = { data: [], expiresAt: now + 5 * 60 * 1000 };
    return [];
  }

  const placeholders = ACTIVE_WARD_CODES.map(() => "?").join(",");

  // ดึงชื่อจริงจาก DB เพื่อ fallback ถ้า config ไม่ได้ตั้ง label ไว้
  const [rows] = await db.query<WardInfoRow[]>(
    `
    SELECT
      w.ward AS ward_code,
      w.name,
      0 AS total_beds
    FROM ward w
    WHERE w.ward IN (${placeholders})
    ORDER BY FIELD(w.ward, ${placeholders})
    `,
    [...ACTIVE_WARD_CODES, ...ACTIVE_WARD_CODES],
  );

  // Override ด้วย config (label + totalBeds)
  const merged: WardInfoRow[] = rows.map((r) => {
    const cfg = WARD_CONFIG[r.ward_code];
    return {
      ...r,
      name: cfg?.label ?? r.name,
      total_beds: cfg?.totalBeds ?? 0,
    };
  });

  wardCache = {
    data: merged,
    expiresAt: now + 5 * 60 * 1000,
  };
  return merged;
}

export async function getIpdDischarge(
  start: string,
  end: string,
): Promise<IpdDischargeRow[]> {
  const wards = await getActiveWards();
  if (wards.length === 0) return [];

  const wardCodes = wards.map((w) => w.ward_code);
  const placeholders = wardCodes.map(() => "?").join(",");

  const [rows] = await db.query<IpdDischargeRow[]>(
    `
    SELECT
      dd.name          AS dchtype_name,
      ipt.hn,
      pa.cid,
      ipt.an,
      pa.pname,
      pa.fname,
      pa.lname,
      ipt.regdate,
      ipt.regtime,
      ipt.dchdate,
      ipt.dchtime,
      ipt.rw           AS ward_code,
      d.name           AS doctor_name,
      a.admdate,
      a.pdx,
      p1.name          AS pttype_name,
      CONCAT(pa.addrpart, ' หมู่บ้าน', pa.moopart, ' ', t.full_name) AS address,
      DATEDIFF(ipt.dchdate, ipt.regdate) AS los
    FROM ipt
    INNER JOIN patient pa  ON pa.hn  = ipt.hn
    INNER JOIN an_stat a   ON a.an   = ipt.an
    INNER JOIN thaiaddress t ON t.addressid = a.aid
    LEFT  JOIN doctor d    ON d.code = ipt.dch_doctor
    INNER JOIN pttype p1   ON a.pttype = p1.pttype
    LEFT  JOIN dchtype dd  ON dd.dchtype = ipt.dchtype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    ORDER BY ipt.dchdate DESC, ipt.dchtime DESC
    `,
    [start, end, ...wardCodes],
  );
  return rows;
}

export async function getIpdSummary(
  start: string,
  end: string,
): Promise<IpdSummaryData> {
  const wards = await getActiveWards();
  if (wards.length === 0) {
    return {
      summary: { total: 0, unique_patients: 0, avg_los: 0 },
      byWard: [],
      byPttype: [],
      byDchtype: [],
    };
  }

  const wardCodes = wards.map((w) => w.ward_code);
  const placeholders = wardCodes.map(() => "?").join(",");

  // ── Ward stats (ทุก ward แม้ไม่มีข้อมูล) ───────────────────────────────────
  const wardUnion = wardCodes
    .map(() => `SELECT ? AS ward_code`)
    .join(" UNION ALL ");
  const [rawWardRows] = await db.query<IpdWardStat[]>(
    `
    SELECT
      w.ward_code,
      COALESCE(d.total,            0) AS total,
      COALESCE(d.unique_patients,  0) AS unique_patients,
      COALESCE(d.avg_los,          0) AS avg_los,
      COALESCE(d.discharge_normal, 0) AS discharge_normal,
      COALESCE(d.discharge_other,  0) AS discharge_other,
      COALESCE(a.admit_total,      0) AS admit_total
    FROM (${wardUnion}) w
    LEFT JOIN (
      SELECT
        ipt.ward                                              AS ward_code,
        COUNT(*)                                              AS total,
        COUNT(DISTINCT ipt.hn)                                AS unique_patients,
        ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1)    AS avg_los,
        SUM(ipt.dchtype = '1')                                AS discharge_normal,
        SUM(ipt.dchtype != '1')                               AS discharge_other
      FROM ipt
      WHERE ipt.dchdate BETWEEN ? AND ?
        AND ipt.ward IN (${placeholders})
      GROUP BY ipt.ward
    ) d ON d.ward_code = w.ward_code
    LEFT JOIN (
      SELECT ward AS ward_code, COUNT(*) AS admit_total
      FROM an_stat
      WHERE regdate BETWEEN ? AND ?
        AND ward IN (${placeholders})
      GROUP BY ward
    ) a ON a.ward_code = w.ward_code
    `,
    [
      ...wardCodes, // UNION values
      start,
      end,
      ...wardCodes, // discharge filter
      start,
      end,
      ...wardCodes, // admit filter
    ],
  );

  // ── Overall summary ────────────────────────────────────────────────────────
  const [totalRows] = await db.query<IpdSummaryRow[]>(
    `
    SELECT
      COUNT(*)                                           AS total,
      COUNT(DISTINCT ipt.hn)                             AS unique_patients,
      ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los
    FROM ipt
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    `,
    [start, end, ...wardCodes],
  );

  // ── Pttype + Dchtype ───────────────────────────────────────────────────────
  const [pttypeRows] = await db.query<IpdPttypeRow[]>(
    `
    SELECT p1.name AS pttype_name, COUNT(*) AS total
    FROM ipt
    INNER JOIN an_stat a ON a.an = ipt.an
    INNER JOIN pttype p1 ON a.pttype = p1.pttype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    GROUP BY p1.name
    ORDER BY total DESC
    LIMIT 8
    `,
    [start, end, ...wardCodes],
  );

  const [dchtypeRows] = await db.query<IpdDchtypeRow[]>(
    `
    SELECT
      COALESCE(dd.name, 'ไม่ระบุ') AS dchtype_name,
      COUNT(*) AS total
    FROM ipt
    LEFT JOIN dchtype dd ON dd.dchtype = ipt.dchtype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    GROUP BY dd.name
    ORDER BY total DESC
    `,
    [start, end, ...wardCodes],
  );

  return {
    summary: totalRows[0],
    byWard: rawWardRows,
    byPttype: pttypeRows,
    byDchtype: dchtypeRows,
  };
}

// ─── Bed Occupancy ────────────────────────────────────────────────────────────
export interface BedOccupancyRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

export async function getBedOccupancy(): Promise<BedOccupancyRow[]> {
  const wards = await getActiveWards();
  if (wards.length === 0) return [];

  const wardCodes = wards.map((w) => w.ward_code);
  const placeholders = wardCodes.map(() => "?").join(",");

  // นับ admit ปัจจุบัน (ยังไม่จำหน่าย)
  const [admitRows] = await db.query<RowDataPacket[]>(
    `
    SELECT a.ward AS ward_code, COUNT(*) AS current_admit
    FROM an_stat a
    WHERE a.dchdate IS NULL
      AND a.ward IN (${placeholders})
    GROUP BY a.ward
    `,
    wardCodes,
  );

  const admitMap: Record<string, number> = {};
  for (const r of admitRows) {
    admitMap[String(r.ward_code)] = Number(r.current_admit);
  }

  // สร้างรายการแยก ward พร้อม merge Home Ward
  const rows: BedOccupancyRow[] = [];
  let homeWardTotal = 0;
  let homeWardAdmit = 0;

  for (const w of wards) {
    const admit = admitMap[w.ward_code] ?? 0;
    const cfg = WARD_CONFIG[w.ward_code];

    if (cfg?.isHomeWard) {
      homeWardTotal += Number(w.total_beds);
      homeWardAdmit += admit;
      continue;
    }

    rows.push({
      ward_code: w.ward_code,
      label: w.name,
      total_beds: Number(w.total_beds),
      current_admit: admit,
      occupancy_rate:
        w.total_beds > 0 ? Math.round((admit / Number(w.total_beds)) * 100) : 0,
    });
  }

  // เพิ่ม Home Ward รวม (ถ้ามี)
  if (homeWardTotal > 0) {
    rows.push({
      ward_code: "__home__",
      label: "Home Ward",
      total_beds: homeWardTotal,
      current_admit: homeWardAdmit,
      occupancy_rate: Math.round((homeWardAdmit / homeWardTotal) * 100),
    });
  }

  return rows;
}
