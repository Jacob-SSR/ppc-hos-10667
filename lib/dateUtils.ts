export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatThaiDate(val: any): string {
    if (!val) return "";

    const str = String(val);

    // already formatted
    if (str.includes("/")) return str;

    // ISO datetime: 2026-03-13T07:27:26.000Z — ตัด time ออก เอาแค่วันที่
    if (str.includes("T")) {
        const datePart = str.split("T")[0];
        const [y, m, d] = datePart.split("-");
        if (!y || !m || !d) return str;
        return `${d}/${m}/${Number(y) + 543}`;
    }

    // date only: 2026-03-13
    const parts = str.split("-");
    if (parts.length === 3) {
        const [y, m, d] = parts;
        if (!y || !m || !d) return str;
        return `${d}/${m}/${Number(y) + 543}`;
    }

    return str;
}