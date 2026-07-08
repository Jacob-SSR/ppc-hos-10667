"use client";

import { Workflow, LayoutDashboard } from "lucide-react";

// ─── Tab bar (สลับมุมมอง ภาพรวม ⇄ ผังกระบวนการ) ──────────────────────────────
export type View = "flow" | "overview";
export const VIEWS: { key: View; label: string; icon: React.ElementType }[] = [
    { key: "flow", label: "ผังกระบวนการ (Flow)", icon: Workflow },
    { key: "overview", label: "ภาพรวม / เชิงลึก", icon: LayoutDashboard },
];

export function TabBar({ value, onChange }: { value: View; onChange: (v: View) => void }) {
    return (
        <div className="flex items-center gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
            {VIEWS.map((v) => {
                const active = v.key === value;
                return (
                    <button
                        key={v.key}
                        onClick={() => onChange(v.key)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${active
                            ? "border-green-700 text-green-700"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        <v.icon size={16} /> {v.label}
                    </button>
                );
            })}
        </div>
    );
}