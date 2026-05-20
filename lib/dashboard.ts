import { db } from "@/lib/db";
import { MonthlyDashboardRow } from "@/types/allTypes";
import { RowDataPacket } from "mysql2";

interface SummaryQueryRow extends RowDataPacket {
  totalVisit: string | number;
  totalPatient: string | number;
  totalMale: string | number;
  totalFemale: string | number;
  opdOnTime: string | number;
  opdOnTimeMale: string | number;
  opdOnTimeFemale: string | number;
  opdOffTime: string | number;
  opdOffTimeMale: string | number;
  opdOffTimeFemale: string | number;
  admitToday: string | number;
  admitMale: string | number;
  admitFemale: string | number;
  opdUc: string | number;
  opdUcMale: string | number;
  opdUcFemale: string | number;
  opdGov: string | number;
  opdGovMale: string | number;
  opdGovFemale: string | number;
  opdSso: string | number;
  opdSsoMale: string | number;
  opdSsoFemale: string | number;
  opdCash: string | number;
  opdCashMale: string | number;
  opdCashFemale: string | number;
  opdForeign: string | number;
  opdForeignMale: string | number;
  opdForeignFemale: string | number;
  referIn: string | number;
  referInMale: string | number;
  referInFemale: string | number;
  referOut: string | number;
  referOutMale: string | number;
  referOutFemale: string | number;
  erEmergency: string | number;
  erEmergencyMale: string | number;
  erEmergencyFemale: string | number;
  erTransport: string | number;
  erTransportMale: string | number;
  erTransportFemale: string | number;
  erOtherAccident: string | number;
  erOtherAccidentMale: string | number;
  erOtherAccidentFemale: string | number;
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
      /* ── ผู้รับบริการทั้งหมด OPD ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalVisit,
      (SELECT COUNT(DISTINCT v.hn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalPatient,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND pt.sex='1') AS totalMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND pt.sex='2') AS totalFemale,

      /* ── OPD ในเวลา ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.vsttime BETWEEN '08:30:00' AND '16:30:59' AND o.an IS NULL) AS opdOnTime,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.vsttime BETWEEN '08:30:00' AND '16:30:59' AND o.an IS NULL AND pt.sex='1') AS opdOnTimeMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.vsttime BETWEEN '08:30:00' AND '16:30:59' AND o.an IS NULL AND pt.sex='2') AS opdOnTimeFemale,

      /* ── OPD นอกเวลา ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND (o.vsttime<'08:30:00' OR o.vsttime>'16:30:59') AND o.an IS NULL) AS opdOffTime,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND (o.vsttime<'08:30:00' OR o.vsttime>'16:30:59') AND o.an IS NULL AND pt.sex='1') AS opdOffTimeMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND (o.vsttime<'08:30:00' OR o.vsttime>'16:30:59') AND o.an IS NULL AND pt.sex='2') AS opdOffTimeFemale,

      /* ── Admit ── */
      (SELECT COUNT(*) FROM an_stat a WHERE a.regdate BETWEEN ? AND ?) AS admitToday,
      (SELECT COUNT(*) FROM an_stat a INNER JOIN patient pt ON pt.hn=a.hn
       WHERE a.regdate BETWEEN ? AND ? AND pt.sex='1') AS admitMale,
      (SELECT COUNT(*) FROM an_stat a INNER JOIN patient pt ON pt.hn=a.hn
       WHERE a.regdate BETWEEN ? AND ? AND pt.sex='2') AS admitFemale,

