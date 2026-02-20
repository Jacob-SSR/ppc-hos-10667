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
