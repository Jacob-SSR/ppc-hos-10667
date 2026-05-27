// app/api/sepsis-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls"))
      return NextResponse.json(
        { error: "รองรับเฉพาะ .xlsx หรือ .xls" },
        { status: 400 },
      );

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    const wb = XLSX.read(buf, { type: "buffer" });
    let totalRows = 0;
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: null,
      }) as unknown[][];
      totalRows += raw
        .slice(1)
        .filter((r) => (r as unknown[])[1] != null).length;
    }
    if (totalRows === 0)
      return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });

    const dataDir = path.join(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "sepsis.xlsx"), buf);

    return NextResponse.json({
      success: true,
      message: `อัปโหลดสำเร็จ — ${totalRows} ราย จาก ${wb.SheetNames.length} ปี`,
      rows: totalRows,
      filename: file.name,
    });
  } catch (err) {
    console.error("Sepsis upload error:", err);
    return NextResponse.json(
      { error: "อัปโหลดไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
