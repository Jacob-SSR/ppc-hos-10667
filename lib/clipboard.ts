export function copyToClipboard(value: any): void {
    const text = String(value);

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        return;
    }

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