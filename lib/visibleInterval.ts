// lib/visibleInterval.ts
// ─────────────────────────────────────────────────────────────────────────────
// setInterval ที่ "หยุดเองเมื่อผู้ใช้ไม่ได้ดูหน้านั้น"
//
// ปัญหาเดิม: dashboard poll ทุก 30–60 วินาทีตลอดเวลา ไม่สนว่าแท็บถูกซ่อนอยู่
// จอทีวีที่แขวนไว้ + คนเปิดค้างคนละ 10 แท็บ = ยิง request ทั้งคืนโดยไม่มีใครดู
//
// พฤติกรรมใหม่:
//   - แท็บถูกซ่อน (document.hidden) → ข้ามรอบนั้นไป ไม่ยิง
//   - กลับมาดูอีกครั้ง → ถ้ามีรอบที่ข้ามไป ยิงทันที 1 ครั้ง ข้อมูลจึงสดเสมอ
//     (ผู้ใช้ไม่รู้สึกต่างเลย แต่ traffic หายไปครึ่งหนึ่งขึ้นไป)
// ─────────────────────────────────────────────────────────────────────────────

/** เริ่ม interval แบบหยุดตอนแท็บซ่อน — คืนฟังก์ชันสำหรับ cleanup */
export function visibleInterval(tick: () => void, ms: number): () => void {
  const hidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  let missed = false;

  const id = setInterval(() => {
    if (hidden()) {
      missed = true; // จำไว้ว่าค้างรอบไว้ เดี๋ยวกลับมาค่อยยิงชดเชย
      return;
    }
    tick();
  }, ms);

  const onVisibility = () => {
    if (!hidden() && missed) {
      missed = false;
      tick(); // กลับมาดู → ให้เห็นของสดทันที ไม่ต้องรอครบรอบ
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    clearInterval(id);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
