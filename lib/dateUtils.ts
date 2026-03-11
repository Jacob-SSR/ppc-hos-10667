export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatThaiDate(val: any): string {
    if (!val) return "";

    const str = String(val);

    // กรณีมีเวลา (2026-03-05T00:00:00.000Z)
    if (str.includes("T")) {
        const date = new Date(str);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${d}/${m}/${y + 543}`;
    }

    // กรณีเป็น yyyy-mm-dd
    const [y, m, d] = str.split("T")[0].split("-");
    return `${d}/${m}/${Number(y) + 543}`;
}