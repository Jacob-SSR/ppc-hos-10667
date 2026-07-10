// app/api/ai/summarize/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  friendlyGeminiError,
  getRetryAfterSec,
  type GeminiContentResponse,
  type GeminiErrorResponse,
} from "@/lib/gemini";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { getUsername } from "@/lib/getUsername";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Cache แบบง่าย (in-memory) ─────────────────────────────
// หมายเหตุ: cache นี้อยู่ใน memory ของ process เดียว เหมาะกับ dev/single instance
// ถ้า deploy หลาย instance (Vercel serverless) ควรย้ายไป Redis หรือเก็บ summary ลง DB
type CacheEntry = { value: string; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 นาที

function getCache(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCache(key: string, value: string) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function hashKey(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

type GeminiCallResult =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string; retryAfter?: number };

// ── เรียก Gemini พร้อม retry (exponential backoff + RetryInfo) ──
async function callGemini(
  prompt: string,
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
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
            },
          }),
        },
      );

      clearTimeout(timeout);
      const data = (await res.json()) as GeminiContentResponse &
        GeminiErrorResponse;

      // สำเร็จ
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
        const delaySec = retrySec ?? Math.pow(2, attempt); // 1, 2, 4 วินาที

        // ถ้าเป็นความพยายามครั้งสุดท้าย → คืน error ออกไป
        if (attempt === maxRetries) {
          return {
            ok: false,
            status: 429,
            message: friendlyGeminiError(429, data),
            retryAfter: Math.ceil(delaySec),
          };
        }

        console.warn(
          `Gemini 429 — retry ครั้งที่ ${attempt + 1}/${maxRetries} ในอีก ${delaySec.toFixed(1)}s`,
        );
        await new Promise((r) => setTimeout(r, delaySec * 1000));
        continue;
      }

      // error อื่นๆ (4xx/5xx ที่ไม่ใช่ 429) → ไม่ retry
      console.error("Gemini API Error:", data);
      return {
        ok: false,
        status: res.status,
        message: friendlyGeminiError(res.status, data),
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const aborted = err instanceof Error && err.name === "AbortError";

      // timeout / network error → ลอง retry ถ้ายังไม่หมดโควต้ารอบ
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
    // ── Rate limit: ตาม user (fallback IP) — 15 ครั้ง / 5 นาที ──
    const user = await getUsername();
    const rlKey = user
      ? `ai:summarize:${user}`
      : `ai:summarize:ip:${getClientIp(req)}`;
    const rl = await rateLimit(rlKey, 15, 5 * 60_000);
    if (!rl.ok) {
      return tooManyRequests(rl, "เรียกใช้ AI บ่อยเกินไป กรุณารอสักครู่");
    }

    const { summary } = (await req.json()) as { summary: unknown };

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
- ต้อง actionable เช่น "ควรเพิ่ม...", "ควรเฝ้าระวัง..."

ข้อห้าม:
- ห้ามแต่งตัวเลขเอง
- ห้ามเดาข้อมูล
- ถ้าข้อมูลไม่พอให้บอกว่า "ข้อมูลไม่เพียงพอ"

ข้อมูล:
${JSON.stringify(summary, null, 2)}
`;

    // ── เช็ค cache ก่อน: input เดิม = ไม่ต้องเรียก Gemini ซ้ำ ──
    const cacheKey = hashKey(prompt);
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json({ summary: cached, cached: true });
    }

    const result = await callGemini(prompt);

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

    setCache(cacheKey, result.text);
    return NextResponse.json({ summary: result.text });
  } catch (error) {
    console.error("Gemini summarize error:", error);
    return NextResponse.json(
      { error: "สรุปข้อมูลไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
