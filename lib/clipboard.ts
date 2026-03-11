// lib/clipboard.ts
// ใช้ร่วมกันทุกหน้า: report, no-endpoint, uc-outside-dental, uc-outside

/** คัดลอก value ลง clipboard (รองรับ browser เก่าที่ไม่มี navigator.clipboard) */
export function copyToClipboard(value: any): void {
    const text = String(value);

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        return;
    }

    // Fallback สำหรับ browser เก่า
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
}