"use client";

// ─── Segmented control ────────────────────────────────────────────────────────
export function Segmented<T extends string>({
    value, options, onChange,
}: { value: T; options: { key: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {options.map((o) => (
                <button
                    key={o.key}
                    onClick={() => onChange(o.key)}
                    title={o.title}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${value === o.key ? "bg-green-700 text-white font-semibold" : "text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// ─── ป้ายกำกับกลุ่มตัวกรอง (label เล็ก + control) ───────────────────────────────
export function Field({
    label, icon: Icon, children,
}: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {Icon && <Icon size={11} />}
                {label}
            </span>
            {children}
        </div>
    );
}