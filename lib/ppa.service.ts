import { db } from "@/lib/db";

// ── AGING ──────────────────────────────────────────────────────────────────────
export async function getPpaAging() {
    const ds = "2025-12-01";
    const de = "2026-07-31";
    const ppbrain = "1B122[0-9]";
    const ppfall = "1B120[0-9]";
    const ppbrainrisk = "1B122[1-9]";
    const ppfallrisk = "1B120[1-9]";

    const [rows] = await db.query(
        `
        SELECT
            CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
            (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
            LPAD(p.person_id,6,0) AS PATIENT_ID,
            p.cid AS CID,
            p.birthdate AS BIRTHDATE,
            p.sex AS SEX,
            TIMESTAMPDIFF(YEAR, p.birthdate, o.vstdate) AS AGE,
            o.vn AS VN,
            o.vstdate AS SERVICESDATE,
            GROUP_CONCAT(DISTINCT t.pp_special_code) AS SERVICE_SCREEN,
            MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Y' ELSE NULL END) AS BRAIN_SCREEN,
            MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Risk' ELSE NULL END) AS BRAIN_SCREEN_RISK,
            MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Y' ELSE NULL END) AS FALL_SCREEN,
            MAX(CASE WHEN t.pp_special_code REGEXP ? THEN 'Risk' ELSE NULL END) AS FALL_SCREEN_RISK,
            GROUP_CONCAT(DISTINCT dop.icd9) AS ICD9,
            GROUP_CONCAT(DISTINCT ov.icd10) AS ICD10,
            pt.name AS MAININSCL
        FROM pp_special pp
        LEFT JOIN pp_special_type t ON pp.pp_special_type_id = t.pp_special_type_id
        LEFT JOIN ovst o ON pp.vn = o.vn
        LEFT JOIN person p ON o.hn = p.patient_hn
        INNER JOIN pttype pt ON p.pttype = pt.pttype
        LEFT JOIN ovstdiag ov ON o.vn = ov.vn
        LEFT JOIN doctor_operation dop ON o.vn = dop.vn
        WHERE 1=1
            AND o.vstdate BETWEEN ? AND ?
            AND t.pp_special_code REGEXP CONCAT(?,\'|\',?,\'|\',?,\'|\',?)
        GROUP BY CID, SERVICESDATE
        ORDER BY o.vstdate, CID
        `,
        [ppbrain, ppbrainrisk, ppfall, ppfallrisk, ds, de, ppfall, ppbrain, ppbrainrisk, ppfallrisk]
    );

    return rows;
}

