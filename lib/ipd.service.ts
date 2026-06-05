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

interface WardConfigItem {
  label?: string;
  totalBeds: number;
  isHomeWard?: boolean;
  realWard?: string;
  bednoPrefix?: string[];
  bednoPrefixExclude?: string[];
  // hardcode admit = 0 ไม่ query DB
  forceZero?: boolean;
}

const WARD_CONFIG: Record<string, WardConfigItem> = {
  "01": {
    label: "Ward",
    totalBeds: 26,
    bednoPrefixExclude: ["นช", "นญ", "ย", "แยก", "IMC", "NEG"],
  },
  "04": { label: "ห้องพิเศษ", totalBeds: 11 },
  "05": {
    label: "ห้องแยกโรค",
    totalBeds: 2, // ย3/1, ย3/2
    realWard: "01",
    bednoPrefix: ["ย"],
  },
  "11": {
    label: "เตียงเสริม",
    totalBeds: 16,
    realWard: "01",
    bednoPrefix: ["นช", "นญ"],
  },
  __neg__: {
    label: "ห้องNegative",
    totalBeds: 2,
    realWard: "01",
    bednoPrefix: ["NEG", "แยก"],
  },
  "15": { label: "พลับพลารักษ์", totalBeds: 10 },
  "17": {
    label: "เตียงIMC",
    totalBeds: 2,
    realWard: "01",
    bednoPrefix: ["IMC"],
  },
  "14": { label: "HW ยาเสพติด", totalBeds: 5, isHomeWard: true },
  "16": { label: "HW Palliative", totalBeds: 5, isHomeWard: true },
};

interface CachedWards {
  data: WardInfoRow[];
  expiresAt: number;
}
let wardCache: CachedWards | null = null;

async function getActiveWards(): Promise<WardInfoRow[]> {
  const now = Date.now();
  if (wardCache && wardCache.expiresAt > now) return wardCache.data;

  const merged: WardInfoRow[] = Object.keys(WARD_CONFIG).map((wardCode) => {
    const cfg = WARD_CONFIG[wardCode];
    return {
      ward_code: wardCode,
      name: cfg?.label ?? wardCode,
      total_beds: cfg?.totalBeds ?? 0,
    } as WardInfoRow;
  });

  wardCache = { data: merged, expiresAt: now + 5 * 60 * 1000 };
  return merged;
}

