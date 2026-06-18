// app/api/ai/chat/route.ts

import { NextResponse } from "next/server";
import {
  friendlyGeminiError,
  getRetryAfterSec,
  type GeminiContentResponse,
  type GeminiErrorResponse,
} from "@/lib/gemini";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

type GeminiCallResult =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string; retryAfter?: number };

// ── เรียก Gemini (chat) พร้อม retry ──
async function callGeminiChat(
  systemPrompt: string,
  contents: GeminiContent[],
  maxRetries = 3,
): Promise<GeminiCallResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(
        `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        },
      );

      clearTimeout(timeout);
      const data = (await res.json()) as GeminiContentResponse &
        GeminiErrorResponse;

      if (res.ok) {
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("") ?? "";
        return { ok: true, text };
      }

      // 429 = rate limit → ลองใหม่
      if (res.status === 429) {
        const retrySec = getRetryAfterSec(data);
        const delaySec = retrySec ?? Math.pow(2, attempt);

        if (attempt === maxRetries) {
          return {
            ok: false,
            status: 429,
            message: friendlyGeminiError(429, data),
            retryAfter: Math.ceil(delaySec),
          };
        }

        console.warn(
          `Gemini chat 429 — retry ครั้งที่ ${attempt + 1}/${maxRetries} ในอีก ${delaySec.toFixed(1)}s`,
        );
        await new Promise((r) => setTimeout(r, delaySec * 1000));
        continue;
      }

      // error อื่นๆ → ไม่ retry
      console.error("Gemini Chat API Error:", data);
      return {
        ok: false,
        status: res.status,
        message: friendlyGeminiError(res.status, data),
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const aborted = err instanceof Error && err.name === "AbortError";

      if (attempt === maxRetries) {
        return {
          ok: false,
          status: aborted ? 504 : 500,
          message: aborted
            ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
            : "เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณาลองใหม่",
        };
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  return {
    ok: false,
    status: 500,
    message: "ไม่สามารถประมวลผลด้วย AI ได้ กรุณาลองใหม่",
  };
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
    const contents: GeminiContent[] = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await callGeminiChat(systemPrompt, contents);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}),
        },
        {
          status: result.status,
          ...(result.retryAfter
            ? { headers: { "Retry-After": String(result.retryAfter) } }
            : {}),
        },
      );
    }

    return NextResponse.json({ reply: result.text });
  } catch (error) {
    console.error("Gemini chat error:", error);
    return NextResponse.json(
      { error: "ตอบคำถามไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
