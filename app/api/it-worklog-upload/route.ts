// app/api/it-worklog-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const REQUIRED_HEADERS = [
  "ชื่อเจ้าหน้าที่ไอที",
  "เลือกงานหลัก",
  "วันที่ปฏิบัติงาน",
  "ความเร่งด่วน",
  "รวมระยะเวลา",
  "การพัฒนา",
  "ความทันเวลา",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ .csv" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // อ่านเฉพาะบรรทัดแรก (header row)
    // เช็คทีละ header — ถ้าขาดตัวไหนบอกชื่อเลยว่าขาดอะไร
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/)[0] ?? "";

    const missing = REQUIRED_HEADERS.filter((h) => !firstLine.includes(h));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `ไฟล์ไม่ตรงรูปแบบ — header ที่ขาด: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    // นับจำนวน rows
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rowCount = lines.length - 1;

    if (rowCount === 0) {
      return NextResponse.json({ error: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });
    }

    // เขียนทับไฟล์เดิม
    const dataDir = path.join(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    const filePath = path.join(dataDir, "it-worklog.csv");
    writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `อัปโหลดสำเร็จ — ${rowCount.toLocaleString()} รายการ`,
      rows: rowCount,
      filename: file.name,
      size: file.size,
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "อัปโหลดไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
