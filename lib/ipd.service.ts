import { db } from "@/lib/db";

export async function getIpdDischarge(start: string, end: string) {
    const [rows] = await db.query(
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
        [start, end]
    );

    return rows as any[];
}

export async function getIpdSummary(start: string, end: string) {
    // Summary: total + per ward (discharge + admit)
    const [wardRows] = await db.query(
        `
        SELECT 
            a.ward AS ward_code,
            SUM(CASE WHEN ipt.dchdate BETWEEN ? AND ? THEN 1 ELSE 0 END) AS total,
            COUNT(DISTINCT CASE WHEN ipt.dchdate BETWEEN ? AND ? THEN ipt.hn END) AS unique_patients,
            ROUND(AVG(CASE WHEN ipt.dchdate BETWEEN ? AND ? THEN DATEDIFF(ipt.dchdate, ipt.regdate) END), 1) AS avg_los,
            SUM(CASE WHEN ipt.dchdate BETWEEN ? AND ? AND ipt.dchtype = '1' THEN 1 ELSE 0 END) AS discharge_normal,
            SUM(CASE WHEN ipt.dchdate BETWEEN ? AND ? AND ipt.dchtype != '1' THEN 1 ELSE 0 END) AS discharge_other,
            SUM(CASE WHEN a.admdate BETWEEN ? AND ? THEN 1 ELSE 0 END) AS admit_total
        FROM an_stat a
        LEFT JOIN ipt ON ipt.an = a.an
        WHERE a.ward IN ('14', '01', '15', '04')
          AND (
            ipt.dchdate BETWEEN ? AND ?
            OR a.admdate BETWEEN ? AND ?
          )
        GROUP BY a.ward
        ORDER BY admit_total DESC
        `,
        [start, end, start, end, start, end, start, end, start, end, start, end, start, end, start, end]
    );

    // Total summary
    const [totalRow]: any = await db.query(
        `
        SELECT 
            COUNT(*) AS total,
            COUNT(DISTINCT ipt.hn) AS unique_patients,
            ROUND(AVG(DATEDIFF(ipt.dchdate, ipt.regdate)), 1) AS avg_los
        FROM ipt
        WHERE ipt.dchdate BETWEEN ? AND ?
          AND ipt.ward IN ('14', '01', '15', '04')
        `,
        [start, end]
    );

    // Pttype breakdown
    const [pttypeRows] = await db.query(
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
        [start, end]
    );

    // Dchtype breakdown
    const [dchtypeRows] = await db.query(
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
        [start, end]
    );

    return {
        summary: (totalRow as any[])[0],
        byWard: wardRows as any[],
        byPttype: pttypeRows as any[],
        byDchtype: dchtypeRows as any[],
    };
}