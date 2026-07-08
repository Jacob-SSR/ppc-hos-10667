"use client";

import { useState } from "react";
import { Clock, Pill, Stethoscope, FlaskConical, Scan, ClipboardList, Flag } from "lucide-react";
import type { ServiceTimeData, StageStat } from "@/lib/servicetime.types";
import { C, STAGE_META, timeColor } from "./helpers";
import { Segmented } from "./Segmented";

// ─── VSM / Flowchart (ผังกระบวนการ OPD — ค่าจริง) ─────────────────────────────
// การ์ด = ขั้น "ดำเนินงาน" (Process Time จริง) · ลูกศร = ขั้น "รอ" (Waiting Time จริง)
// Lab / X-ray = ส่งตรวจจากห้องตรวจ แล้ว "ผลกลับห้องตรวจ" (ไม่ได้ไปรับยาโดยตรง)
type FlowMetric = "avg" | "median";

// พาสเทล
const P = {
    cardBg: "#f4f8ff", cardBorder: "#e2ebfa",
    icon: "#4f7ce0", iconBg: "#e8f0fd",
    ink: "#3a5488",
    name: "#3c4a63",
    waitInk: "#5b6b8c",
    arrow: "#3f6fd6", arrowDash: "#b6cbf0",
    loopBg: "#fbfcff", loopBorder: "#cdd9f0",
    tatBg: "#fff8ea", tatBorder: "#f6e4b8", tatInk: "#e6a12a", tatIconBg: "#fceccb",
    endBg: "#ecfaf2", endBorder: "#c1e9d5", endInk: "#12a06a", endIconBg: "#d8f3e6",
};

// นาที (ทศนิยมได้) → "H:MM:SS"
const toHMS = (min: number | null): string => {
    if (min == null) return "-";
    const totalSec = Math.max(0, Math.round(min * 60));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const pickVal = (s: StageStat | null, metric: FlowMetric) =>
    s ? (metric === "median" ? s.stat.median : s.stat.avg) : null;
const inkOf = (stage: StageStat | null) =>
    stage && stage.target != null ? timeColor(stage.stat.avg, stage.target).accent : P.ink;

// จุดเริ่มต้น
function StartNode() {
    return (
        <div className="flex h-full flex-col items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2" style={{ borderColor: P.arrow, backgroundColor: P.iconBg }}>
                <Flag size={18} style={{ color: P.icon }} />
            </div>
            <span className="mt-1 text-center text-[10px] font-semibold leading-tight text-gray-500">ยื่นบัตร</span>
        </div>
    );
}

// การ์ดขั้น "ดำเนินงาน" (Process Time จริง)
function FlowCard({
    stage, icon: Icon, metric, tone = "blue", label, tall = false,
}: {
    stage: StageStat | null;
    icon: React.ElementType;
    metric: FlowMetric;
    tone?: "blue" | "green";
    label?: string;
    tall?: boolean;
}) {
    const green = tone === "green";
    const v = pickVal(stage, metric);
    const perf = inkOf(stage);
    const timeInk = green ? (stage?.target != null ? perf : P.endInk) : perf;
    const name = label ?? (stage ? STAGE_META[stage.key]?.short ?? stage.label : "");
    return (
        <div
            className={`relative flex w-full flex-col items-center rounded-2xl border px-4 py-3 text-center shadow-sm transition-shadow hover:shadow-md ${tall ? "h-full justify-center" : ""}`}
            style={{ backgroundColor: green ? P.endBg : P.cardBg, borderColor: green ? P.endBorder : P.cardBorder }}
        >
            <div className={`mb-1.5 flex items-center justify-center rounded-xl ${tall ? "h-16 w-16" : "h-11 w-11"}`} style={{ backgroundColor: green ? P.endIconBg : P.iconBg }}>
                <Icon size={tall ? 36 : 24} style={{ color: green ? P.endInk : P.icon }} />
            </div>
            <div className={`font-bold ${tall ? "text-lg" : "text-sm"}`} style={{ color: green ? P.endInk : P.name }}>{name}</div>
            <div className={`mt-0.5 font-extrabold tabular-nums ${tall ? "text-3xl" : "text-xl"}`} style={{ color: timeInk }}>{toHMS(v)}</div>
            <div className="text-[10px] text-gray-400">Process Time</div>
        </div>
    );
}

// ลูกศรแนวนอน + ป้ายเวลา "รอ" จริง (stage) — หรือลูกศรเปล่า (plain)
function WaitLink({
    stage = null, metric = "avg", label, dashed = false, plain = false,
}: { stage?: StageStat | null; metric?: FlowMetric; label?: string; dashed?: boolean; plain?: boolean }) {
    const col = dashed ? P.arrowDash : P.arrow;
    const v = stage ? pickVal(stage, metric) : null;
    const ink = stage && stage.target != null ? timeColor(stage.stat.avg, stage.target).accent : P.waitInk;
    return (
        <div className="flex h-full w-full flex-col items-center justify-center px-1">
            {!plain && (
                <div className="mb-1 flex flex-col items-center leading-tight">
                    {label && <span className="text-[10px] font-semibold text-gray-500">{label}</span>}
                    <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400">waiting time</span>
                    <span className="text-[13px] font-extrabold tabular-nums" style={{ color: ink }}>{toHMS(v)}</span>
                </div>
            )}
            <div className="flex w-full items-center">
                <div className="flex-1" style={dashed ? { borderTop: `2px dashed ${col}` } : { height: 2, background: col }} />
                <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `8px solid ${col}` }} />
            </div>
        </div>
    );
}

