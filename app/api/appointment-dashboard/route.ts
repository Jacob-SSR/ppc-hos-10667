import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { cachedQuery } from "@/lib/cache";

const CLINICS = {
  DM: { code: "001", name: "คลินิกเบาหวาน (DM 001)" },
  HT: { code: "002", name: "คลินิกความดันโลหิตสูง (HT 002)" },
  CKD: { code: "023", name: "คลินิกโรคไต (CKD 023)" },
} as const;

type ClinicType = keyof typeof CLINICS;

// รักษาเงื่อนไขจาก SQL ที่ผู้ใช้ระบุ โดยให้รหัสคลินิกครอบทุกแขนง OR
const NOTE_FILTERS: Record<ClinicType, string> = {
  DM: "(oo.note2 LIKE '%ประจำปีDM%' OR (oo.note2 LIKE '%ckd%' AND oo.note LIKE '%ประจำปีDM%'))",
  HT: "(oo.note2 LIKE '%ประจำปีHT%' OR (oo.note2 LIKE '%ckd%' AND oo.note LIKE '%ประจำปีHT%'))",
  CKD: "(oo.note2 LIKE '%ckd%' OR (oo.note2 LIKE '%ckd%' AND oo.note LIKE '%ประจำปีHT%') OR (oo.note2 LIKE '%ckd%' AND oo.note LIKE '%ประจำปีDM%'))",
};

interface AppointmentRow extends RowDataPacket {
  nextdate: string;
  count_val: number;
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type")?.toUpperCase();
  const start = params.get("start");
  const end = params.get("end");

  if (!type || !(type in CLINICS) || !validDate(start) || !validDate(end) || start > end) {
    return NextResponse.json({ error: "ประเภทคลินิกหรือช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  const clinicType = type as ClinicType;
  const clinic = CLINICS[clinicType];

  try {
    const data = await cachedQuery(
      ["appointment-dashboard", clinicType, start, end],
      async () => {
        const [rows] = await db.query<AppointmentRow[]>(
          `SELECT DATE_FORMAT(oo.nextdate, '%Y-%m-%d') AS nextdate,
                  COUNT(DISTINCT oo.vn) AS count_val
             FROM oapp oo
            WHERE oo.nextdate BETWEEN ? AND ?
              AND oo.clinic = ?
              AND ${NOTE_FILTERS[clinicType]}
            GROUP BY oo.nextdate
            ORDER BY oo.nextdate`,
          [start, end, clinic.code],
        );
        return rows.map((row) => ({
          nextdate: row.nextdate,
          count_val: Number(row.count_val),
        }));
      },
      300,
    );

    return NextResponse.json({ clinicName: clinic.name, data });
  } catch (error) {
    console.error("Appointment dashboard error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลการนัดหมายได้" }, { status: 500 });
  }
}