// นับจำนวน admit ของแต่ละหน่วย โดยกรองจาก bedno (prefix / exclude) ให้ตรงตาม config
// - ไม่ส่ง range  → live (คนที่ยังไม่ d/c ณ ปัจจุบัน)
// - ส่ง range    → คนที่ยัง admit อยู่ ณ ช่วงวันที่เลือก (regdate <= end และยังไม่ d/c ก่อน start)
async function countAdmit(
  wardCode: string,
  cfg: WardConfigItem,
  range?: { start: string; end: string },
): Promise<number> {
  if (cfg.forceZero) return 0;

  const realWard = cfg.realWard ?? wardCode;

  // ── เงื่อนไข bedno (param ชุดนี้ต้องต่อท้ายสุดในลำดับ ?) ──
  const bednoConditions: string[] = [];
  const bednoParams: string[] = [];

  if (cfg.bednoPrefix?.length) {
    bednoConditions.push(
      `(${cfg.bednoPrefix.map(() => "ia.bedno LIKE ?").join(" OR ")})`,
    );
    cfg.bednoPrefix.forEach((p) => bednoParams.push(`${p}%`));
  }

  if (cfg.bednoPrefixExclude?.length) {
    bednoConditions.push(
      `(${cfg.bednoPrefixExclude.map(() => "ia.bedno NOT LIKE ?").join(" AND ")})`,
    );
    cfg.bednoPrefixExclude.forEach((p) => bednoParams.push(`${p}%`));
  }

  // กรอง bedno ว่างออกเสมอ
  bednoConditions.push("(ia.bedno IS NOT NULL AND ia.bedno != '')");

  // ── เงื่อนไขวันที่ vs live ──
  let dateClause: string;
  const dateParams: string[] = [];
  if (range) {
    // ยัง admit อยู่ ณ ช่วงวันที่เลือก: เข้าก่อน/ในวันสุดท้าย และยังไม่ d/c ก่อนวันแรก
    dateClause = `AND a.regdate <= ?
      AND (ip.dchdate IS NULL OR ip.dchdate = '0000-00-00' OR ip.dchdate = '' OR ip.dchdate >= ?)`;
    dateParams.push(range.end, range.start);
  } else {
    dateClause = `AND (ip.dchdate IS NULL OR ip.dchdate = '0000-00-00' OR ip.dchdate = '')
      AND (a.dchdate IS NULL OR a.dchdate = '0000-00-00' OR a.dchdate = '')`;
  }

  // ลำดับ ? ใน SQL: ward → date → bedno
  const params = [realWard, ...dateParams, ...bednoParams];

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT ia.an) AS cnt
     FROM iptadm ia
     INNER JOIN ipt ip ON ip.an = ia.an
     INNER JOIN an_stat a ON a.an = ia.an
     WHERE ia.move_in_ward_datetime = (
       SELECT MAX(ia2.move_in_ward_datetime)
       FROM iptadm ia2
       WHERE ia2.an = ia.an
     )
     AND ip.ward = ?
     ${dateClause}
     AND ${bednoConditions.join(" AND ")}`,
    params,
  );
  return Number((rows[0] as { cnt: number })?.cnt ?? 0);
}

export async function getIpdDischarge(
  start: string,
  end: string,
): Promise<IpdDischargeRow[]> {
  const wardCodes = ["01", "04", "05", "15", "17", "14", "16"];
  const placeholders = wardCodes.map(() => "?").join(",");

  const [rows] = await db.query<IpdDischargeRow[]>(
    `SELECT
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
    ORDER BY ipt.dchdate DESC, ipt.dchtime DESC`,
    [start, end, ...wardCodes],
  );
  return rows;
}

export async function getIpdSummary(
  start: string,
  end: string,
): Promise<IpdSummaryData> {
  const wardCodes = ["01", "04", "05", "15", "17", "14", "16"];
  const placeholders = wardCodes.map(() => "?").join(",");
  const wardUnion = wardCodes
    .map(() => `SELECT ? AS ward_code`)
    .join(" UNION ALL ");

  const [rawWardRows] = await db.query<IpdWardStat[]>(
    `SELECT
      w.ward_code,
      COALESCE(d.total,            0) AS total,
      COALESCE(d.unique_patients,  0) AS unique_patients,
      COALESCE(d.avg_los,          0) AS avg_los,
      COALESCE(d.discharge_normal, 0) AS discharge_normal,
      COALESCE(d.discharge_other,  0) AS discharge_other,
      COALESCE(a.admit_total,      0) AS admit_total
    FROM (${wardUnion}) w
    LEFT JOIN (
      SELECT ipt.ward AS ward_code,
        COUNT(*) AS total,
        COUNT(DISTINCT ipt.hn) AS unique_patients,
        ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los,
        SUM(ipt.dchtype = '1') AS discharge_normal,
        SUM(ipt.dchtype != '1') AS discharge_other
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
    ) a ON a.ward_code = w.ward_code`,
    [...wardCodes, start, end, ...wardCodes, start, end, ...wardCodes],
  );

  const [totalRows] = await db.query<IpdSummaryRow[]>(
    `SELECT COUNT(*) AS total,
      COUNT(DISTINCT ipt.hn) AS unique_patients,
      ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los
    FROM ipt
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})`,
    [start, end, ...wardCodes],
  );

  const [pttypeRows] = await db.query<IpdPttypeRow[]>(
    `SELECT p1.name AS pttype_name, COUNT(*) AS total
    FROM ipt
    INNER JOIN an_stat a ON a.an = ipt.an
    INNER JOIN pttype p1 ON a.pttype = p1.pttype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    GROUP BY p1.name
    ORDER BY total DESC
    LIMIT 8`,
    [start, end, ...wardCodes],
  );

  const [dchtypeRows] = await db.query<IpdDchtypeRow[]>(
    `SELECT COALESCE(dd.name, 'ไม่ระบุ') AS dchtype_name, COUNT(*) AS total
    FROM ipt
    LEFT JOIN dchtype dd ON dd.dchtype = ipt.dchtype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN (${placeholders})
    GROUP BY dd.name
    ORDER BY total DESC`,
    [start, end, ...wardCodes],
  );

  return {
    summary: totalRows[0],
    byWard: rawWardRows,
    byPttype: pttypeRows,
    byDchtype: dchtypeRows,
  };
}

export interface BedOccupancyRow {
  ward_code: string;
  label: string;
  total_beds: number;
  current_admit: number;
  occupancy_rate: number;
}

export async function getBedOccupancy(
  start?: string,
  end?: string,
): Promise<BedOccupancyRow[]> {
  const wards = await getActiveWards();
  if (wards.length === 0) return [];

  const rows: BedOccupancyRow[] = [];
  let homeWardTotal = 0;
  let homeWardAdmit = 0;

  const range = start && end ? { start, end } : undefined;

  for (const w of wards) {
    const cfg = WARD_CONFIG[w.ward_code];
    const admit = await countAdmit(w.ward_code, cfg, range);

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
