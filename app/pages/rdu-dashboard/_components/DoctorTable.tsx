import { TARGETS } from "@/lib/rdu.constants";
import type { RduDoctorRow } from "@/lib/rdu.types";
import { getDeptColor } from "../_utils/deptColor";

function initials(name: string) {
    const p = name.replace(/นพ\.|พญ\.|พว\.|ทพ\.|ทพญ\.|นาย|นาง|น\.ส\.|นางสาว/g, "").trim().split(/\s+/);
    return (p[0]?.[0] ?? "") + (p[1]?.[0] ?? "");
}

function cellColor(pct: number, target: number) {
    if (pct === 0) return "text-gray-300";
    if (pct <= target) return "text-green-700 font-semibold";
    if (pct <= target * 1.2) return "text-amber-600 font-semibold";
    return "text-red-700 font-bold";
}

function statusBadge(dr: RduDoctorRow) {
    let fails = 0;
    if (dr.uri_total > 0 && dr.uri_pct > TARGETS.uri) fails++;
    if (dr.dia_total > 0 && dr.dia_pct > TARGETS.dia) fails++;
    if (dr.wound_total > 0 && dr.wound_pct > TARGETS.wound) fails++;
    if (dr.peri_total > 0 && dr.peri_pct > TARGETS.peri) fails++;
    if (fails === 0) return { label: "ผ่านเกณฑ์ทุกโรค", cls: "bg-green-100 text-green-800" };
    if (fails === 1) return { label: "ทบทวน 1 รายการ", cls: "bg-amber-100 text-amber-700" };
    return { label: "ต้องปรับปรุง", cls: "bg-red-100 text-red-700" };
}

export function DoctorTable({
    doctors, activeDr, loading, onSelect,
}: {
    doctors: RduDoctorRow[];
    activeDr: string;
    loading: boolean;
    onSelect: (dr: RduDoctorRow) => void;
}) {
    if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

    return (
        <>
            <div className="max-h-96 overflow-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-green-700 sticky top-0">
                            {["แพทย์ / ผู้สั่งจ่าย", "ตำแหน่ง", "Visit", "URI %", "Diarrhea %", "แผลสด %", "ฝีเย็บ %", "สถานะ"].map(h => (
                                <th key={h} className="px-3 py-2.5 text-left text-white font-semibold border-r border-green-600 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {doctors.map((dr, i) => {
                            const s = statusBadge(dr);
                            const base = activeDr === dr.doctor_code ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";
                            return (
                                <tr key={`${dr.doctor_code}-${i}`}
                                    onClick={() => onSelect(dr)}
                                    className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/60 transition-colors ${base}`}>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                style={{ background: getDeptColor(dr.dept) }}>
                                                {initials(dr.doctor_name)}
                                            </div>
                                            <span className="font-semibold text-gray-800">{dr.doctor_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ background: getDeptColor(dr.dept) + "20", color: getDeptColor(dr.dept) }}>
                                            {dr.dept || "—"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">{dr.visits}</td>
                                    <td className={`px-3 py-2.5 text-right ${dr.uri_total > 0 ? cellColor(dr.uri_pct, TARGETS.uri) : "text-gray-300"}`}>
                                        {dr.uri_total > 0 ? dr.uri_pct + "%" : "—"}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right ${dr.dia_total > 0 ? cellColor(dr.dia_pct, TARGETS.dia) : "text-gray-300"}`}>
                                        {dr.dia_total > 0 ? dr.dia_pct + "%" : "—"}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right ${dr.wound_total > 0 ? cellColor(dr.wound_pct, TARGETS.wound) : "text-gray-300"}`}>
                                        {dr.wound_total > 0 ? dr.wound_pct + "%" : "—"}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right ${dr.peri_total > 0 ? cellColor(dr.peri_pct, TARGETS.peri) : "text-gray-300"}`}>
                                        {dr.peri_total > 0 ? dr.peri_pct + "%" : "—"}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!doctors.length && (
                            <tr><td colSpan={8} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="text-xs text-gray-400 mt-2">เกณฑ์: URI ≤20% · Diarrhea ≤20% · แผลสด ≤40% · ฝีเย็บ ≤10%</div>
        </>
    );
}