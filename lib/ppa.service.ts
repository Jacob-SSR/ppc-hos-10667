import { db } from "@/lib/db";

// ── AGING ──────────────────────────────────────────────────────────────────────
export async function getPpaAging() {
    const ds = "2026-02-01";
    const de = "2026-04-30";
    const ppb = "1B122[0-39]";
    const ppf = "1B120[0-39]";

    const [rows] = await db.query(
        `
        SELECT (SELECT hospitalcode FROM opdconfig) as hospcode, LPAD(p.person_id,6,0) as PID
        ,p.cid, p.birthdate, TIMESTAMPDIFF(YEAR,p.birthdate,o.vstdate) as age
        ,GROUP_CONCAT(t.pp_special_code) as detail
        ,GROUP_CONCAT(DATE_FORMAT(o.vstdate,'%Y%m%d')) as list_date_screen
        ,MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Y' ELSE NULL END) as has_brain_screen
        ,MAX(CASE WHEN t.pp_special_code REGEXP '1B122[13]' THEN 'Y' ELSE NULL END) as has_brain_screen_and_send
        ,MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Y' ELSE NULL END) as has_fall_screen
        ,MAX(CASE WHEN t.pp_special_code REGEXP '1B120[1-3]' THEN 'Y' ELSE NULL END) as has_fall_screen_and_send
        FROM pp_special pp
        INNER JOIN pp_special_type t ON pp.pp_special_type_id = t.pp_special_type_id
        INNER JOIN ovst o ON pp.vn = o.vn
        INNER JOIN person p ON o.hn = p.patient_hn
        WHERE p.house_regist_type_id IN (1,3)
        AND TIMESTAMPDIFF(YEAR,p.birthdate,o.vstdate) >= 50
        AND o.vstdate BETWEEN ? AND ?
        AND t.pp_special_code REGEXP CONCAT(?, '|', ?)
        GROUP BY p.person_id
        `,
        [ppb, ppf, ds, de, ppf, ppb]
    );

    return rows;
}

// ── NCD01 ──────────────────────────────────────────────────────────────────────
export async function getPpaNcd01() {
    const sy = 2569;
    const ds = "2025-10-01";
    const de = "2026-04-30";

    const [rows] = await db.query(
        `
        SELECT (SELECT hospitalcode FROM opdconfig) as hospcode, tg.*
        ,fsc.screen_date as f_screen_date, fsc.body_weight as f_body_weight
        ,fsc.body_height as f_body_height, fsc.bmi as f_bmi
        ,fsc.last_bps as f_last_bps, fsc.last_bpd as f_last_bpd
        ,fsc.last_fpg as f_last_fpg, fsc.last_fgc as f_last_fgc
        ,fsc.last_fgc_no_food_limit as f_last_fgc_no_food_limit
        FROM (
            SELECT LPAD(ps.person_id,6,0) as PID, ps.cid
            ,ps.person_dm_screen_status_id, ps.person_ht_screen_status_id
            ,pn.history_dm_disease, pn.history_ht_disease
            ,ph.screen_date, ph.body_weight, ph.body_height, ph.bmi
            ,ph.last_bps, ph.last_bpd, ph.last_fpg, ph.last_fgc
            ,ph.last_fgc_no_food_limit
            ,(SELECT lph.person_dmht_risk_screen_head_id
                FROM person_dmht_screen_summary lps
                INNER JOIN person_dmht_nhso_screen lpn ON lps.person_dmht_screen_summary_id=lpn.person_dmht_screen_summary_id
                INNER JOIN person_dmht_risk_screen_head lph ON lpn.person_dmht_screen_summary_id=lph.person_dmht_screen_summary_id
                WHERE lps.bdg_year = ?
                AND lps.person_dmht_screen_summary_id = ps.person_dmht_screen_summary_id
                AND (lph.screen_date < TIMESTAMPADD(MONTH,-3,ph.screen_date)
                    AND (TIMESTAMPADD(MONTH,-3,ph.screen_date) BETWEEN CONCAT(?-544,'-10-01') AND ?))
            ) as f_screen_id
            FROM person_dmht_screen_summary ps
            INNER JOIN person_dmht_nhso_screen pn ON ps.person_dmht_screen_summary_id=pn.person_dmht_screen_summary_id
            INNER JOIN person_dmht_risk_screen_head ph ON pn.person_dmht_screen_summary_id=ph.person_dmht_screen_summary_id
            WHERE ps.bdg_year = ? AND ph.screen_date BETWEEN ? AND ?
        ) as tg
        LEFT JOIN (
            SELECT fph.person_dmht_risk_screen_head_id
            ,fps.person_dm_screen_status_id, fps.person_ht_screen_status_id
            ,fpn.history_dm_disease, fpn.history_ht_disease
            ,fph.screen_date, fph.body_weight, fph.body_height, fph.bmi
            ,fph.last_bps, fph.last_bpd, fph.last_fpg, fph.last_fgc, fph.last_fgc_no_food_limit
            FROM person_dmht_screen_summary fps
            INNER JOIN person_dmht_nhso_screen fpn ON fps.person_dmht_screen_summary_id=fpn.person_dmht_screen_summary_id
            INNER JOIN person_dmht_risk_screen_head fph ON fpn.person_dmht_screen_summary_id=fph.person_dmht_screen_summary_id
            WHERE fps.bdg_year = ?
        ) as fsc ON tg.f_screen_id = fsc.person_dmht_risk_screen_head_id
        `,
        [sy, sy, de, sy, ds, de, sy]
    );

    return rows;
}

