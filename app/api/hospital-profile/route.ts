import { NextResponse } from "next/server";
import { getHospitalProfile } from "@/lib/hospital-profile.service";

export async function GET() {
  try {
    const data = await getHospitalProfile();
    return NextResponse.json(data);
  } catch (error) {
    console.error("hospital-profile error:", error);
    return NextResponse.json(
      { message: "ดึงข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
