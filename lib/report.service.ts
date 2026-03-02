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
    where v.vstdate >= ?
    and v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
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
    AND o.vstdate >= ?
    AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
    ORDER BY o.vsttime ASC;
    `,
        [start, end]
    );

    return rows;
}

export async function getUcOutsideDentalReport(
    start: string,
    end: string
) {
    const [rows] = await db.query(
        `
    select 
      v.vstdate,
      v.vn,
      v.hn,
      v.pdx,
      v.aid,
      v.pttype,
      p.name as pttype_name,
      v.hospmain,
      h.name as hospmain_name,
      v.income,
      v.paid_money,
      (v.inc08+v.inc10+v.inc14+v.inc15+v.inc16+v.inc17) as sum_other,
      (v.income-v.inc11) as sum_total,
      (v.income - v.paid_money) as ss,
      op.cc,
      k.department
    from vn_stat v
    inner join ovst o on o.vn=v.vn
    left join opdscreen op on v.vn=op.vn
    left join kskdepartment k on k.depcode=o.main_dep
    left join hospcode h on v.hospmain = h.hospcode
    left join pttype p on p.pttype=v.pttype
    where v.vstdate >= ?
      and v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
      and v.pcode in ("AA","AB","AC","AD","AE","AF","AG","AH","AJ","AK","AL","UC")
      and v.income <> 0
      and h.chwpart <> "31"
      and v.hospmain <> ""
      and v.pdx BETWEEN "K000" and "K149"
    order by v.vn;
    `,
        [start, end]
    );

    return rows;
}