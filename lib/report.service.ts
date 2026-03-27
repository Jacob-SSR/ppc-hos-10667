import { db } from "@/lib/db";
import { ReportRow } from "@/types/allTypes";

export async function getReport(
    start: string,
    end: string
): Promise<ReportRow[]> {
    const [rows] = await db.query(
        `
    select v.vn, v.hn, v.vstdate AS "วันที่",
    pt.pname AS "คำนำหน้า", pt.fname AS "ชื่อ", pt.lname AS "นามสกุล",
    v.age_y as "อายุ",
    if(v.sex='1','ชาย','หญิง') as "เพศ",
    v.hospmain AS "รหัสโรงพยาบาลหลัก", v.hospsub AS "รหัสโรงพยาบาลรอง",
    p.pttype AS "รหัสสิทธิ์", p.name as "ชื่อสิทธิ์"
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
    AND p.hipdata_code IN ('UCS','WEL')
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
      concat(day(o.vstdate),"/", month(o.vstdate),"/", year(o.vstdate)+543) AS "วันที่",
      o.vsttime AS "เวลา",
      p.cid,
      vv.income AS "มูลค่า",
      o.vn,
      o.hn,
      CONVERT(CAST(CONVERT(concat(p.pname,p.fname,"  ",p.lname) USING tis620) AS BINARY) USING tis620) as "ชื่อ",
      CONVERT(CAST(CONVERT(k.department USING tis620) AS BINARY) USING tis620) as "แผนก",
      CONVERT(CAST(CONVERT(if(s.cc is null,'',s.cc) USING tis620) AS BINARY) USING tis620) as "อาการสำคัญ",
      CONVERT(CAST(CONVERT(ptt.name USING tis620) AS BINARY) USING tis620) as "ชื่อสิทธิ์"
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
      v.vstdate AS "วันที่",
      v.vn,
      v.hn,
      v.pdx AS "การวินิจฉัย",
      v.aid AS "รหัสที่อยู่",
      v.pttype AS "รหัสสิทธิ์",
      p.name as "ชื่อสิทธิ์",
      v.hospmain AS "รหัสโรงพยาบาลหลัก",
      h.name as "ชื่อโรงพยาบาลหลัก",
      v.income AS "มูลค่า",
      v.paid_money AS "เงินที่จ่าย",
      (v.inc08+v.inc10+v.inc14+v.inc15+v.inc16+v.inc17) as "รวมอื่นๆ",
      (v.income-v.inc11) as "รวมทั้งหมด",
      (v.income - v.paid_money) as "ส่วนต่าง",
      op.cc AS "อาการสำคัญ",
      k.department AS "แผนก"
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

export async function getUcOutsideReport(
    start: string,
    end: string
) {
    const [rows] = await db.query(
        `
    SELECT 
        v.vn, 
        v.hn, 
        v.vstdate AS "วันที่", 
        ov.vsttime AS "เวลา",
        ks.department AS "แผนก",
        pt.pname AS "คำนำหน้า", 
        pt.fname AS "ชื่อ", 
        pt.lname AS "นามสกุล", 
        pt.hometel AS "เบอร์โทร",
        v.age_y AS "อายุ",
        IF(v.sex='1','ชาย','หญิง') AS "เพศ", 
        v.hospmain AS "รหัสโรงพยาบาลหลัก", 
        h1.name AS "ชื่อโรงพยาบาลหลัก", 
        th.name AS "จังหวัด",
        p.pttype AS "รหัสสิทธิ์", 
        p.name AS "ชื่อสิทธิ์",
        v.income AS "มูลค่า",
        p.hipdata_code AS "รหัสสิทธิ์หลัก"
    FROM vn_stat v
    JOIN ovst ov ON v.vn = ov.vn
    JOIN kskdepartment ks ON ov.main_dep = ks.depcode
    JOIN pttype p ON v.pttype = p.pttype
    JOIN patient pt ON v.hn = pt.hn
    LEFT JOIN hospcode h1 ON v.hospmain = h1.hospcode
    LEFT JOIN hospcode h2 ON v.hospsub = h2.hospcode
    LEFT JOIN thaiaddress th ON th.chwpart = h1.chwpart 
                             AND th.codetype = '1' 
    WHERE v.vstdate >= ?
      AND v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
      AND h1.chwpart NOT IN ('31')
      AND h1.hospital_type_id IN ('5','6','7')
      AND (v.hospsub IS NOT NULL AND v.hospsub <> '')
      AND v.income > 0
      AND p.hipdata_code IN ('UCS','WEL')
    ORDER BY v.vstdate DESC;
    `,
        [start, end]
    );

    return rows;
}

export async function getServiceUnitReport(
    start: string,
    end: string
) {
    const [rows] = await db.query(
        `
    SELECT 
      CONCAT(pt.pname, pt.fname, " ", pt.lname) AS "ชื่อ-นามสกุล",
      pt.hn,
      pt.cid,
      pt.hometel AS "เบอร์โทร",
      pt.informtel AS "เบอร์ผู้แจ้ง",
      pt.addrpart AS "บ้านเลขที่",
      pt.moopart AS "หมู่",
      t.full_name AS "ที่อยู่",
      v.vstdate AS "วันที่รับบริการ",
      pc.name AS "ชื่อสิทธิ์",
      h.name AS "ชื่อโรงพยาบาลหลัก",
      v.hospmain AS "รหัสโรงพยาบาลหลัก",
      v.pttype AS "รหัสสิทธิ์",

      CASE
        WHEN v.aid = "311501" AND pt.moopart NOT IN ("4","04","8","08","11","13","15","17")
          THEN "รพสตจันดุม"
        WHEN v.aid = "311501" AND pt.moopart IN ("4","04","8","08","11","13","15","17")
          THEN "รพสตโคกเจริญ"

        WHEN v.aid = "311502" AND pt.moopart NOT IN ("01","1","2","02","4","04","5","05","9","09","12","13")
          THEN "รพสตตาพระ"
        WHEN v.aid = "311502" AND pt.moopart IN ("01","1","2","02","4","04","5","05","9","09","12","13")
          THEN "รพสตโคกขมิ้น"

        WHEN v.aid = "311503"
          THEN "รพสตป่าชัน"

        WHEN v.aid = "311504"
          THEN "PCUสะเดา"

        ELSE "รพสตสำโรง"
      END AS "หน่วยบริการ"

    FROM vn_stat v
    LEFT JOIN pttype p ON p.pttype = v.pttype
    LEFT JOIN pcode pc ON pc.code = p.pcode
    LEFT JOIN patient pt ON pt.hn = v.hn
    LEFT JOIN thaiaddress t ON t.addressid = v.aid
    LEFT JOIN hospcode h ON h.hospcode = v.hospmain

    WHERE v.vstdate >= ?
    AND v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)

    AND pc.code IN ("UC","AA","AB","AC","AD","AE","AF","AG","AI","AJ","AK")
    AND p.pttype <> "64"
    AND v.aid IN ("311501","311502","311503","311504","311505")
    AND v.hospmain <> "10909"

    GROUP BY v.hn
    ORDER BY "หน่วยบริการ", v.aid, pt.moopart, v.vstdate
    `,
        [start, end]
    );

    return rows;
}