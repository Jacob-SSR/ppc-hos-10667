import { db } from "@/lib/db";
import { MonthlyDashboardRow } from "@/types/allTypes";
import { RowDataPacket } from "mysql2";

interface SummaryQueryRow extends RowDataPacket {
    totalVisit: string | number;
    totalPatient: string | number;
    noEndpoint: string | number;
    ucOutside: string | number;
    ucOutsideDental: string | number;
    unpaidTotal: string | number;
}

interface DailyVisitRow extends RowDataPacket {
    date: Date | string;
    totalVisit: string | number;
    totalPatient: string | number;
}

interface DailyCountRow extends RowDataPacket {
    date: Date | string;
    count: string | number;
}

interface PpaSummaryRow extends RowDataPacket {
    ppaAging: string | number;
    ppaNcd: string | number;
    ppaMch01: string | number;
    ppaMch02: string | number;
}

interface LatestNoEndpointRow extends RowDataPacket {
    date: Date | string;
    time: string;
    name: string;
    dept: string;
    pttype: string;
    income: string | number;
}

interface LatestUcOutsideRow extends RowDataPacket {
    date: Date | string;
    name: string;
    hospName: string;
    pttype: string;
    income: string | number;
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
      (SELECT COUNT(*)
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?) AS totalVisit,
      (SELECT COUNT(DISTINCT v.hn)
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?) AS totalPatient,
      (SELECT COUNT(*)
       FROM ovst o
       LEFT JOIN visit_pttype vp ON vp.vn = o.vn
       WHERE vp.auth_code IS NULL
         AND o.an IS NULL
         AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,
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
      (SELECT SUM(v.income - v.paid_money)
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?) AS unpaidTotal
    `,
        [
            start, end,
            start, end,
            start, end,
            start, end,
            start, end,
            start, end,
        ],
    );

    const [daily] = await db.query<DailyVisitRow[]>(
        `
    SELECT
        v.vstdate AS date,
        COUNT(v.vn) AS totalVisit,
        COUNT(DISTINCT v.hn) AS totalPatient
    FROM vn_stat v
    WHERE v.vstdate BETWEEN ? AND ?
    GROUP BY v.vstdate
    ORDER BY v.vstdate ASC
    `,
        [start, end],
    );

    const [noEndpointDaily] = await db.query<DailyCountRow[]>(
        `
    SELECT
        o.vstdate AS date,
        COUNT(*) AS count
    FROM ovst o
    LEFT JOIN visit_pttype vp ON vp.vn = o.vn
    WHERE vp.auth_code IS NULL
      AND o.an IS NULL
      AND o.vstdate BETWEEN ? AND ?
    GROUP BY o.vstdate
    ORDER BY o.vstdate ASC
    `,
        [start, end],
    );

    const [ucOutsideDaily] = await db.query<DailyCountRow[]>(
        `
    SELECT
        v.vstdate AS date,
        COUNT(*) AS count
    FROM vn_stat v
    LEFT JOIN hospcode h ON v.hospmain = h.hospcode
    LEFT JOIN pttype p ON v.pttype = p.pttype
    WHERE v.vstdate BETWEEN ? AND ?
      AND h.chwpart NOT IN ('31')
      AND h.hospital_type_id IN ('5','6','7')
      AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
      AND v.income > 0
      AND p.hipdata_code IN ('UCS','WEL')
    GROUP BY v.vstdate
    ORDER BY v.vstdate ASC
    `,
        [start, end],
    );

    const [ppaSummaryRows] = await db.query<PpaSummaryRow[]>(
        `
    SELECT
      (SELECT COUNT(DISTINCT o.hn)
       FROM pp_special pp
       LEFT JOIN pp_special_type t ON pp.pp_special_type_id = t.pp_special_type_id
       LEFT JOIN ovst o ON pp.vn = o.vn
       WHERE o.vstdate BETWEEN ? AND ?
         AND t.pp_special_code REGEXP '1B12[012][0-9]') AS ppaAging,
      (SELECT COUNT(DISTINCT p.person_id)
       FROM person_dmht_screen_summary ps
       INNER JOIN person p ON ps.person_id = p.person_id
       INNER JOIN person_dmht_risk_screen_head ph
         ON ps.person_dmht_screen_summary_id = ph.person_dmht_screen_summary_id
       WHERE ph.screen_date BETWEEN ? AND ?
         AND ps.status_active = 'Y') AS ppaNcd,
      (SELECT COUNT(DISTINCT pas.person_anc_id)
       FROM person_anc_service pas
       WHERE pas.anc_service_date BETWEEN ? AND ?) AS ppaMch01,
      (SELECT COUNT(DISTINCT ip.an)
       FROM ipt_pregnancy ip
       WHERE ip.labor_date BETWEEN ? AND ?) AS ppaMch02
    `,
        [start, end, start, end, start, end, start, end],
    );

    const [latestNoEndpoint] = await db.query<LatestNoEndpointRow[]>(
        `
    SELECT
        o.vstdate AS date,
        o.vsttime AS time,
        CONVERT(CAST(CONVERT(CONCAT(p.pname, p.fname, '  ', p.lname) USING tis620) AS BINARY) USING tis620) AS name,
        CONVERT(CAST(CONVERT(k.department USING tis620) AS BINARY) USING tis620) AS dept,
        CONVERT(CAST(CONVERT(ptt.name USING tis620) AS BINARY) USING tis620) AS pttype,
        vv.income AS income
    FROM ovst o
    LEFT JOIN visit_pttype vp ON vp.vn = o.vn
    LEFT JOIN pttype ptt ON ptt.pttype = vp.pttype
    LEFT JOIN patient p ON p.hn = o.hn
    LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
    LEFT JOIN vn_stat vv ON vv.vn = o.vn
    WHERE vp.auth_code IS NULL
      AND o.an IS NULL
      AND o.vstdate BETWEEN ? AND ?
    ORDER BY o.vstdate DESC, o.vsttime DESC
    LIMIT 5
    `,
        [start, end],
    );

    const [latestUcOutside] = await db.query<LatestUcOutsideRow[]>(
        `
    SELECT
        v.vstdate AS date,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS name,
        h1.name AS hospName,
        p.name AS pttype,
        v.income AS income
    FROM vn_stat v
    JOIN pttype p ON v.pttype = p.pttype
    JOIN patient pt ON v.hn = pt.hn
    LEFT JOIN hospcode h1 ON v.hospmain = h1.hospcode
    WHERE v.vstdate BETWEEN ? AND ?
      AND h1.chwpart NOT IN ('31')
      AND h1.hospital_type_id IN ('5','6','7')
      AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
      AND v.income > 0
      AND p.hipdata_code IN ('UCS','WEL')
    ORDER BY v.vstdate DESC
    LIMIT 5
    `,
        [start, end],
    );

    const toDateKey = (val: Date | string): string => {
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        return String(val).slice(0, 10);
    };

    const noEndpointMap: Record<string, number> = {};
    for (const r of noEndpointDaily) {
        noEndpointMap[toDateKey(r.date)] = Number(r.count);
    }
    const ucOutsideMap: Record<string, number> = {};
    for (const r of ucOutsideDaily) {
        ucOutsideMap[toDateKey(r.date)] = Number(r.count);
    }

    const mergedDaily = daily.map((d) => {
        const dateKey = toDateKey(d.date);
        return {
            date: dateKey,
            totalVisit: Number(d.totalVisit),
            totalPatient: Number(d.totalPatient),
            noEndpoint: noEndpointMap[dateKey] ?? 0,
            ucOutside: ucOutsideMap[dateKey] ?? 0,
        };
    });

    return {
        summary: {
            totalVisit: Number(summary.totalVisit ?? 0),
            totalPatient: Number(summary.totalPatient ?? 0),
            noEndpoint: Number(summary.noEndpoint ?? 0),
            ucOutside: Number(summary.ucOutside ?? 0),
            ucOutsideDental: Number(summary.ucOutsideDental ?? 0),
            unpaidTotal: Number(summary.unpaidTotal ?? 0),
        },
        ppa: {
            aging: Number(ppaSummaryRows[0]?.ppaAging ?? 0),
            ncd: Number(ppaSummaryRows[0]?.ppaNcd ?? 0),
            mch01: Number(ppaSummaryRows[0]?.ppaMch01 ?? 0),
            mch02: Number(ppaSummaryRows[0]?.ppaMch02 ?? 0),
        },
        daily: mergedDaily,
        latestNoEndpoint,
        latestUcOutside,
    };
}

const THAI_MONTHS_SHORT = [
    "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

interface MonthlyQueryRow {
    month: string;
    totalVisit: string | number;
    totalPatient: string | number;
    noEndpoint: string | number;
    ucOutside: string | number;
    unpaidTotal: string | number;
}

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
    SELECT
        ? AS month,
        (SELECT COUNT(*) FROM vn_stat WHERE vstdate BETWEEN ? AND ?) AS totalVisit,
        (SELECT COUNT(DISTINCT hn) FROM vn_stat WHERE vstdate BETWEEN ? AND ?) AS totalPatient,
        (SELECT COUNT(*) FROM ovst o LEFT JOIN visit_pttype vp ON vp.vn=o.vn
         WHERE vp.auth_code IS NULL AND o.an IS NULL AND o.vstdate BETWEEN ? AND ?) AS noEndpoint,
        (SELECT COUNT(*) FROM vn_stat v
         LEFT JOIN hospcode h ON v.hospmain=h.hospcode
         LEFT JOIN pttype p ON v.pttype=p.pttype
         WHERE v.vstdate BETWEEN ? AND ?
           AND h.chwpart NOT IN ('31') AND h.hospital_type_id IN ('5','6','7')
           AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
           AND v.income > 0 AND p.hipdata_code IN ('UCS','WEL')) AS ucOutside,
        (SELECT COALESCE(SUM(income - paid_money), 0) FROM vn_stat
         WHERE vstdate BETWEEN ? AND ?) AS unpaidTotal
  `).join(" UNION ALL ");

    const params: (string | number)[] = [];
    for (const r of ranges) {
        params.push(
            r.month,
            r.start, r.end,
            r.start, r.end,
            r.start, r.end,
            r.start, r.end,
            r.start, r.end,
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
            patientChange: prev ? pct(totalPatient, Number(prev.totalPatient ?? 0)) : null,
            noEndpointChange: prev ? pct(noEndpoint, Number(prev.noEndpoint ?? 0)) : null,
            ucOutsideChange: prev ? pct(ucOutside, Number(prev.ucOutside ?? 0)) : null,
        };
    });

    return { months: result };
}