// ── NCD02 ──────────────────────────────────────────────────────────────────────
export async function getPpaNcd02() {
    const dx = "R73|R030";
    const ds = "2026-02-01";
    const de = "2026-04-30";

    const [rows] = await db.query(
        `
        SELECT (SELECT hospitalcode FROM opdconfig) as hospcode
        ,IF(p.person_id is not null, LPAD(p.person_id,6,0), pt.hn) as PID
        ,pt.cid, tg.vn, tg.vstdate, tg.icd10, d.licenseno
        ,os.bps, os.bpd, os.bw, os.height, os.bmi
        FROM (
            SELECT vn, hn, vstdate, icd10, doctor
            FROM ovstdiag
            WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
        ) as tg
        INNER JOIN opdscreen os ON tg.vn = os.vn
        INNER JOIN patient pt ON tg.hn = pt.hn
        LEFT JOIN doctor d ON tg.doctor = d.code
        LEFT JOIN person p ON tg.hn = p.patient_hn
        `,
        [ds, de, dx]
    );

    return rows;
}

// ── MCH01 ──────────────────────────────────────────────────────────────────────
export async function getPpaMch01() {
    const ds = "2026-02-01";
    const de = "2026-04-30";
    const df = "2025-05-01"; // TIMESTAMPADD(MONTH,-9,'2026-02-01')
    const dx1 = "Z352|O262";
    const dx2 = "O30|Z35[56]|O341|O1[0-6]|O26[01]";
    const dx3 = "D50|E1[0-4]|N[0-3]|I|Z72[012]|R030|O24|B2[0-4]|D56|E0[0-7]|J45|F|K|M32|Z353|G14|D69";
    const dxAll = `${dx1}|${dx2}|${dx3}`;

    const [rows] = await db.query(
        `
        SELECT tg.hospcode, tg.PID, tg.cid, tg.preg_no, tg.lmp, tg.lmp_from_us
        ,tg.edc, tg.anc_register_date, tg.labor_date
        ,MAX(tg.r1) as r1, MAX(tg.r2) as r2, MAX(tg.r3) as r3, MAX(tg.rall) as rall
        ,IF(MAX(tg.rall) = 'R','Y',NULL) as has_risk
        ,COUNT(DISTINCT tg.vn) as total_care
        ,GROUP_CONCAT(DATE_FORMAT(tg.anc_service_date,"%Y%m%d")) as date_care
        FROM (
            SELECT (SELECT hospitalcode FROM opdconfig) as hospcode
            ,IF(p.person_id is not null, LPAD(p.person_id,6,0), o.hn) as PID
            ,pas.person_anc_id, pa.anc_register_date, pa.labor_date, pas.vn
            ,q.seq_id as seq, pas.anc_service_date, pa.preg_no
            ,pas.anc_service_number, pas.pa_week, pas.service_result
            ,IF(p.person_id is not null, p.cid, pt.cid) as cid
            ,os.bw, os.height, os.bmi, pa.lmp, pa.lmp_from_us, pa.edc
            ,IF(od.icd10 REGEXP ?, 'R1', NULL) as r1
            ,IF(od.icd10 REGEXP ?, 'R2', NULL) as r2
            ,IF(od.icd10 REGEXP ?, 'R3', NULL) as r3
            ,IF(od.icd10 REGEXP ?, 'R', NULL) as rall
            FROM person_anc_service pas
            INNER JOIN person_anc pa ON pas.person_anc_id = pa.person_anc_id
            INNER JOIN person p ON pa.person_id = p.person_id
            LEFT JOIN opdscreen os ON pas.vn = os.vn
            INNER JOIN ovst o ON pas.vn = o.vn
            INNER JOIN patient pt ON o.hn = pt.hn
            LEFT JOIN ovst_seq q ON pas.vn = q.vn
            LEFT JOIN ovstdiag od ON pas.vn = od.vn AND od.icd10 REGEXP ?
            WHERE pas.anc_service_date BETWEEN ? AND ?
            GROUP BY pas.person_anc_id, pas.vn
            ORDER BY pa.person_id, pas.person_anc_id, pas.anc_service_number
        ) as tg
        GROUP BY tg.person_anc_id
        `,
        [dx1, dx2, dx3, dxAll, dxAll, df, de]
    );

    return rows;
}

