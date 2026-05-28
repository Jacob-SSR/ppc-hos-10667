// lib/sheets/parseDate.ts
// แปลงวันที่ทุกรูปแบบ → "YYYY-MM-DD" (ค.ศ.)
// รวม logic จาก normalizeDate/parseDateStr/parseDate/toDateStr ที่กระจายอยู่ 6 ไฟล์

const THAI_MONTHS_FULL: Record<string, string> = {
  มกราคม: "01",
  กุมภาพันธ์: "02",
  มีนาคม: "03",
  เมษายน: "04",
  พฤษภาคม: "05",
  มิถุนายน: "06",
  กรกฎาคม: "07",
  สิงหาคม: "08",
  กันยายน: "09",
  ตุลาคม: "10",
  พฤศจิกายน: "11",
  ธันวาคม: "12",
};

const THAI_MONTHS_SHORT: Record<string, string> = {
  "ม.ค.": "01",
  "ก.พ.": "02",
  "มี.ค.": "03",
  "เม.ย.": "04",
  "พ.ค.": "05",
  "มิ.ย.": "06",
  "ก.ค.": "07",
  "ส.ค.": "08",
  "ก.ย.": "09",
  "ต.ค.": "10",
  "พ.ย.": "11",
  "ธ.ค.": "12",
};

/** แปลงพ.ศ. → ค.ศ. (ถ้าปี > 2400 ถือว่าเป็นพ.ศ.) */
export function beToCe(y: number): number {
  return y > 2400 ? y - 543 : y;
}

interface ParseOpts {
  /** ตรวจว่าปีอยู่ช่วง 1900–2200 (default false) */
  validate?: boolean;
  /** รองรับ Excel serial number (default true) */
  serial?: boolean;
}

/**
 * แปลงวันที่ทุกรูปแบบ → "YYYY-MM-DD" (ค.ศ.)
 * รองรับ: ISO, YYYY/MM/DD, D/M/YYYY, D-M-YYYY, ไทยเต็ม/ย่อ (คั่นด้วยช่องว่าง // หรือ -), Excel serial
 * คืน "" ถ้า parse ไม่ได้
 *
 * ตัวอย่างการใช้แทนของเดิม:
 *   accident.normalizeDate(s)        → parseDate(s)
 *   stroke/drug.parseDateStr(v)      → parseDate(v, { validate: true })
 *   sepsis.toDateStr(v)              → parseDate(v, { validate: true })
 */
export function parseDate(raw: unknown, opts: ParseOpts = {}): string {
  const { validate = false, serial = true } = opts;
  if (raw == null || raw === "" || raw === "-") return "";
  const s = String(raw).trim();
  if (!s || s === "-") return "";

  const ok = (y: number) => !validate || (y >= 1900 && y <= 2200);
  const build = (y: number, m: string, d: string): string =>
    ok(y) ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";

  // ISO: YYYY-MM-DD (อาจตามด้วย T...)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return build(beToCe(+m[1]), m[2], m[3]);

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (m) return build(beToCe(+m[1]), m[2], m[3]);

  // ไทยแบบเต็ม + ย่อ — ลอง match "วัน + ชื่อเดือนไทย + ปี" ก่อน D/M/YYYY
  // รองรับตัวคั่นทุกแบบ: ช่องว่าง, /, ., -  (เช่น "3/เมษายน/2026", "15 มีนาคม 2568", "2 ต.ค. 2566")
  for (const table of [THAI_MONTHS_FULL, THAI_MONTHS_SHORT]) {
    for (const [th, mm] of Object.entries(table)) {
      const re = new RegExp(
        `(\\d{1,2})[\\s/.-]*${th.replace(/\./g, "\\.")}[\\s/.-]*(\\d{4})`,
      );
      const tm = s.match(re);
      if (tm) return build(beToCe(+tm[2]), mm, tm[1]);
    }
  }

  // D/M/YYYY หรือ DD/MM/YYYY (เดือนเป็นตัวเลข)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return build(beToCe(+m[3]), m[2], m[1]);

  // D-M-YYYY หรือ DD-MM-YYYY (เดือนเป็นตัวเลข)
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return build(beToCe(+m[3]), m[2], m[1]);

  // Excel serial number (Google Sheets ส่งเป็นเลขถ้า column format = Date)
  if (serial) {
    const num = Number(s);
    if (!isNaN(num) && num > 25569 && num < 60000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return build(
        beToCe(d.getUTCFullYear()),
        String(d.getUTCMonth() + 1),
        String(d.getUTCDate()),
      );
    }
  }

  return "";
}

const SHORT_BY_NUM = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** "2568-11" → "พ.ย. 68" (label เดือนไทยจาก YYYY-MM ค.ศ.) */
export function monthLabelShort(ym: string): string {
  const [y, mm] = ym.split("-");
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return ym;
  return `${SHORT_BY_NUM[idx]} ${String(+y + 543).slice(2)}`;
}