// ── NCD ────────────────────────────────────────────────────────────────────────
export async function getPpaNcd01() {
    const sy = "2569";
    const ds = "2025-12-01";
    const de = "2026-07-31";
    const dx = "Z713,Z131,R730,R731,R739,R030,Z136,Z138";

    const [rows] = await db.query(
        `
        SELECT
            CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
            (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
            LPAD(tg.person_id,6,0) AS PATIENT_ID, tg.cid AS CID, tg.birthdate AS BIRTHDATE,
            TIMESTAMPDIFF(YEAR, tg.birthdate, tg.DATE_SERV) AS AGE, tg.sex AS SEX,
            tg.SEQ, tg.DATE_SERV, tg.D_UPDATE,
            dm.person_dm_screen_status_name AS DM_RESULT,
            ht.person_ht_screen_status_name AS HT_RESULT,
            ob.person_obesity_screen_status_name AS OB_RESULT,
            (SELECT GROUP_CONCAT(DISTINCT icd10)
                FROM ovstdiag
                WHERE vstdate BETWEEN ? AND ?
                AND FIND_IN_SET(icd10, ?) > 0 AND hn = tg.patient_hn) AS DX_LIST,
            tg.SERVPLACE, tg.SMOKING, tg.ALCOHOL,
            tg.DMFAMILY, tg.HTFAMILY, tg.WEIGHT, tg.HEIGHT, tg.WAIST_CM,
            tg.SBP_1, tg.DBP_1, tg.SBP_2, tg.DBP_2, tg.BSLEVEL, tg.BSTEST, tg.PROVIDER,
            s.FU_SEQ, s.FU_DATE_SERV, s.FU_D_UPDATE,
            s.FU_SERVPLACE, s.FU_SMOKING, s.FU_ALCOHOL,
            s.FU_DMFAMILY, s.FU_HTFAMILY, s.FU_WEIGHT, s.FU_HEIGHT, s.FU_WAIST_CM,
            s.FU_SBP_1, s.FU_DBP_1, s.FU_SBP_2, s.FU_DBP_2, s.FU_BSLEVEL, s.FU_BSTEST, s.FU_PROVIDER,
            tg.MAININSCL
        FROM (
            SELECT p.person_id, p.patient_hn, p.sex, ps.person_dmht_screen_summary_id AS SEQ,
            ps.person_ht_screen_status_id, ps.person_dm_screen_status_id, ps.person_obesity_screen_status_id,
            ph.screen_date AS DATE_SERV,
            IF(ph.in_hospital = 'Y',1,2) AS SERVPLACE,
            IF(pn.present_smoking = 'N',1,9) AS SMOKING,
            IF(pn.present_drinking_alcohol = 'N',1,
                IF(pn.present_drinking_alcohol_count_perweek > 4,4,
                IF(pn.present_drinking_alcohol_count_perweek > 0,3,
                IF(pn.present_drinking_alcohol_count_perweek = 0,2,9)))) AS ALCOHOL,
            IF(pn.family_parent_dm_disease = 'Y' OR pn.family_relate_dm_disease = 'Y',1,
                IF(pn.family_parent_dm_disease = 'N' OR pn.family_relate_dm_disease = 'N',2,9)) AS DMFAMILY,
            IF(pn.family_parent_ht_disease = 'Y' OR pn.family_relate_ht_disease = 'Y',1,
                IF(pn.family_parent_ht_disease = 'N' OR pn.family_relate_ht_disease = 'N',2,9)) AS HTFAMILY,
            ph.body_weight AS WEIGHT, ph.body_height AS HEIGHT, ph.waist AS WAIST_CM,
            bp1.bps AS SBP_1, bp1.bpd AS DBP_1, bp2.bps AS SBP_2, bp2.bpd AS DBP_2,
            IF(ph.last_fgc IS NOT NULL,ph.last_fgc,IF(ph.last_fgc_no_food_limit IS NOT NULL,ph.last_fgc_no_food_limit,NULL)) AS BSLEVEL,
            IF(ph.last_fgc IS NOT NULL,3,IF(ph.last_fgc_no_food_limit IS NOT NULL,4,9)) AS BSTEST,
            ph.doctor_code AS PROVIDER, ps.last_screen_datetime AS D_UPDATE, p.cid, p.birthdate, pt.name AS MAININSCL
            FROM person_dmht_screen_summary ps
            INNER JOIN person p ON ps.person_id = p.person_id
            INNER JOIN pttype pt ON p.pttype = pt.pttype
            INNER JOIN person_dmht_nhso_screen pn ON ps.person_dmht_screen_summary_id=pn.person_dmht_screen_summary_id
            INNER JOIN person_dmht_risk_screen_head ph ON pn.person_dmht_screen_summary_id=ph.person_dmht_screen_summary_id
            LEFT JOIN person_ht_risk_bp_screen bp1 ON ph.person_dmht_risk_screen_head_id = bp1.person_dmht_risk_screen_head_id AND bp1.screen_no = 1
            LEFT JOIN person_ht_risk_bp_screen bp2 ON ph.person_dmht_risk_screen_head_id = bp2.person_dmht_risk_screen_head_id AND bp2.screen_no = 2
            WHERE ps.bdg_year = ? AND ph.screen_date BETWEEN ? AND ?
            AND ps.status_active = 'Y'
            AND (ps.person_ht_screen_status_id >=3 OR ps.person_dm_screen_status_id >=2 OR ps.person_obesity_screen_status_id =2)
            AND p.house_regist_type_id IN (1,3)
        ) AS tg
        LEFT JOIN (
            SELECT ps.person_id, ph.screen_date AS FU_DATE_SERV, ps.person_dmht_screen_summary_id AS FU_SEQ,
            IF(ph.in_hospital = 'Y',1,2) AS FU_SERVPLACE,
            IF(pn.present_smoking = 'N',1,9) AS FU_SMOKING,
            IF(pn.present_drinking_alcohol = 'N',1,
                IF(pn.present_drinking_alcohol_count_perweek > 4,4,
                IF(pn.present_drinking_alcohol_count_perweek > 0,3,
                IF(pn.present_drinking_alcohol_count_perweek = 0,2,9)))) AS FU_ALCOHOL,
            IF(pn.family_parent_dm_disease = 'Y' OR pn.family_relate_dm_disease = 'Y',1,
                IF(pn.family_parent_dm_disease = 'N' OR pn.family_relate_dm_disease = 'N',2,9)) AS FU_DMFAMILY,
            IF(pn.family_parent_ht_disease = 'Y' OR pn.family_relate_ht_disease = 'Y',1,
                IF(pn.family_parent_ht_disease = 'N' OR pn.family_relate_ht_disease = 'N',2,9)) AS FU_HTFAMILY,
            ph.body_weight AS FU_WEIGHT, ph.body_height AS FU_HEIGHT, ph.waist AS FU_WAIST_CM,
            bp1.bps AS FU_SBP_1, bp1.bpd AS FU_DBP_1, bp2.bps AS FU_SBP_2, bp2.bpd AS FU_DBP_2,
            IF(ph.last_fgc IS NOT NULL,ph.last_fgc,IF(ph.last_fgc_no_food_limit IS NOT NULL,ph.last_fgc_no_food_limit,NULL)) AS FU_BSLEVEL,
            IF(ph.last_fgc IS NOT NULL,3,IF(ph.last_fgc_no_food_limit IS NOT NULL,4,9)) AS FU_BSTEST,
            ph.doctor_code AS FU_PROVIDER, ps.last_screen_datetime AS FU_D_UPDATE
            FROM person_dmht_screen_summary ps
            INNER JOIN person_dmht_nhso_screen pn ON ps.person_dmht_screen_summary_id=pn.person_dmht_screen_summary_id
            INNER JOIN person_dmht_risk_screen_head ph ON pn.person_dmht_screen_summary_id=ph.person_dmht_screen_summary_id
            LEFT JOIN person_ht_risk_bp_screen bp1 ON ph.person_dmht_risk_screen_head_id = bp1.person_dmht_risk_screen_head_id AND bp1.screen_no = 1
            LEFT JOIN person_ht_risk_bp_screen bp2 ON ph.person_dmht_risk_screen_head_id = bp2.person_dmht_risk_screen_head_id AND bp2.screen_no = 2
            WHERE ps.bdg_year = ? AND ph.screen_date BETWEEN ? AND ? AND ps.status_active = 'Y'
        ) AS s ON tg.person_id = s.person_id AND s.FU_DATE_SERV > tg.DATE_SERV
        LEFT JOIN person_dm_screen_status dm ON tg.person_dm_screen_status_id = dm.person_dm_screen_status_id
        LEFT JOIN person_ht_screen_status ht ON tg.person_ht_screen_status_id = ht.person_ht_screen_status_id
        LEFT JOIN person_obesity_screen_status ob ON tg.person_obesity_screen_status_id = ob.person_obesity_screen_status_id
        ORDER BY DATE_SERV
        `,
        [ds, de, dx, sy, ds, de, sy, ds, de]
    );

    return rows;
}

