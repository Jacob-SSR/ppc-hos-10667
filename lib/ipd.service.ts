import { db } from "@/lib/db";
import { IpdDischargeRow, IpdWardStat, IpdPttypeRow, IpdDchtypeRow, IpdSummaryData } from "@/types/allTypes";

interface IpdSummaryRow {
    total: number;
    unique_patients: number;
    avg_los: number;
}

export async function getIpdDischarge(start: string, end: string): Promise<IpdDischargeRow[]> {
    const [rows] = await db.query<IpdDischargeRow[]>(
        `
    SELECT 
        dd.name AS dchtype_name,
        ipt.hn,
        pa.cid,
        ipt.an,
        pa.informtel,
        pa.pname,
        pa.fname,
        pa.lname,
        ipt.regdate,
        ipt.regtime,
        ipt.dchdate,
        ipt.dchtime,
        ipt.rw AS ward_code,
        d.name AS doctor_name,
        ipt.adjrw,
        a.admdate,
        a.admit_hour,
        a.pdx,
        a.pttype,
        p1.name AS pttype_name,
        CONCAT(pa.addrpart, ' หมู่บ้าน', pa.moopart, ' ', t.full_name) AS address,
        DATEDIFF(ipt.dchdate, ipt.regdate) AS los
    FROM ipt
    INNER JOIN patient pa ON pa.hn = ipt.hn
    INNER JOIN an_stat a ON a.an = ipt.an
    INNER JOIN thaiaddress t ON t.addressid = a.aid
    LEFT JOIN doctor d ON d.code = ipt.dch_doctor
    INNER JOIN pttype p1 ON a.pttype = p1.pttype
    LEFT OUTER JOIN dchtype dd ON dd.dchtype = ipt.dchtype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN ('14', '01', '15', '04')
    ORDER BY ipt.dchdate DESC, ipt.dchtime DESC
    `,
        [start, end],
    );

    return rows;
}

export async function getIpdSummary(start: string, end: string): Promise<IpdSummaryData> {
    const [wardRows] = await db.query<IpdWardStat[]>(
        `
    SELECT 
        w.ward_code,
        COALESCE(d.total, 0)            AS total,
        COALESCE(d.unique_patients, 0)  AS unique_patients,
        COALESCE(d.avg_los, 0)          AS avg_los,
        COALESCE(d.discharge_normal, 0) AS discharge_normal,
        COALESCE(d.discharge_other, 0)  AS discharge_other,
        COALESCE(a.admit_total, 0)      AS admit_total
    FROM (
        SELECT '01' AS ward_code UNION ALL
        SELECT '04' UNION ALL
        SELECT '14' UNION ALL
        SELECT '15'
    ) w
    LEFT JOIN (
        SELECT 
            a.ward                          AS ward_code,
            COUNT(*)                        AS total,
            COUNT(DISTINCT ipt.hn)          AS unique_patients,
            ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los,
            SUM(ipt.dchtype = '1')          AS discharge_normal,
            SUM(ipt.dchtype != '1')         AS discharge_other
        FROM ipt
        INNER JOIN an_stat a ON a.an = ipt.an
        WHERE ipt.dchdate BETWEEN ? AND ?
          AND a.ward IN ('01','04','14','15')
        GROUP BY a.ward
    ) d ON d.ward_code = w.ward_code
    LEFT JOIN (
        SELECT 
            ward                AS ward_code,
            COUNT(*)            AS admit_total
        FROM an_stat
        WHERE regdate BETWEEN ? AND ?
          AND ward IN ('01','04','14','15')
        GROUP BY ward
    ) a ON a.ward_code = w.ward_code
    ORDER BY COALESCE(a.admit_total, 0) DESC
    `,
        [start, end, start, end],
    );

    const [totalRows] = await db.query<IpdSummaryRow[]>(
        `
    SELECT 
        COUNT(*) AS total,
        COUNT(DISTINCT ipt.hn) AS unique_patients,
        ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los
    FROM ipt
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN ('14', '01', '15', '04')
    `,
        [start, end],
    );

    const [pttypeRows] = await db.query<IpdPttypeRow[]>(
        `
    SELECT 
        p1.name AS pttype_name,
        COUNT(*) AS total
    FROM ipt
    INNER JOIN an_stat a ON a.an = ipt.an
    INNER JOIN pttype p1 ON a.pttype = p1.pttype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN ('14', '01', '15', '04')
    GROUP BY p1.name
    ORDER BY total DESC
    LIMIT 8
    `,
        [start, end],
    );

    const [dchtypeRows] = await db.query<IpdDchtypeRow[]>(
        `
    SELECT 
        COALESCE(dd.name, 'ไม่ระบุ') AS dchtype_name,
        COUNT(*) AS total
    FROM ipt
    LEFT JOIN dchtype dd ON dd.dchtype = ipt.dchtype
    WHERE ipt.dchdate BETWEEN ? AND ?
      AND ipt.ward IN ('14', '01', '15', '04')
    GROUP BY dd.name
    ORDER BY total DESC
    `,
        [start, end],
    );

    return {
        summary: totalRows[0],
        byWard: wardRows,
        byPttype: pttypeRows,
        byDchtype: dchtypeRows,
    };
}