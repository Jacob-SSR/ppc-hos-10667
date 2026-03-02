import { db } from "@/lib/db";
import { ReportRow } from "@/types/report";

export async function getReport(
    start: string,
    end: string
): Promise<ReportRow[]> {
    const [rows] = await db.query(
        `
    select v.vn, v.hn, v.vstdate,
    pt.pname, pt.fname, pt.lname,
    v.age_y as age,
    if(v.sex='1','ชาย','หญิง') as gender,
    v.hospmain, v.hospsub,
    p.pttype , p.name as pttype_name
    from vn_stat v
    join pttype p on v.pttype = p.pttype
    join patient pt on v.hn = pt.hn
    where v.vstdate between ? and ?
    and v.hospsub in (
      '02876','02880','02890','13836','02875','02877',
      '02886','15090','77608','02878','02879','02887',
      '02893','02881','02884','02885','02889','02882'
    )
    and v.hospmain = '10667'
    and p.pttype not in ('27','84','51')
    order by v.vstdate asc;
    `,
        [start, end]
    );

    return rows as ReportRow[];
}


export async function getNoEndpointReport(
    start: string,
    end: string
) {
    const [rows] = await db.query(
        `
    SELECT 
      concat(day(o.vstdate),"/", month(o.vstdate),"/", year(o.vstdate)+543) AS DATE,
      o.vsttime,
      p.cid,
      vv.income,
      o.vn,
      o.hn,
      CONVERT(CAST(CONVERT(concat(p.pname,p.fname,"  ",p.lname) USING tis620) AS BINARY) USING tis620) as Name,
      CONVERT(CAST(CONVERT(k.department USING tis620) AS BINARY) USING tis620) as Department,
      CONVERT(CAST(CONVERT(if(s.cc is null,'',s.cc) USING tis620) AS BINARY) USING tis620) as cc,
      CONVERT(CAST(CONVERT(ptt.name USING tis620) AS BINARY) USING tis620) as pttypename
    FROM ovst o
    LEFT JOIN visit_pttype vp ON vp.vn=o.vn
    LEFT JOIN pttype ptt on ptt.pttype=vp.pttype 
    LEFT JOIN patient p on p.hn = o.hn
    LEFT JOIN kskdepartment k on k.depcode = o.main_dep
    LEFT JOIN opdscreen s on s.vn = o.vn
    LEFT JOIN vn_stat vv on vv.vn=s.vn
    WHERE vp.auth_code IS NULL 
    AND o.an IS NULL
    AND o.vstdate BETWEEN ? AND ?
    ORDER BY o.vsttime ASC;
    `,
        [start, end]
    );

    return rows;
}