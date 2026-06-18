// app/api/ai/summarize/route.ts

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { summary, context } = await req.json();

    const prompt = `
คุณเป็นนักวิเคราะห์ข้อมูลโรงพยาบาลระดับผู้บริหาร (Senior Analyst)

หน้าที่:
คุณต้องวิเคราะห์ข้อมูลนี้ให้ลึก และอ่านแล้วเข้าใจทันที

รูปแบบการตอบ (ห้ามเปลี่ยน):

📊 1. สรุปภาพรวม (1 ย่อหน้า)
- อธิบายแนวโน้มหลักของข้อมูล

⚠️ 2. จุดที่น่าสนใจ / ผิดปกติ (3-5 ข้อ)
- ต้องเป็น bullet point
- ถ้ามีความเสี่ยงให้เน้น

💡 3. ข้อเสนอแนะ (2-3 ข้อ)
- ต้อง actionable เช่น “ควรเพิ่ม...”, “ควรเฝ้าระวัง...”

ข้อห้าม:
- ห้ามแต่งตัวเลขเอง
- ห้ามเดาข้อมูล
- ถ้าข้อมูลไม่พอให้บอกว่า "ข้อมูลไม่เพียงพอ"

ข้อมูล:
${JSON.stringify(summary, null, 2)}
`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      console.error("Gemini API Error:", data);

      return NextResponse.json(
        {
          error: data?.error?.message ?? "เกิดข้อผิดพลาดจาก Gemini API",
        },
        { status: res.status },
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    return NextResponse.json({
      summary: text,
    });
  } catch (error) {
    console.error("Gemini summarize error:", error);

    return NextResponse.json(
      {
        error: "สรุปข้อมูลไม่สำเร็จ",
      },
      { status: 500 },
    );
  }
}