// ── MCH02 ──────────────────────────────────────────────────────────────────────
export async function getPpaMch02() {
    const ds = "2026-02-01";
    const de = "2026-04-30";

    const [rows] = await db.query(
        `
        SELECT (SELECT hospitalcode FROM opdconfig) as hospcode
        ,IF(pc.person_id is not null, LPAD(pc.person_id,6,0), ili.hn) as PID
        ,IF(pc.person_id is not null, pc.cid, ptc.cid) as CID
        ,IF(pm.person_id is not null, LPAD(pm.person_id,6,0), i.hn) as MPID
        ,IF(pm.person_id is not null, pm.cid, ptm.cid) as MCID
        ,il.lmp, il.lmp_from_us, il.edc
        ,il.ga as GRAVIDA, TIMESTAMPDIFF(WEEK,il.lmp,ip.labor_date) as GA
        ,ip.labor_date as LRDATE, ili.birth_date as BDATE
        ,ili.birth_time as BTIME, ili.birth_weight as BWEIGHT
        ,ili.body_length as LENGTH, ili.head_length as HEADCIRCUM
        ,IF(ili.birth_weight >= 2500,'Y',NULL) as BW2500UP
        FROM ipt_pregnancy ip
        INNER JOIN ipt i ON ip.an = i.an
        LEFT JOIN person pm ON i.hn = pm.patient_hn
        INNER JOIN patient ptm ON i.hn = ptm.hn
        INNER JOIN ipt_labour il ON ip.an = il.an
        INNER JOIN ipt_labour_infant ili ON il.ipt_labour_id = ili.ipt_labour_id
        LEFT JOIN person pc ON ili.hn = pc.patient_hn
        LEFT JOIN patient ptc ON ili.hn = ptc.hn
        WHERE ip.labor_date BETWEEN ? AND ?
        `,
        [ds, de]
    );

    return rows;
}

// ── MCH04 ──────────────────────────────────────────────────────────────────────
export async function getPpaMch04() {
    const ds = "2026-02-01";
    const de = "2026-04-30";
    const df = "2021-01-01"; // TIMESTAMPADD(MONTH,-61,'2026-02-01')
    const pp = "1B26[0-2]|1B2[0-4]2";

    const [rows] = await db.query(
        `
        SELECT q2.*
        ,IF(q2.f_screen_result IS NOT NULL,'Y',NULL) as has_screen
        ,IF(q2.f_screen_result = '1B262','Y',IF(q2.s_screen_result IS NOT NULL,'Y',NULL)) as has_motivate
        FROM (
            SELECT (SELECT hospitalcode FROM opdconfig) as hospcode
            ,LPAD(q.person_id,6,0) as PID, q.cid
            ,q.birthdate, q.f_date
            ,TIMESTAMPDIFF(MONTH,q.birthdate,q.f_date) as age_m
            ,q.f_screen_result, q.f_screen_date
            ,IF(q.f_screen_result REGEXP '1B261',
                (SELECT t.pp_special_code FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn=q.hn AND o.vstdate BETWEEN q.f_screen_date AND TIMESTAMPADD(DAY,30,q.f_screen_date)
                    ORDER BY o.vstdate LIMIT 2,1), NULL) as s_screen_result
            ,IF(q.f_screen_result REGEXP '1B261',
                (SELECT o.vstdate FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn=q.hn AND o.vstdate BETWEEN q.f_screen_date AND TIMESTAMPADD(DAY,30,q.f_screen_date)
                    ORDER BY o.vstdate LIMIT 2,1), NULL) as s_screen_date
            FROM (
                SELECT tg.*
                ,(SELECT t.pp_special_code FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn=tg.hn AND o.vstdate BETWEEN tg.f_date AND TIMESTAMPADD(DAY,30,tg.f_date)
                    ORDER BY o.vstdate LIMIT 1) as f_screen_result
                ,(SELECT o.vstdate FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn=tg.hn AND o.vstdate BETWEEN tg.f_date AND TIMESTAMPADD(DAY,30,tg.f_date)
                    ORDER BY o.vstdate LIMIT 1) as f_screen_date
                FROM (
                    SELECT person_id, cid, patient_hn as hn, birthdate
                    ,IF(TIMESTAMPADD(MONTH,9,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,9,birthdate),
                        IF(TIMESTAMPADD(MONTH,18,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,18,birthdate),
                        IF(TIMESTAMPADD(MONTH,30,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,30,birthdate),
                        IF(TIMESTAMPADD(MONTH,42,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,42,birthdate),
                        IF(TIMESTAMPADD(MONTH,60,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,60,birthdate),NULL))))) as f_date
                    FROM person
                    WHERE house_regist_type_id IN (1,3) AND birthdate > ?
                    HAVING f_date IS NOT NULL
                ) as tg
            ) as q
        ) as q2
        `,
        [
            pp, pp, pp, pp,
            ds, de, ds, de, ds, de, ds, de, ds, de,
            df,
        ]
    );

    return rows;
}