// NCD02 ใช้ query เดียวกัน (SQL ใหม่รวมเป็นไฟล์เดียว)
export async function getPpaNcd02() {
    return getPpaNcd01();
}

// ── MCH ANC ────────────────────────────────────────────────────────────────────
export async function getPpaMch01() {
    const ds = "2025-02-01";
    const de = "2026-07-31";

    const [rows] = await db.query(
        `
        SELECT
            CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
            (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
            mch.hn AS HN,
            mch.cid AS CID,
            mch.birthdate AS BIRTHDATE,
            TIMESTAMPDIFF(YEAR, mch.birthdate, mch.vstdate) AS AGE,
            mch.vn AS VN,
            SUBSTR(mch.anc_service_date, 1, 10) AS SERVICESDATE,
            mch.dx_list AS DX_LIST,
            mch.icd9_list AS ICD9_LIST,
            mch.ttmt_code_list AS TTMT_CODE_LIST,
            mch.preg_no AS GRAVIDA,
            mch.lmp AS LMP,
            mch.edc AS EDC,
            mch.labor_date AS BDATE,
            mch.labor_icd10 AS BRESULT,
            mch.labor_place_id AS BPLACE,
            mch.labour_hospcode AS BHOSP,
            mch.labour_type_id AS BTYPE,
            mch.labor_doctor_type_id AS BDOCTOR,
            mch.alive_child_count AS LBORN,
            mch.dead_child_count AS SBORN,
            mch.MAININSCL
        FROM (
            SELECT IF(p.person_id IS NOT NULL, LPAD(p.person_id,6,0), o.hn) AS hn,
            IF(p.person_id IS NOT NULL, p.cid, pt.cid) AS cid,
            pas.person_anc_id,
            pas.vn,
            pa.preg_no,
            pa.lmp,
            pa.edc,
            pa.labor_date,
            pa.labor_icd10,
            pa.labor_place_id,
            pa.labour_hospcode,
            pa.labour_type_id,
            pa.labor_doctor_type_id,
            pa.alive_child_count,
            pa.dead_child_count,
            p.birthdate, o.vstdate,
            GROUP_CONCAT(DISTINCT pas.anc_service_date ORDER BY pas.anc_service_date) AS anc_service_date,
            GROUP_CONCAT(DISTINCT od.icd10) AS dx_list,
            GROUP_CONCAT(DISTINCT dop.icd9) AS icd9_list,
            GROUP_CONCAT(dr.ttmt_code) AS ttmt_code_list,
            pts.name AS MAININSCL
            FROM person_anc_service pas
            INNER JOIN person_anc pa ON pas.person_anc_id = pa.person_anc_id
            INNER JOIN person p ON pa.person_id = p.person_id
            LEFT JOIN opdscreen os ON pas.vn = os.vn
            INNER JOIN ovst o ON pas.vn = o.vn
            INNER JOIN patient pt ON o.hn = pt.hn
            LEFT JOIN ovst_seq q ON pas.vn = q.vn
            JOIN ovstdiag od ON pas.vn = od.vn
            INNER JOIN pttype pts ON p.pttype = pts.pttype
            LEFT JOIN doctor_operation dop ON dop.vn = pas.vn
            LEFT JOIN opitemrece op ON pas.vn = op.vn
            LEFT JOIN drugitems dr ON dr.icode = op.icode
            WHERE pas.anc_service_date BETWEEN ? AND ?
            GROUP BY pas.person_anc_id, pas.vn
        ) AS mch
        ORDER BY CID, SERVICESDATE
        `,
        [ds, de]
    );

    return rows;
}

