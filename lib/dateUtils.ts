export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatThaiDate(val: any): string {
    if (!val) return "";

    const str = String(val);

    // already formatted as dd/mm/yyyy
    if (str.includes("/")) return str;

    // ISO datetime: มี T หรือ Z → ต้องคำนึง timezone Asia/Bangkok
    if (str.includes("T") || str.includes("Z")) {
        const date = new Date(str);
        if (isNaN(date.getTime())) return str;
        const parts = date.toLocaleDateString("en-GB", {
            timeZone: "Asia/Bangkok",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).split("/");
        if (parts.length !== 3) return str;
        const [d, m, y] = parts;
        return `${d}/${m}/${Number(y) + 543}`;
    }

    // date only: 2026-03-13 (ไม่มี timezone)
    const parts = str.split("-");
    if (parts.length === 3) {
        const [y, m, d] = parts;
        if (!y || !m || !d) return str;
        return `${d}/${m}/${Number(y) + 543}`;
    }

    return str;
}