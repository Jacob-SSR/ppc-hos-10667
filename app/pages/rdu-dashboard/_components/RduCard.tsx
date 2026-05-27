import { Wind, Droplets, Scissors, Baby } from "lucide-react";
import type { RduDiseaseRow } from "@/lib/rdu.types";

const DISEASE_ICONS = { uri: Wind, dia: Droplets, wound: Scissors, peri: Baby } as const;

export function RduCard({ d, loading }: { d?: RduDiseaseRow; loading: boolean }) {
    if (loading || !d) return <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />;

    const ratio = d.current / d.target;
    let badgeCls = "bg-green-100 text-green-800", badgeLabel = "ผ่านเป้า", fill = "#16a34a";
    if (ratio > 1.2) { badgeCls = "bg-red-100 text-red-700"; badgeLabel = "ไม่ผ่าน"; fill = "#dc2626"; }
    else if (ratio > 1) { badgeCls = "bg-amber-100 text-amber-700"; badgeLabel = "เกินเป้า"; fill = "#d97706"; }

    const fillPct = Math.min(100, (d.current / Math.max(d.target * 2, d.current + 5)) * 100);
    const Icon = DISEASE_ICONS[d.key as keyof typeof DISEASE_ICONS];

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <span className={`absolute top-4 right-4 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
                {badgeLabel}
            </span>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: d.color + "18" }}>
                    <Icon size={20} style={{ color: d.color }} strokeWidth={1.8} />
                </div>
                <div>
                    <div className="text-sm font-bold text-gray-800 leading-snug">{d.name}</div>
                    <div className="text-[11px] text-gray-400 leading-snug">{d.full}</div>
                </div>
            </div>
            <div className="text-4xl font-extrabold text-gray-900 leading-none mb-1">
                {d.current}<span className="text-lg font-medium text-gray-400 ml-1">%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden my-3">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${fillPct}%`, background: fill }} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
                <span>เป้าหมาย <strong className="text-gray-600">≤ {d.target}%</strong></span>
                <span><strong className="text-gray-700">{d.rxN}</strong>/{d.visits} ราย</span>
            </div>
        </div>
    );
}