// ── MCH NEWBORN ────────────────────────────────────────────────────────────────
export async function getPpaMch02() {
    const ds = "2025-12-01";
    const de = "2026-07-31";

    const [rows] = await db.query(
        `
        SELECT
            CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
            (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
            IF(pc.person_id IS NOT NULL, LPAD(pc.person_id,6,0), ili.hn) AS CHILD_HN,
            IF(pc.person_id IS NOT NULL, pc.cid, ptc.cid) AS CHILD_CID,
            IF(pm.person_id IS NOT NULL, LPAD(pm.person_id,6,0), i.hn) AS MOM_HN,
            IF(pm.person_id IS NOT NULL, pm.cid, ptm.cid) AS MOM_CID,
            il.ga AS START_ANC,
            il.lmp AS LMP,
            il.edc AS EDC,
            ip.labor_date AS LDATE,
            ili.birth_date AS BDATE,
            DATE_FORMAT(ili.birth_time, '%H:%i:%s') AS BTIME,
            TIMESTAMPDIFF(WEEK, il.lmp, ip.labor_date) AS GA,
            ili.birth_weight AS B_WEIGHT,
            ili.body_length AS B_LENGTH,
            ili.head_length AS B_HEADCIRCUM,
            pt.name AS MAININSCL
        FROM ipt_pregnancy ip
        INNER JOIN ipt i ON ip.an = i.an
        LEFT JOIN person pm ON i.hn = pm.patient_hn
        INNER JOIN patient ptm ON i.hn = ptm.hn
        INNER JOIN ipt_labour il ON ip.an = il.an
        INNER JOIN ipt_labour_infant ili ON il.ipt_labour_id = ili.ipt_labour_id
        LEFT JOIN person pc ON ili.hn = pc.patient_hn
        LEFT JOIN patient ptc ON ili.hn = ptc.hn
        INNER JOIN pttype pt ON pm.pttype = pt.pttype
        WHERE ip.labor_date BETWEEN ? AND ?
        ORDER BY BDATE
        `,
        [ds, de]
    );

    return rows;
}

