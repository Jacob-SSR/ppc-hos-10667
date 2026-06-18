// app/api/ai/chat/route.ts

import { NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  try {
    const { summary, context, messages } = (await req.json()) as {
      summary: unknown;
      context?: string;
      messages: ChatMessage[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "ไม่มีข้อความสำหรับถาม" },
        { status: 400 },
      );
    }

    // system prompt — บังคับให้ตอบจากข้อมูลหน้านี้เท่านั้น
    const systemPrompt = `
คุณเป็นนักวิเคราะห์ข้อมูลโรงพยาบาล ทำหน้าที่ตอบคำถามเกี่ยวกับข้อมูลของหน้านี้

บริบทของหน้า: ${context ?? "Dashboard โรงพยาบาล"}

กติกาการตอบ:
- ตอบโดยอ้างอิงจาก "ข้อมูล" ด้านล่างเท่านั้น
- ห้ามแต่งตัวเลขเอง ถ้าข้อมูลไม่พอให้บอกว่า "ข้อมูลไม่เพียงพอที่จะตอบ"
- ตอบกระชับ ตรงประเด็น เป็นภาษาไทย อ่านแล้วเข้าใจทันที
- ถ้าเหมาะสมให้เสนอข้อสังเกตหรือคำแนะนำที่ actionable

ข้อมูล (JSON):
${JSON.stringify(summary, null, 2)}
`.trim();

    // แปลงประวัติแชทเป็น contents ของ Gemini (user/assistant -> user/model)
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      console.error("Gemini Chat API Error:", data);
      return NextResponse.json(
        { error: data?.error?.message ?? "เกิดข้อผิดพลาดจาก Gemini API" },
        { status: res.status },
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("Gemini chat error:", error);
    return NextResponse.json({ error: "ตอบคำถามไม่สำเร็จ" }, { status: 500 });
  }
}
