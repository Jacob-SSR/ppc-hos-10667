import { db } from "@/lib/db";

export async function getDashboardData(start: string, end: string) {
    const [[summary]]: any = await db.query(
        `
    SELECT
      (SELECT COUNT(*) 
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?) as totalVisit,

      (SELECT COUNT(*)
       FROM ovst o
       LEFT JOIN visit_pttype vp ON vp.vn=o.vn
       WHERE vp.auth_code IS NULL 
       AND o.an IS NULL
       AND o.vstdate BETWEEN ? AND ?) as noEndpoint,

      (SELECT COUNT(*)
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?
       AND v.pdx BETWEEN "K000" AND "K149") as ucOutside,

      (SELECT SUM(v.income - v.paid_money)
       FROM vn_stat v
       WHERE v.vstdate BETWEEN ? AND ?) as unpaidTotal
    `,
        [start, end, start, end, start, end, start, end]
    );

    const [daily]: any = await db.query(
        `
    SELECT 
      v.vstdate as date,
      COUNT(*) as total
    FROM vn_stat v
    WHERE v.vstdate BETWEEN ? AND ?
    GROUP BY v.vstdate
    ORDER BY v.vstdate
    `,
        [start, end]
    );

    return { summary, daily };
}