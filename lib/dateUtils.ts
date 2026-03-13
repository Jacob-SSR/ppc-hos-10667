export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatThaiDate(val: any): string {
    if (!val) return "";

    const str = String(val);

    if (str.includes("/")) return str;

    if (str.includes("T")) {
        const date = new Date(str);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${d}/${m}/${y + 543}`;
    }

    const [y, m, d] = str.split("-");
    if (!y || !m || !d) return str;
    return `${d}/${m}/${Number(y) + 543}`;
}