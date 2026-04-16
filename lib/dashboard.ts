import { db } from "@/lib/db";
import { MonthlyDashboardRow } from "@/types/allTypes";
import { RowDataPacket } from "mysql2";

interface SummaryQueryRow extends RowDataPacket {
  totalVisit: string | number;
  totalPatient: string | number;
  opdOnTime: string | number;
  opdOffTime: string | number;
  admitToday: string | number;
  opdUc: string | number;
  opdGov: string | number;
  opdSso: string | number;
  opdCash: string | number;
  opdForeign: string | number;
  referIn: string | number;
  referOut: string | number;
  erEmergency: string | number; // การ์ดที่ 12
  erAccident: string | number; // การ์ดที่ 13
  noEndpoint: string | number;
  ucOutside: string | number;
  ucOutsideDental: string | number;
  unpaidTotal: string | number;
}

interface MonthlyQueryRow extends RowDataPacket {
  month: string;
  totalVisit: string | number;
  totalPatient: string | number;
  noEndpoint: string | number;
  ucOutside: string | number;
  unpaidTotal: string | number;
}

export async function getDashboardData(start: string, end: string) {
  const [[summary]] = await db.query<SummaryQueryRow[]>(
    `
    SELECT
      /* ผู้รับบริการทั้งหมด (OPD เท่านั้น — an IS NULL) */
      (SELECT COUNT(DISTINCT o.vn)
       FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL) AS totalVisit,
      (SELECT COUNT(DISTINCT v.hn)
       FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL) AS totalPatient,

      /* OPD ในเวลา 08:30–16:30 */
      (SELECT COUNT(DISTINCT o.vn)
       FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.vsttime BETWEEN '08:30:00' AND '16:30:59'
         AND o.an IS NULL) AS opdOnTime,

      /* OPD นอกเวลา */
      (SELECT COUNT(DISTINCT o.vn)
       FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND (o.vsttime < '08:30:00' OR o.vsttime > '16:30:59')
         AND o.an IS NULL) AS opdOffTime,

      /* Admit วันนี้ */
      (SELECT COUNT(*) FROM an_stat a WHERE a.regdate BETWEEN ? AND ?) AS admitToday,

      /* บัตรทอง UC */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL
         AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK')) AS opdUc,

      /* ราชการ */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL
         AND v.pcode = 'A2') AS opdGov,

      /* ประกันสังคม */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL
         AND v.pcode = 'A7') AS opdSso,

      /* ชำระเงินเอง */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL
         AND v.pcode IN ('A1','A9')) AS opdCash,

      /* แรงงานต่างด้าว */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o
       INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND o.an IS NULL
         AND v.pcode = 'AL') AS opdForeign,

      /* Refer In */
      (SELECT COUNT(*) FROM ovst o
       WHERE o.vstdate BETWEEN ? AND ?
         AND o.rfrics IS NOT NULL
         AND o.rfrics != ''
         AND o.an IS NULL) AS referIn,

      /* Refer Out */
      (SELECT COUNT(*) FROM ovst o
       WHERE o.vstdate BETWEEN ? AND ?
         AND o.rfrocs IS NOT NULL
         AND o.rfrocs != ''
         AND o.an IS NULL) AS referOut,

      /* ER ฉุกเฉิน (er_pt_type = 1) */
      (SELECT COUNT(*)
       FROM er_regist er
       WHERE er.vstdate BETWEEN ? AND ?
         AND er.er_pt_type = 1) AS erEmergency,

      /* อุบัติเหตุ (er_pt_type = 2) */
      (SELECT COUNT(*)
       FROM er_regist er
       WHERE er.vstdate BETWEEN ? AND ?
         AND er.er_pt_type = 2) AS erAccident,

      /* ไม่มี Endpoint */
      (SELECT COUNT(*)
       FROM ovst o
       LEFT JOIN visit_pttype vp ON vp.vn = o.vn
       WHERE vp.auth_code IS NULL
         AND o.an IS NULL
         AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,

      /* UC ต่างจังหวัด */
      (SELECT COUNT(*)
       FROM vn_stat v
       LEFT JOIN hospcode h ON v.hospmain = h.hospcode
       LEFT JOIN pttype p ON v.pttype = p.pttype
       WHERE v.vstdate BETWEEN ? AND ?
         AND h.chwpart NOT IN ('31')
         AND h.hospital_type_id IN ('5','6','7')
         AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
         AND v.income > 0
         AND p.hipdata_code IN ('UCS','WEL')) AS ucOutside,

      /* UC ต่างจังหวัดทำฟัน */
      (SELECT COUNT(*)
       FROM vn_stat v
       LEFT JOIN pttype p ON v.pttype = p.pttype
       LEFT JOIN hospcode h ON v.hospmain = h.hospcode
       WHERE v.vstdate BETWEEN ? AND ?
         AND p.hipdata_code IN ('UCS','WEL')
         AND v.income <> 0
         AND h.chwpart <> '31'
         AND v.hospmain <> ''
         AND v.pdx BETWEEN 'K000' AND 'K149') AS ucOutsideDental,

      /* ส่วนต่างที่ยังไม่ได้รับ */
      (SELECT COALESCE(SUM(v.income - v.paid_money), 0)
       FROM vn_stat v WHERE v.vstdate BETWEEN ? AND ?) AS unpaidTotal
    `,
    [
      start,
      end, // totalVisit
      start,
      end, // totalPatient
      start,
      end, // opdOnTime
      start,
      end, // opdOffTime
      start,
      end, // admitToday
      start,
      end, // opdUc
      start,
      end, // opdGov
      start,
      end, // opdSso
      start,
      end, // opdCash
      start,
      end, // opdForeign
      start,
      end, // referIn
      start,
      end, // referOut
      start,
      end, // erEmergency
      start,
      end, // erAccident
      start,
      end, // noEndpoint
      start,
      end, // ucOutside
      start,
      end, // ucOutsideDental
      start,
      end, // unpaidTotal
    ],
  );

  return {
    summary: {
      totalVisit: Number(summary.totalVisit ?? 0),
      totalPatient: Number(summary.totalPatient ?? 0),
      opdOnTime: Number(summary.opdOnTime ?? 0),
      opdOffTime: Number(summary.opdOffTime ?? 0),
      admitToday: Number(summary.admitToday ?? 0),
      opdUc: Number(summary.opdUc ?? 0),
      opdGov: Number(summary.opdGov ?? 0),
      opdSso: Number(summary.opdSso ?? 0),
      opdCash: Number(summary.opdCash ?? 0),
      opdForeign: Number(summary.opdForeign ?? 0),
      referIn: Number(summary.referIn ?? 0),
      referOut: Number(summary.referOut ?? 0),
      erEmergency: Number(summary.erEmergency ?? 0),
      erAccident: Number(summary.erAccident ?? 0),
      noEndpoint: Number(summary.noEndpoint ?? 0),
      ucOutside: Number(summary.ucOutside ?? 0),
      ucOutsideDental: Number(summary.ucOutsideDental ?? 0),
      unpaidTotal: Number(summary.unpaidTotal ?? 0),
    },
  };
}

