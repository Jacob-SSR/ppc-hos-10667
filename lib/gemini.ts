// lib/gemini.ts

// ── Types สำหรับ response ของ Gemini ──
export type GeminiErrorDetail = {
  "@type"?: string;
  retryDelay?: string;
};

export type GeminiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: GeminiErrorDetail[];
  };
};

export type GeminiPart = { text?: string };

export type GeminiContentResponse = {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
};

// ดึงจำนวนวินาทีที่ต้องรอ จาก RetryInfo (ถ้ามี)
export function getRetryAfterSec(data: GeminiErrorResponse): number | null {
  const retryInfo = data?.error?.details?.find((d) =>
    String(d?.["@type"]).includes("RetryInfo"),
  );
  if (!retryInfo?.retryDelay) return null;
  const sec = parseFloat(String(retryInfo.retryDelay));
  return Number.isFinite(sec) ? Math.ceil(sec) : null;
}

// แปลง error เป็นข้อความไทยที่ผู้ใช้เข้าใจง่าย
export function friendlyGeminiError(
  status: number,
  data: GeminiErrorResponse,
): string {
  const retrySec = getRetryAfterSec(data);
  switch (status) {
    case 429:
      return `ตอนนี้มีการเรียกใช้ AI บ่อยเกินกำหนด กรุณารอสักครู่แล้วลองใหม่${
        retrySec ? ` (ประมาณ ${retrySec} วินาที)` : ""
      }`;
    case 400:
      return "คำขอไม่ถูกต้อง หรือข้อมูลมากเกินไป กรุณาลองใหม่";
    case 403:
      return "ไม่มีสิทธิ์เรียกใช้ AI กรุณาติดต่อผู้ดูแลระบบ";
    case 500:
    case 503:
      return "บริการ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
    default:
      return "ไม่สามารถประมวลผลด้วย AI ได้ในขณะนี้ กรุณาลองใหม่";
  }
}

// helper เดิม
export async function generateWithGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );
  const data = (await res.json()) as GeminiContentResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
