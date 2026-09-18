export const POPULATION_REPORT_TITLE = "ประชากรในเขตรับผิดชอบ Type 1,3 (กำหนดอายุ)";
export const MIN_AGE = 0;
export const MAX_AGE = 120;
export const DEFAULT_AGE_RANGE = [1, 100] as const;

export function parseAgeRange(params: URLSearchParams): [number, number] {
  const read = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d{1,3}$/.test(raw)) throw new Error("อายุต้องเป็นจำนวนเต็ม 0–120 ปี");
    const value = Number(raw);
    if (value < MIN_AGE || value > MAX_AGE) throw new Error("อายุต้องอยู่ระหว่าง 0–120 ปี");
    return value;
  };
  const min = read("minAge", DEFAULT_AGE_RANGE[0]);
  const max = read("maxAge", DEFAULT_AGE_RANGE[1]);
  if (min > max) throw new Error("อายุเริ่มต้นต้องไม่มากกว่าอายุสิ้นสุด");
  return [min, max];
}

// Keep the village IDs and registration types from the original HOSxP report.
// person_discharge_id = 9 is the active status used by getDeathNotDischarged.
export const POPULATION_REPORT_SQL = `
  SELECT p.patient_hn AS HN, p.cid AS CID,
    CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS "ชื่อ-นามสกุล",
    p.age_y AS "อายุ (ปี)", p.age_m AS "อายุ (เดือน)",
    p.house_regist_type_id AS "ประเภททะเบียน",
    h.address AS "บ้านเลขที่", h.road AS "ถนน",
    v.village_moo AS "หมู่", v.village_name AS "หมู่บ้าน",
    t.full_name AS "ที่อยู่"
  FROM person p
  LEFT JOIN house h ON h.house_id = p.house_id
  LEFT JOIN village v ON v.village_id = p.village_id
  LEFT JOIN thaiaddress t ON t.addressid = v.address_id
  WHERE p.age_y BETWEEN ? AND ?
    AND p.village_id IN (1,2,3,4,5,6,7,8,9,10,11,12,14)
    AND p.house_regist_type_id IN ('1','3')
    AND COALESCE(p.death, 'N') <> 'Y'
    AND p.person_discharge_id = '9'
  ORDER BY CAST(v.village_moo AS UNSIGNED), p.fname, p.lname, p.person_id
`;
