import { TARGETS } from "@/lib/rdu.constants";
import type { RduDoctorRow } from "@/lib/rdu.types";
import { getDeptColor } from "../_utils/deptColor";

function initials(name: string) {
    const p = name.replace(/นพ\.|พญ\.|พว\.|ทพ\.|ทพญ\.|นาย|นาง|น\.ส\.|นางสาว/g, "").trim().split(/\s+/);
    return (p[0]?.[0] ?? "") + (p[1]?.[0] ?? "");
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

function StatCell({ label, total, rx, target }: { label: string; total: number; rx: number; target: number }) {
    if (total === 0) return (
        <div className="p-3 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-[10px] text-gray-400 mb-1">{label}</div>
            <div className="text-sm font-bold text-gray-300">—</div>
        </div>
    );
    const pct = Math.round((rx / total) * 1000) / 10;
    const pass = pct <= target;
    return (
        <div className={`p-3 border rounded-xl text-center ${pass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="text-[10px] text-gray-500 mb-1">{label} (≤{target}%)</div>
            <div className={`text-xl font-extrabold ${pass ? "text-green-700" : "text-red-600"}`}>{pct}%</div>
        </div>
    );
}

export function DoctorProfile({ dr }: { dr: RduDoctorRow }) {
    const s = statusBadge(dr);
    return (
        <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ background: getDeptColor(dr.dept) }}>
                    {initials(dr.doctor_name)}
                </div>
                <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{dr.doctor_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        {dr.dept || "—"} · <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                    </div>
                </div>
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                % การสั่งยาปฏิชีวนะใน 4 โรคเป้าหมาย
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <StatCell label="URI" total={dr.uri_total} rx={dr.uri_rx} target={TARGETS.uri} />
                <StatCell label="Diarrhea" total={dr.dia_total} rx={dr.dia_rx} target={TARGETS.dia} />
                <StatCell label="แผลสด" total={dr.wound_total} rx={dr.wound_rx} target={TARGETS.wound} />
                <StatCell label="ฝีเย็บ" total={dr.peri_total} rx={dr.peri_rx} target={TARGETS.peri} />
            </div>
            <div className="text-xs text-gray-500">
                <strong>Visit:</strong> {dr.visits} ราย &nbsp;·&nbsp; <strong>หน่วย:</strong> {dr.dept || "—"}
            </div>
        </div>
    );
}