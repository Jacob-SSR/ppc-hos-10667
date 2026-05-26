// app/api/stm-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

const REQUIRED_HEADERS = ["REP", "TRAN_ID", "HN"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls"))
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ .xlsx หรือ .xls" },
        { status: 400 }
      );

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    }) as unknown[][];

    // header อยู่แถว 0
    const firstRow = (raw[0] as string[]).map((c) =>
      String(c ?? "").trim()
    );
    const missing = REQUIRED_HEADERS.filter(
      (h) => !firstRow.some((c) => c.includes(h))
    );
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `ไฟล์ไม่ตรงรูปแบบ STM — header ที่ขาด: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // นับ data rows (เริ่มจาก row index 3)
    const dataRows = raw
      .slice(3)
      .filter((r) => (r as unknown[])[0] || (r as unknown[])[1] || (r as unknown[])[3]);

    if (dataRows.length === 0)
      return NextResponse.json({ error: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });

    const dataDir = path.join(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "stm.xlsx"), buf);

    return NextResponse.json({
      success: true,
      message: `อัปโหลดสำเร็จ — ${dataRows.length.toLocaleString()} รายการ`,
      rows: dataRows.length,
      filename: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("STM upload error:", err);
    return NextResponse.json(
      { error: "อัปโหลดไม่สำเร็จ: " + (err as Error).message },
      { status: 500 }
    );
  }
}