      /* ── UC ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL
         AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK')) AS opdUc,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL
         AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK') AND pt.sex='1') AS opdUcMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL
         AND v.pcode IN ('UC','AA','AB','AC','AD','AE','AF','AG','AJ','AK') AND pt.sex='2') AS opdUcFemale,

      /* ── ราชการ ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A2') AS opdGov,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A2' AND pt.sex='1') AS opdGovMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A2' AND pt.sex='2') AS opdGovFemale,

      /* ── ประกันสังคม ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A7') AS opdSso,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A7' AND pt.sex='1') AS opdSsoMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='A7' AND pt.sex='2') AS opdSsoFemale,

      /* ── ชำระเงินเอง ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode IN ('A1','A9')) AS opdCash,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode IN ('A1','A9') AND pt.sex='1') AS opdCashMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode IN ('A1','A9') AND pt.sex='2') AS opdCashFemale,

      /* ── แรงงานต่างด้าว ── */
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='AL') AS opdForeign,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='AL' AND pt.sex='1') AS opdForeignMale,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL AND v.pcode='AL' AND pt.sex='2') AS opdForeignFemale,

      /* ── Refer In ── */
      (SELECT COUNT(DISTINCT o.vn) FROM referin r INNER JOIN ovst o ON o.vn=r.vn
       WHERE o.vstdate BETWEEN ? AND ?) AS referIn,
      (SELECT COUNT(DISTINCT o.vn) FROM referin r INNER JOIN ovst o ON o.vn=r.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE o.vstdate BETWEEN ? AND ? AND pt.sex='1') AS referInMale,
      (SELECT COUNT(DISTINCT o.vn) FROM referin r INNER JOIN ovst o ON o.vn=r.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE o.vstdate BETWEEN ? AND ? AND pt.sex='2') AS referInFemale,

      /* ── Refer Out ── */
      (SELECT COUNT(DISTINCT o.vn) FROM referout r INNER JOIN ovst o ON o.vn=r.vn
       WHERE o.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS referOut,
      (SELECT COUNT(DISTINCT o.vn) FROM referout r INNER JOIN ovst o ON o.vn=r.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE o.vstdate BETWEEN ? AND ? AND o.an IS NULL AND pt.sex='1') AS referOutMale,
      (SELECT COUNT(DISTINCT o.vn) FROM referout r INNER JOIN ovst o ON o.vn=r.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE o.vstdate BETWEEN ? AND ? AND o.an IS NULL AND pt.sex='2') AS referOutFemale,

      /* ── ER ทั้งหมด ── */
      (SELECT COUNT(*) FROM er_regist er WHERE er.vstdate BETWEEN ? AND ?) AS erEmergency,
      (SELECT COUNT(*) FROM er_regist er INNER JOIN ovst o ON o.vn=er.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE er.vstdate BETWEEN ? AND ? AND pt.sex='1') AS erEmergencyMale,
      (SELECT COUNT(*) FROM er_regist er INNER JOIN ovst o ON o.vn=er.vn
       INNER JOIN patient pt ON pt.hn=o.hn
       WHERE er.vstdate BETWEEN ? AND ? AND pt.sex='2') AS erEmergencyFemale,

      /* ── อุบัติเหตุการขนส่ง ── */
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn
       WHERE v.vstdate BETWEEN ? AND ? AND ed.er_accident_type_id='1') AS erTransport,
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND ed.er_accident_type_id='1' AND pt.sex='1') AS erTransportMale,
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ? AND ed.er_accident_type_id='1' AND pt.sex='2') AS erTransportFemale,

      /* ── อุบัติเหตุอื่นๆ ── */
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn
       WHERE v.vstdate BETWEEN ? AND ?
         AND ed.er_accident_type_id IS NOT NULL AND ed.er_accident_type_id!='1') AS erOtherAccident,
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ?
         AND ed.er_accident_type_id IS NOT NULL AND ed.er_accident_type_id!='1' AND pt.sex='1') AS erOtherAccidentMale,
      (SELECT COUNT(DISTINCT ed.vn) FROM er_nursing_detail ed
       INNER JOIN vn_stat v ON v.vn=ed.vn INNER JOIN patient pt ON pt.hn=v.hn
       WHERE v.vstdate BETWEEN ? AND ?
         AND ed.er_accident_type_id IS NOT NULL AND ed.er_accident_type_id!='1' AND pt.sex='2') AS erOtherAccidentFemale,

      /* ── อื่นๆ ไม่แยก sex ── */
      (SELECT COUNT(*) FROM ovst o LEFT JOIN visit_pttype vp ON vp.vn=o.vn
       WHERE vp.auth_code IS NULL AND o.an IS NULL AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,
      (SELECT COUNT(*) FROM vn_stat v
       LEFT JOIN hospcode h ON v.hospmain=h.hospcode LEFT JOIN pttype p ON v.pttype=p.pttype
       WHERE v.vstdate BETWEEN ? AND ? AND h.chwpart NOT IN ('31')
         AND h.hospital_type_id IN ('5','6','7')
         AND (v.hospsub IS NOT NULL AND v.hospsub<>'')
         AND v.income>0 AND p.hipdata_code IN ('UCS','WEL')) AS ucOutside,
      (SELECT COUNT(*) FROM vn_stat v
       LEFT JOIN pttype p ON v.pttype=p.pttype LEFT JOIN hospcode h ON v.hospmain=h.hospcode
       WHERE v.vstdate BETWEEN ? AND ? AND p.hipdata_code IN ('UCS','WEL')
         AND v.income<>0 AND h.chwpart<>'31' AND v.hospmain<>''
         AND v.pdx BETWEEN 'K000' AND 'K149') AS ucOutsideDental,
      (SELECT COALESCE(SUM(v.income-v.paid_money),0)
       FROM vn_stat v WHERE v.vstdate BETWEEN ? AND ?) AS unpaidTotal
    `,
    [
      start,end, start,end, start,end, start,end,       // totalVisit, totalPatient, male, female
      start,end, start,end, start,end,                   // opdOnTime, male, female
      start,end, start,end, start,end,                   // opdOffTime, male, female
      start,end, start,end, start,end,                   // admitToday, male, female
      start,end, start,end, start,end,                   // opdUc, male, female
      start,end, start,end, start,end,                   // opdGov, male, female
      start,end, start,end, start,end,                   // opdSso, male, female
      start,end, start,end, start,end,                   // opdCash, male, female
      start,end, start,end, start,end,                   // opdForeign, male, female
      start,end, start,end, start,end,                   // referIn, male, female
      start,end, start,end, start,end,                   // referOut, male, female
      start,end, start,end, start,end,                   // erEmergency, male, female
      start,end, start,end, start,end,                   // erTransport, male, female
      start,end, start,end, start,end,                   // erOtherAccident, male, female
      start,end,                                          // noEndpoint
      start,end,                                          // ucOutside
      start,end,                                          // ucOutsideDental
      start,end,                                          // unpaidTotal
    ],
  );

  const n = (v: unknown) => Number(v ?? 0);

  return {
    summary: {
      totalVisit:            n(summary.totalVisit),
      totalPatient:          n(summary.totalPatient),
      totalMale:             n(summary.totalMale),
      totalFemale:           n(summary.totalFemale),
      opdOnTime:             n(summary.opdOnTime),
      opdOnTimeMale:         n(summary.opdOnTimeMale),
      opdOnTimeFemale:       n(summary.opdOnTimeFemale),
      opdOffTime:            n(summary.opdOffTime),
      opdOffTimeMale:        n(summary.opdOffTimeMale),
      opdOffTimeFemale:      n(summary.opdOffTimeFemale),
      admitToday:            n(summary.admitToday),
      admitMale:             n(summary.admitMale),
      admitFemale:           n(summary.admitFemale),
      opdUc:                 n(summary.opdUc),
      opdUcMale:             n(summary.opdUcMale),
      opdUcFemale:           n(summary.opdUcFemale),
      opdGov:                n(summary.opdGov),
      opdGovMale:            n(summary.opdGovMale),
      opdGovFemale:          n(summary.opdGovFemale),
      opdSso:                n(summary.opdSso),
      opdSsoMale:            n(summary.opdSsoMale),
      opdSsoFemale:          n(summary.opdSsoFemale),
      opdCash:               n(summary.opdCash),
      opdCashMale:           n(summary.opdCashMale),
      opdCashFemale:         n(summary.opdCashFemale),
      opdForeign:            n(summary.opdForeign),
      opdForeignMale:        n(summary.opdForeignMale),
      opdForeignFemale:      n(summary.opdForeignFemale),
      referIn:               n(summary.referIn),
      referInMale:           n(summary.referInMale),
      referInFemale:         n(summary.referInFemale),
      referOut:              n(summary.referOut),
      referOutMale:          n(summary.referOutMale),
      referOutFemale:        n(summary.referOutFemale),
      erEmergency:           n(summary.erEmergency),
      erEmergencyMale:       n(summary.erEmergencyMale),
      erEmergencyFemale:     n(summary.erEmergencyFemale),
      erTransport:           n(summary.erTransport),
      erTransportMale:       n(summary.erTransportMale),
      erTransportFemale:     n(summary.erTransportFemale),
      erOtherAccident:       n(summary.erOtherAccident),
      erOtherAccidentMale:   n(summary.erOtherAccidentMale),
      erOtherAccidentFemale: n(summary.erOtherAccidentFemale),
      noEndpoint:            n(summary.noEndpoint),
      ucOutside:             n(summary.ucOutside),
      ucOutsideDental:       n(summary.ucOutsideDental),
      unpaidTotal:           n(summary.unpaidTotal),
    },
  };
}

// ─── Monthly ──────────────────────────────────────────────────────────────────

const THAI_MONTHS_SHORT = [
  "","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function getMonthlyDashboardData(monthsBack = 6) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const ranges: { start: string; end: string; label: string; month: string }[] = [];

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

  const unionParts = ranges.map(() => `
    SELECT ? AS month,
      (SELECT COUNT(DISTINCT o.vn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalVisit,
      (SELECT COUNT(DISTINCT v.hn) FROM ovst o INNER JOIN vn_stat v ON o.vn=v.vn
       WHERE v.vstdate BETWEEN ? AND ? AND o.an IS NULL) AS totalPatient,
      (SELECT COUNT(*) FROM ovst o LEFT JOIN visit_pttype vp ON vp.vn=o.vn
       WHERE vp.auth_code IS NULL AND o.an IS NULL AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,
      (SELECT COUNT(*) FROM vn_stat v LEFT JOIN hospcode h ON v.hospmain=h.hospcode
       LEFT JOIN pttype p ON v.pttype=p.pttype
       WHERE v.vstdate BETWEEN ? AND ? AND h.chwpart NOT IN ('31')
         AND h.hospital_type_id IN ('5','6','7')
         AND (v.hospsub IS NOT NULL AND v.hospsub<>'')
         AND v.income>0 AND p.hipdata_code IN ('UCS','WEL')) AS ucOutside,
      (SELECT COALESCE(SUM(income-paid_money),0) FROM vn_stat
       WHERE vstdate BETWEEN ? AND ?) AS unpaidTotal
  `).join(" UNION ALL ");

  const params: (string | number)[] = [];
  for (const r of ranges) {
    params.push(r.month, r.start,r.end, r.start,r.end, r.start,r.end, r.start,r.end, r.start,r.end);
  }

  const [rows] = await db.query<MonthlyQueryRow[]>(unionParts, params);
  const rowMap: Record<string, MonthlyQueryRow> = {};
  for (const r of rows) rowMap[r.month] = r;

  const result: MonthlyDashboardRow[] = ranges.map((range, idx) => {
    const r    = rowMap[range.month];
    const prev = idx > 0 ? rowMap[ranges[idx - 1].month] : undefined;
    const totalVisit   = Number(r?.totalVisit ?? 0);
    const totalPatient = Number(r?.totalPatient ?? 0);
    const noEndpoint   = Number(r?.noEndpoint ?? 0);
    const ucOutside    = Number(r?.ucOutside ?? 0);
    const unpaidTotal  = Number(r?.unpaidTotal ?? 0);
    return {
      month: range.month, label: range.label,
      totalVisit, totalPatient, noEndpoint, ucOutside, unpaidTotal,
      visitChange:      prev ? pct(totalVisit,   Number(prev.totalVisit ?? 0))   : null,
      patientChange:    prev ? pct(totalPatient,  Number(prev.totalPatient ?? 0)) : null,
      noEndpointChange: prev ? pct(noEndpoint,    Number(prev.noEndpoint ?? 0))   : null,
      ucOutsideChange:  prev ? pct(ucOutside,     Number(prev.ucOutside ?? 0))    : null,
    };
  });

  return { months: result };
}