// ลูกศรคู่แนวตั้ง ตรวจ ⇅ Lab/X-ray — ลงทึบ = ส่งตรวจ · ขึ้นประ = ผลกลับห้องตรวจ
function LoopArrows() {
    return (
        <div className="flex items-center justify-center gap-6 py-1">
            <div className="flex flex-col items-center">
                <span className="mb-0.5 text-[9px] font-semibold text-gray-500">ส่งตรวจ</span>
                <div style={{ width: 2, height: 26, background: P.arrow }} />
                <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${P.arrow}` }} />
            </div>
            <div className="flex flex-col items-center">
                <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `7px solid ${P.arrowDash}` }} />
                <div style={{ width: 0, height: 26, borderLeft: `2px dashed ${P.arrowDash}` }} />
                <span className="mt-0.5 text-[9px] font-semibold text-gray-400">ผลกลับห้องตรวจ</span>
            </div>
        </div>
    );
}

// สาขา Lab / X-ray — ป้ายเวลารอ + การ์ด (อยู่ในกล่องส่งตรวจเพิ่มเติม)
function BranchItem({
    waitStage, procStage, waitLabel, icon, cardLabel, metric,
}: {
    waitStage: StageStat | null;
    procStage: StageStat | null;
    waitLabel: string;
    icon: React.ElementType;
    cardLabel: string;
    metric: FlowMetric;
}) {
    return (
        <div className="flex items-center gap-1">
            <div className="w-[86px]">
                <WaitLink stage={waitStage} metric={metric} label={waitLabel} dashed />
            </div>
            <div className="w-[130px]">
                <FlowCard stage={procStage} icon={icon} metric={metric} label={cardLabel} />
            </div>
        </div>
    );
}

// ─── แผงผังกระบวนการ (Flow view) ─────────────────────────────────────────────
export function FlowVSM({ data }: { data: ServiceTimeData }) {
    const [metric, setMetric] = useState<FlowMetric>("avg");
    const byKey = (k: string) => data.allStages.find((s) => s.key === k) ?? null;
    const total = data.summary.total;
    const tv = pickVal(total, metric);
    const [h, m, s2] = (() => {
        if (tv == null) return ["-", "--", "--"];
        const totalSec = Math.max(0, Math.round(tv * 60));
        return [String(Math.floor(totalSec / 3600)), String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0"), String(totalSec % 60).padStart(2, "0")];
    })();
    const updated = (() => {
        try { return new Date(data.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }
        catch { return "-"; }
    })();

    const cell = "flex items-center justify-center";

    return (
        <div>
            {/* แถบควบคุม */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">แสดงค่า:</span>
                    <Segmented value={metric} options={[{ key: "avg", label: "เฉลี่ย" }, { key: "median", label: "มัธยฐาน" }]} onChange={setMetric} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded-sm border" style={{ background: P.cardBg, borderColor: P.cardBorder }} /> การ์ด = ดำเนินงาน</span>
                    <span className="inline-flex items-center gap-1"><svg width="18" height="8"><line x1="0" y1="4" x2="12" y2="4" stroke={P.arrow} strokeWidth="2" /><path d="M12 1 L18 4 L12 7 Z" fill={P.arrow} /></svg> ลูกศร = รอ</span>
                    <span className="mx-1 h-3 w-px bg-gray-200" />
                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.green }} /> ผ่านเกณฑ์</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} /> เกินเล็กน้อย</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.red }} /> เกินมาก</span>
                </div>
            </div>

            {/* TAT รวม */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-3xl border px-6 py-5" style={{ backgroundColor: P.tatBg, borderColor: P.tatBorder }}>
                <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: P.tatIconBg }}>
                        <Clock size={30} style={{ color: P.tatInk }} />
                    </div>
                    <span className="text-lg font-bold text-gray-700">
                        TAT {metric === "median" ? "มัธยฐาน" : "เฉลี่ย"}รวม <span className="text-sm font-normal text-gray-400">(นาที)</span>
                    </span>
                </div>
                <div className="flex items-start gap-2">
                    {[{ v: h, u: "ชั่วโมง" }, { v: m, u: "นาที" }, { v: s2, u: "วินาที" }].map((x, i) => (
                        <div key={x.u} className="flex items-start">
                            {i > 0 && <span className="text-4xl font-extrabold leading-[1.1] md:text-5xl" style={{ color: P.tatInk }}>:</span>}
                            <div className="flex flex-col items-center">
                                <span className="text-5xl font-extrabold leading-none tabular-nums md:text-6xl" style={{ color: P.tatInk }}>{x.v}</span>
                                <span className="mt-1 text-xs text-gray-400">{x.u}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ผังกระบวนการ (flowchart ค่าจริง) */}
            <div className="overflow-x-auto pb-2">
                <div
                    className="grid items-stretch"
                    style={{
                        gridTemplateColumns:
                            "minmax(64px,auto) minmax(90px,1fr) minmax(120px,auto) minmax(90px,1fr) minmax(140px,auto) minmax(90px,1fr) minmax(186px,auto)",
                        minWidth: 980,
                        columnGap: 2,
                    }}
                >
                    {/* แถวบน: ยื่นบัตร →(รอคัดกรอง)→ คัดกรอง →(รอตรวจ)→ ตรวจ →→ รอรับยา */}
                    <div className={cell} style={{ gridColumn: 1, gridRow: 1 }}><StartNode /></div>
                    <div className={cell} style={{ gridColumn: 2, gridRow: 1 }}><WaitLink stage={byKey("wait_screening")} metric={metric} label="รอคัดกรอง" /></div>
                    <div className={cell} style={{ gridColumn: 3, gridRow: 1 }}><FlowCard stage={byKey("screening")} icon={ClipboardList} metric={metric} label="คัดกรอง" /></div>
                    <div className={cell} style={{ gridColumn: 4, gridRow: 1 }}><WaitLink stage={byKey("wait_doctor")} metric={metric} label="รอตรวจ" /></div>
                    <div className={cell} style={{ gridColumn: 5, gridRow: 1 }}><FlowCard stage={byKey("consult")} icon={Stethoscope} metric={metric} label="ตรวจ" /></div>
                    <div className={cell} style={{ gridColumn: 6, gridRow: 1 }}><WaitLink plain /></div>

                    {/* ปลายทาง รอรับยา */}
                    <div className="flex" style={{ gridColumn: 7, gridRow: "1 / 4" }}><FlowCard stage={byKey("wait_pharmacy")} icon={Pill} metric={metric} tone="green" label="รอรับยา" tall /></div>

                    {/* ตรวจ ⇅ Lab/X-ray — ส่งตรวจแล้วผลกลับห้องตรวจ */}
                    <div className={cell} style={{ gridColumn: 5, gridRow: 2 }}><LoopArrows /></div>

                    {/* กล่องส่งตรวจเพิ่มเติม: Lab / X-ray (ผลกลับห้องตรวจ ไม่ได้ไปรับยาโดยตรง) */}
                    <div style={{ gridColumn: "3 / 7", gridRow: 3 }}>
                        <div className="mx-auto w-fit rounded-2xl border border-dashed px-5 py-4" style={{ backgroundColor: P.loopBg, borderColor: P.loopBorder }}>
                            <div className="mb-3 text-center text-[11px] font-semibold text-gray-500">
                                ส่งตรวจเพิ่มเติม (บางราย) — เสร็จแล้ว<span style={{ color: P.icon }}>กลับห้องตรวจ</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                                <BranchItem
                                    waitStage={byKey("lab_wait")} procStage={byKey("lab_process")}
                                    waitLabel="รอแลป" icon={FlaskConical} cardLabel="LAB" metric={metric}
                                />
                                <BranchItem
                                    waitStage={byKey("xray_wait")} procStage={byKey("xray_process")}
                                    waitLabel="รอ X-ray" icon={Scan} cardLabel="X-ray" metric={metric}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* หมายเหตุ */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1">
                    <Clock size={12} /> เวลาแสดงเป็น ชั่วโมง : นาที : วินาที (ค่า{metric === "median" ? "มัธยฐาน" : "เฉลี่ย"}จริงในช่วงที่เลือก) ·
                    การ์ด = เวลาดำเนินงาน · ลูกศร = เวลารอจริง · Lab / X-ray ส่งตรวจจากห้องตรวจแล้วผลกลับห้องตรวจ ก่อนไปรอรับยา · ตัวเลขจับสีเฉพาะขั้นที่มีเกณฑ์
                </span>
                <span>อัปเดตล่าสุด {updated} น.</span>
            </div>
        </div>
    );
}