// ── MCH WOMAN (วางแผนครอบครัว) ────────────────────────────────────────────────
export async function getPpaMchWoman() {
    const ds = "2025-12-01";
    const de = "2026-07-31";

    const [rows] = await db.query(
        `
        SELECT
            CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
            (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
            o.hn AS HN,
            p.cid AS CID,
            p.birthdate AS BIRTHDATE,
            p.age_y AS AGE,
            p.sex AS SEX,
            o.vn AS VN,
            o1.vstdate AS SERVICESDATE,
            o.icd10 AS COUNSELLING,
            (GROUP_CONCAT(DISTINCT o1.icd10)) AS DX_LIST,
            CONTR.vstdate AS C_DATE,
            CONTR.icd10 AS CONTRACEPTION,
            dop.icd9 AS CONTRACEPTION_TYPE,
            pt.name AS MAININSCL
        FROM ovstdiag o
            INNER JOIN person p ON o.hn = p.patient_hn
            LEFT JOIN (SELECT * FROM ovstdiag o1
                WHERE o1.vstdate BETWEEN ? AND ?) AS o1
                ON o1.hn = o.hn
            LEFT JOIN (SELECT * FROM ovstdiag o1
                WHERE o1.icd10 IN ('Z301','Z302','Z304','Z308')) AS CONTR
                ON CONTR.vn = o.vn
            LEFT JOIN (SELECT dop.* FROM doctor_operation dop
                WHERE dop.icd9 IN ('697','9923','6629','6631','6632','6639')) AS dop
                ON dop.vn = o.vn
            INNER JOIN pttype pt ON p.pttype = pt.pttype
        WHERE
            o.vstdate BETWEEN ? AND ?
            AND o.icd10 IN ('Z718','Z719','Z316','Z300')
            AND p.age_y BETWEEN 15 AND 49
        GROUP BY CID, SERVICESDATE
        `,
        [ds, de, ds, de]
    );

    return rows;
}

