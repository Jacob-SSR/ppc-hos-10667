// app/api/drug-upload/route.ts
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
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ .xlsx หรือ .xls" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    }) as unknown[][];
    const dataRows = raw.slice(1).filter((r) => (r as unknown[])[0] != null);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });
    }

    const dataDir = path.join(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "drug-patients.xlsx"), buf);

    return NextResponse.json({
      success: true,
      message: `อัปโหลดสำเร็จ — ${dataRows.length.toLocaleString()} ราย`,
      rows: dataRows.length,
      filename: file.name,
    });
  } catch (err) {
    console.error("Drug upload error:", err);
    return NextResponse.json(
      { error: "อัปโหลดไม่สำเร็จ: " + (err as Error).message },
      { status: 500 },
    );
  }
}