// ─── Monthly ──────────────────────────────────────────────────────────────────

const THAI_MONTHS_SHORT = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function getMonthlyDashboardData(monthsBack = 6) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  const ranges: { start: string; end: string; label: string; month: string }[] =
    [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    ranges.push({
      month: `${y}-${mm}`,
      label: `${THAI_MONTHS_SHORT[m]} ${String(y + 543).slice(2)}`,
      start: `${y}-${mm}-01`,
      end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
    });
  }

  const unionParts = ranges
    .map(
      () => `
    SELECT
      ? AS month,
      (SELECT COUNT(DISTINCT o.vn)
       FROM ovst o INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalVisit,
      (SELECT COUNT(DISTINCT v.hn)
       FROM ovst o INNER JOIN vn_stat v ON o.vn = v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalPatient,
      (SELECT COUNT(*) FROM ovst o LEFT JOIN visit_pttype vp ON vp.vn = o.vn
       WHERE vp.auth_code IS NULL AND o.an IS NULL AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,
      (SELECT COUNT(*) FROM vn_stat v
       LEFT JOIN hospcode h ON v.hospmain = h.hospcode
       LEFT JOIN pttype p ON v.pttype = p.pttype
       WHERE v.vstdate BETWEEN ? AND ?
         AND h.chwpart NOT IN ('31') AND h.hospital_type_id IN ('5','6','7')
         AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
         AND v.income > 0 AND p.hipdata_code IN ('UCS','WEL')) AS ucOutside,
      (SELECT COALESCE(SUM(income - paid_money), 0) FROM vn_stat
       WHERE vstdate BETWEEN ? AND ?) AS unpaidTotal
  `,
    )
    .join(" UNION ALL ");

  const params: (string | number)[] = [];
  for (const r of ranges) {
    params.push(
      r.month,
      r.start,
      r.end, // totalVisit
      r.start,
      r.end, // totalPatient
      r.start,
      r.end, // noEndpoint
      r.start,
      r.end, // ucOutside
      r.start,
      r.end, // unpaidTotal
    );
  }

  const [rows] = await db.query<MonthlyQueryRow[]>(unionParts, params);

  const rowMap: Record<string, MonthlyQueryRow> = {};
  for (const r of rows) rowMap[r.month] = r;

  const result: MonthlyDashboardRow[] = ranges.map((range, idx) => {
    const r = rowMap[range.month];
    const prev = idx > 0 ? rowMap[ranges[idx - 1].month] : undefined;

    const totalVisit = Number(r?.totalVisit ?? 0);
    const totalPatient = Number(r?.totalPatient ?? 0);
    const noEndpoint = Number(r?.noEndpoint ?? 0);
    const ucOutside = Number(r?.ucOutside ?? 0);
    const unpaidTotal = Number(r?.unpaidTotal ?? 0);

    return {
      month: range.month,
      label: range.label,
      totalVisit,
      totalPatient,
      noEndpoint,
      ucOutside,
      unpaidTotal,
      visitChange: prev ? pct(totalVisit, Number(prev.totalVisit ?? 0)) : null,
      patientChange: prev
        ? pct(totalPatient, Number(prev.totalPatient ?? 0))
        : null,
      noEndpointChange: prev
        ? pct(noEndpoint, Number(prev.noEndpoint ?? 0))
        : null,
      ucOutsideChange: prev
        ? pct(ucOutside, Number(prev.ucOutside ?? 0))
        : null,
    };
  });

  return { months: result };
}