// ── MCH CHILD (พัฒนาการเด็ก DSPM) ────────────────────────────────────────────
export async function getPpaMch04() {
    const ds = "2025-12-01";
    const de = "2026-07-31";
    const df = new Date(new Date(ds).setMonth(new Date(ds).getMonth() - 61))
        .toISOString().slice(0, 10);
    const pp = "1B26[0-2]";

    const [rows] = await db.query(
        `
        SELECT q2.*,
        CASE
            WHEN q2.f_screen_result IN ('1B261','1B262') THEN q2.f_screen_result
            ELSE NULL
        END AS DEVELOPMENTAL_DELAY,
        CASE
            WHEN q2.s_screen_result IN ('1B202','1B212','1B222','1B232','1B242') THEN q2.s_screen_result
            ELSE NULL
        END AS DEVELOPMENTAL_DELAY_FOLLOW
        FROM (
            SELECT
                CURRENT_TIMESTAMP() AS DATAEXPORTDATE,
                (SELECT hospitalcode FROM opdconfig) AS HOSPCODE,
                q.hn AS HN,
                q.cid AS CID,
                q.sex AS SEX,
                q.birthdate AS BIRTHDATE,
                q.f_date AS DATE_PERIOD,
                TIMESTAMPDIFF(MONTH, q.BIRTHDATE, q.f_date) AS AGE_PERIOD,
                q.f_screen_date AS F_SCREEN_DATE,
                q.f_screen_result AS F_SCREEN_RESULT,
                z2.s_screen_date AS S_SCREEN_DATE,
                z2.s_screen_result AS S_SCREEN_RESULT,
                q.MAININSCL
            FROM (
                SELECT tg.*,
                (SELECT t.pp_special_code FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn = tg.hn AND o.vstdate BETWEEN tg.f_date AND TIMESTAMPADD(DAY,30,tg.f_date)
                    ORDER BY o.vstdate LIMIT 1) AS f_screen_result,
                (SELECT o.vstdate FROM pp_special s
                    INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON s.vn = o.vn
                    WHERE o.hn = tg.hn AND o.vstdate BETWEEN tg.f_date AND TIMESTAMPADD(DAY,30,tg.f_date)
                    ORDER BY o.vstdate LIMIT 1) AS f_screen_date
                FROM (
                    SELECT person_id, cid, sex, patient_hn AS hn, birthdate,
                    IF(TIMESTAMPADD(MONTH,9,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,9,birthdate),
                    IF(TIMESTAMPADD(MONTH,18,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,18,birthdate),
                    IF(TIMESTAMPADD(MONTH,30,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,30,birthdate),
                    IF(TIMESTAMPADD(MONTH,42,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,42,birthdate),
                    IF(TIMESTAMPADD(MONTH,60,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,60,birthdate),NULL))))) AS f_date,
                    pt.name AS MAININSCL
                    FROM person p
                    INNER JOIN pttype pt ON p.pttype = pt.pttype
                    WHERE house_regist_type_id IN (1,3)
                    AND birthdate > ?
                    HAVING f_date IS NOT NULL
                ) AS tg
            ) AS q
            LEFT JOIN (
                SELECT s2.hn,
                (SELECT t.pp_special_code FROM pp_special sx
                    INNER JOIN pp_special_type t ON sx.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON sx.vn = o.vn
                    WHERE o.hn = s2.hn AND o.vstdate BETWEEN s2.f_screen_date AND TIMESTAMPADD(DAY,30,s2.f_screen_date)
                    ORDER BY o.vstdate LIMIT 2,1) AS s_screen_result,
                (SELECT o.vstdate FROM pp_special sx
                    INNER JOIN pp_special_type t ON sx.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                    INNER JOIN ovst o ON sx.vn = o.vn
                    WHERE o.hn = s2.hn AND o.vstdate BETWEEN s2.f_screen_date AND TIMESTAMPADD(DAY,30,s2.f_screen_date)
                    ORDER BY o.vstdate LIMIT 2,1) AS s_screen_date
                FROM (
                    SELECT DISTINCT hn, f_screen_date FROM (
                        SELECT tg.patient_hn AS hn,
                        (SELECT o.vstdate FROM pp_special s
                            INNER JOIN pp_special_type t ON s.pp_special_type_id = t.pp_special_type_id AND t.pp_special_code REGEXP ?
                            INNER JOIN ovst o ON s.vn = o.vn
                            WHERE o.hn = tg.patient_hn AND o.vstdate BETWEEN tg.f_date AND TIMESTAMPADD(DAY,30,tg.f_date)
                            ORDER BY o.vstdate LIMIT 1) AS f_screen_date
                        FROM (
                            SELECT patient_hn,
                            IF(TIMESTAMPADD(MONTH,9,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,9,birthdate),
                            IF(TIMESTAMPADD(MONTH,18,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,18,birthdate),
                            IF(TIMESTAMPADD(MONTH,30,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,30,birthdate),
                            IF(TIMESTAMPADD(MONTH,42,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,42,birthdate),
                            IF(TIMESTAMPADD(MONTH,60,birthdate) BETWEEN ? AND ?,TIMESTAMPADD(MONTH,60,birthdate),NULL))))) AS f_date
                            FROM person
                            WHERE house_regist_type_id IN (1,3) AND birthdate > ?
                            HAVING f_date IS NOT NULL
                        ) AS tg
                    ) AS sub WHERE f_screen_date IS NOT NULL
                ) AS s2
            ) AS z2 ON q.hn = z2.hn
        ) AS q2
        ORDER BY F_SCREEN_DATE, CID
        `,
        [
            pp, pp,
            ds, de, ds, de, ds, de, ds, de, ds, de, df,
            pp, pp, pp,
            ds, de, ds, de, ds, de, ds, de, ds, de, df,
        ]
    );

    return rows;
}