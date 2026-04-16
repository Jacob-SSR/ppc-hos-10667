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

// ── Ward config: ward_code → ชื่อ + จำนวนเตียงจริงจาก bedno ────────────────
// จำนวนเตียงได้จากการนับ bedno ที่ผูกกับแต่ละ ward (roomno)
export const WARD_CONFIG: Record<string, { label: string; totalBeds: number }> =
  {
    "1": { label: "ผู้ป่วยใน", totalBeds: 39 },
    "4": { label: "ห้องพิเศษ", totalBeds: 14 },
    "13": { label: "Ward LR", totalBeds: 10 },
    "14": { label: "HW ยาเสพติด", totalBeds: 31 },
    "15": { label: "พลับพลารักษ์", totalBeds: 10 },
    "16": { label: "HW Palliative", totalBeds: 5 },
    "17": { label: "IMC", totalBeds: 3 },
  };

const WARD_CODES = Object.keys(WARD_CONFIG); // ['1','4','13','14','15','16','17']

export async function getIpdDischarge(
  start: string,
  end: string,
): Promise<IpdDischargeRow[]> {
  const placeholders = WARD_CODES.map(() => "?").join(",");
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
    [start, end, ...WARD_CODES],
  );
  return rows;
}

export async function getIpdSummary(
  start: string,
  end: string,
): Promise<IpdSummaryData> {
  const placeholders = WARD_CODES.map(() => "?").join(",");

  // ── Ward stats ─────────────────────────────────────────────────────────────
  // สร้าง UNION ALL สำหรับทุก ward เพื่อให้ได้ครบแม้ไม่มีข้อมูล
  const wardUnion = WARD_CODES.map(() => `SELECT ? AS ward_code`).join(
    " UNION ALL ",
  );

  const [wardRows] = await db.query<IpdWardStat[]>(
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
        ipt.ward                                                    AS ward_code,
        COUNT(*)                                                    AS total,
        COUNT(DISTINCT ipt.hn)                                      AS unique_patients,
        ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1)          AS avg_los,
        SUM(ipt.dchtype = '1')                                      AS discharge_normal,
        SUM(ipt.dchtype != '1')                                     AS discharge_other
      FROM ipt
      WHERE ipt.dchdate BETWEEN ? AND ?
        AND ipt.ward IN (${placeholders})
      GROUP BY ipt.ward
    ) d ON d.ward_code = w.ward_code
    LEFT JOIN (
      SELECT
        ward            AS ward_code,
        COUNT(*)        AS admit_total
      FROM an_stat
      WHERE regdate BETWEEN ? AND ?
        AND ward IN (${placeholders})
      GROUP BY ward
    ) a ON a.ward_code = w.ward_code
    ORDER BY FIELD(w.ward_code, ${WARD_CODES.map(() => "?").join(",")})
    `,
    [
      ...WARD_CODES, // ward_code values for UNION
      start,
      end, // discharge range
      ...WARD_CODES, // discharge ward filter
      start,
      end, // admit range
      ...WARD_CODES, // admit ward filter
      ...WARD_CODES, // FIELD() order
    ],
  );

  // ── Overall summary ────────────────────────────────────────────────────────
  const [totalRows] = await db.query<IpdSummaryRow[]>(
    `
    SELECT
      COUNT(*)                                                  AS total,
      COUNT(DISTINCT ipt.hn)                                    AS unique_patients,
      ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1)        AS avg_los
    FROM ipt
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    `,
    [start, end, ...WARD_CODES],
  );

  // ── By pttype ──────────────────────────────────────────────────────────────
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
    [start, end, ...WARD_CODES],
  );

  // ── By dchtype ─────────────────────────────────────────────────────────────
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
    [start, end, ...WARD_CODES],
  );

  return {
    summary: totalRows[0],
    byWard: wardRows,
    byPttype: pttypeRows,
    byDchtype: dchtypeRows,
  };
}

// ── Bed Occupancy (ปัจจุบัน) ──────────────────────────────────────────────────
// นับจำนวน admit ปัจจุบัน (ยังไม่จำหน่าย) ต่อ ward
export interface BedOccupancyRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

export async function getBedOccupancy(): Promise<BedOccupancyRow[]> {
  const placeholders = WARD_CODES.map(() => "?").join(",");

  // นับผู้ป่วยที่ยัง admit อยู่ (dchdate IS NULL หรือ dchdate = วันนี้)
  const [rows] = await db.query<RowDataPacket[]>(
    `
    SELECT
      a.ward AS ward_code,
      COUNT(*) AS current_admit
    FROM an_stat a
    WHERE a.dchdate IS NULL
      AND a.ward IN (${placeholders})
    GROUP BY a.ward
    `,
    WARD_CODES,
  );

  const admitMap: Record<string, number> = {};
  for (const r of rows) {
    admitMap[String(r.ward_code)] = Number(r.current_admit);
  }

  return WARD_CODES.map((wc) => {
    const cfg = WARD_CONFIG[wc];
    const currentAdmit = admitMap[wc] ?? 0;
    const rate =
      cfg.totalBeds > 0 ? Math.round((currentAdmit / cfg.totalBeds) * 100) : 0;

    return {
      ward_code: wc,
      label: cfg.label,
      total_beds: cfg.totalBeds,
      current_admit: currentAdmit,
      occupancy_rate: rate,
    };
  });
}
