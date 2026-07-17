"use client";

// ── ตารางสรุป: เจ้าหน้าที่ / การพัฒนา / ความเร่งด่วน / ความสำเร็จทันเวลา ──
// อ้างอิงรูปแบบตารางสรุปจากรายงานเดิม (หัวตารางเข้ม + แถวสลับสี + ร้อยละ)

const HEAD_BG = "#236b43";
const HEAD_BORDER = "#1a5233";
const STRIPE = "#f0faf4";

interface SummaryRow {
    label: string;
    count: number;
    highlight?: boolean; // แถวเชิงลบ (ไม่ทันเวลา ฯลฯ)
}

const pct = (count: number, total: number) =>
    total > 0 ? `${((count / total) * 100).toFixed(2)}%` : "0.00%";

function SummaryTable({
    title,
    countLabel,
    rows,
    total,
    numbered = false,
}: {
    title: string;
    countLabel: string;
    rows: SummaryRow[];
    total: number;
    numbered?: boolean;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-[#d6f0e0]">
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr>
                        {numbered && (
                            <th
                                className="text-white px-2 md:px-3 py-2 text-left font-semibold w-8 border-r"
                                style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                            />
                        )}
                        <th
                            className="text-white px-2 md:px-3 py-2 text-left font-semibold whitespace-nowrap border-r"
                            style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                        >
                            {title}
                        </th>
                        <th
                            className="text-white px-2 md:px-3 py-2 text-right font-semibold whitespace-nowrap border-r w-24"
                            style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                        >
                            {countLabel}
                        </th>
                        <th
                            className="text-white px-2 md:px-3 py-2 text-right font-semibold whitespace-nowrap w-20"
                            style={{ backgroundColor: HEAD_BG }}
                        >
                            ร้อยละ
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr
                            key={r.label}
                            className="border-b border-[#e8f5ee] last:border-b-0"
                            style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : STRIPE }}
                        >
                            {numbered && (
                                <td className="px-2 md:px-3 py-2 text-gray-400 tabular-nums">
                                    {i + 1}.
                                </td>
                            )}
                            <td
                                className={`px-2 md:px-3 py-2 whitespace-nowrap ${r.highlight ? "text-red-600 font-medium" : "text-gray-700"}`}
                            >
                                {r.label}
                            </td>
                            <td className="px-2 md:px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                                {r.count.toLocaleString()}
                            </td>
                            <td
                                className={`px-2 md:px-3 py-2 text-right font-bold tabular-nums ${r.highlight ? "text-red-600" : "text-gray-800"}`}
                            >
                                {pct(r.count, total)}
                            </td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={numbered ? 4 : 3}
                                className="px-3 py-3 text-center text-gray-400"
                            >
                                ไม่มีข้อมูล
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export interface ActivityCross {
    total: number;
    devUrgent: number;
    devNotUrgent: number;
    notDevUrgent: number;
    notDevNotUrgent: number;
    devUrgentPct: number;
    devNotUrgentPct: number;
    notDevUrgentPct: number;
    notDevNotUrgentPct: number;
}

// เซลล์ในตารางไขว้: จำนวน + ร้อยละของงานทั้งหมด
function CrossCell({
    count,
    pctValue,
    highlight,
}: {
    count: number;
    pctValue: number;
    highlight?: "good" | "bad";
}) {
    const color =
        highlight === "bad"
            ? "text-red-600"
            : highlight === "good"
                ? "text-[#1a5233]"
                : "text-gray-800";
    return (
        <td className="px-2 md:px-3 py-2 text-right tabular-nums border-r border-[#e8f5ee] last:border-r-0">
            <span className={`font-semibold ${color}`}>{count.toLocaleString()}</span>
            <span className={`ml-1 text-[11px] ${color} opacity-80`}>
                ({pctValue.toFixed(2)}%)
            </span>
        </td>
    );
}

export function SummaryTablesSection({
    staffLoad,
    totalJobs,
    devCount,
    urgentCount,
    onTimeCount,
    activityCross,
}: {
    staffLoad: { name: string; count: number }[];
    totalJobs: number;
    devCount: number;
    urgentCount: number;
    onTimeCount: number;
    activityCross: ActivityCross;
}) {
    const c = activityCross;
    return (
        <div className="bg-white border border-[#d6f0e0] rounded-2xl p-3 md:p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700">ตารางสรุปภาพรวม</h4>
                <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                    style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba", color: "#1a5233" }}
                >
                    {totalJobs.toLocaleString()} รายการ
                </span>
            </div>

            {/* เจ้าหน้าที่ไอที */}
            <SummaryTable
                title="ชื่อเจ้าหน้าที่ไอที"
                countLabel="จำนวนบันทึก"
                rows={staffLoad.map((s) => ({ label: s.name, count: s.count }))}
                total={totalJobs}
                numbered
            />

            {/* การพัฒนา + ความเร่งด่วน */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SummaryTable
                    title="การพัฒนา"
                    countLabel="จำนวน"
                    rows={[
                        { label: "พัฒนา", count: devCount },
                        { label: "ไม่พัฒนา", count: totalJobs - devCount },
                    ]}
                    total={totalJobs}
                />
                <SummaryTable
                    title="ความเร่งด่วน"
                    countLabel="จำนวน"
                    rows={[
                        { label: "เร่งด่วน", count: urgentCount },
                        { label: "ไม่เร่งด่วน", count: totalJobs - urgentCount },
                    ]}
                    total={totalJobs}
                />
            </div>

            {/* ความสำเร็จ ทันเวลา */}
            <SummaryTable
                title="ความสำเร็จ ทันเวลา"
                countLabel="จำนวน"
                rows={[
                    { label: "ทันเวลา", count: onTimeCount },
                    { label: "ไม่ทันเวลา", count: totalJobs - onTimeCount, highlight: true },
                ]}
                total={totalJobs}
            />

            {/* ── วิเคราะห์ Activity IT: ตารางไขว้ การพัฒนา × ความเร่งด่วน ── */}
            <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-700">
                    วิเคราะห์ Activity IT (การพัฒนา × ความเร่งด่วน)
                </h4>
                <div className="overflow-hidden rounded-xl border border-[#d6f0e0]">
                    <table className="min-w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th
                                    className="text-white px-2 md:px-3 py-2 text-left font-semibold border-r"
                                    style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                                >
                                    ความเร่งด่วน \ การพัฒนา
                                </th>
                                <th
                                    className="text-white px-2 md:px-3 py-2 text-right font-semibold border-r"
                                    style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                                >
                                    งานพัฒนา
                                </th>
                                <th
                                    className="text-white px-2 md:px-3 py-2 text-right font-semibold border-r"
                                    style={{ backgroundColor: HEAD_BG, borderColor: HEAD_BORDER }}
                                >
                                    ไม่พัฒนา
                                </th>
                                <th
                                    className="text-white px-2 md:px-3 py-2 text-right font-semibold"
                                    style={{ backgroundColor: HEAD_BG }}
                                >
                                    รวม
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-[#e8f5ee]" style={{ backgroundColor: "#ffffff" }}>
                                <td className="px-2 md:px-3 py-2 text-gray-700 font-medium border-r border-[#e8f5ee]">
                                    เร่งด่วน
                                </td>
                                <CrossCell count={c.devUrgent} pctValue={c.devUrgentPct} />
                                <CrossCell count={c.notDevUrgent} pctValue={c.notDevUrgentPct} highlight="bad" />
                                <CrossCell
                                    count={c.devUrgent + c.notDevUrgent}
                                    pctValue={c.devUrgentPct + c.notDevUrgentPct}
                                />
                            </tr>
                            <tr className="border-b border-[#e8f5ee]" style={{ backgroundColor: STRIPE }}>
                                <td className="px-2 md:px-3 py-2 text-gray-700 font-medium border-r border-[#e8f5ee]">
                                    ไม่เร่งด่วน
                                </td>
                                <CrossCell count={c.devNotUrgent} pctValue={c.devNotUrgentPct} highlight="good" />
                                <CrossCell count={c.notDevNotUrgent} pctValue={c.notDevNotUrgentPct} />
                                <CrossCell
                                    count={c.devNotUrgent + c.notDevNotUrgent}
                                    pctValue={c.devNotUrgentPct + c.notDevNotUrgentPct}
                                />
                            </tr>
                            <tr style={{ backgroundColor: "#ffffff" }}>
                                <td className="px-2 md:px-3 py-2 text-gray-700 font-bold border-r border-[#e8f5ee]">
                                    รวม
                                </td>
                                <CrossCell
                                    count={c.devUrgent + c.devNotUrgent}
                                    pctValue={c.devUrgentPct + c.devNotUrgentPct}
                                />
                                <CrossCell
                                    count={c.notDevUrgent + c.notDevNotUrgent}
                                    pctValue={c.notDevUrgentPct + c.notDevNotUrgentPct}
                                />
                                <CrossCell count={c.total} pctValue={c.total > 0 ? 100 : 0} />
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ไฮไลต์สองบรรทัดสำหรับใช้ทำสไลด์ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                        className="rounded-xl border px-3 py-2 text-xs"
                        style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba" }}
                    >
                        <span className="text-gray-600">งานไม่เร่งด่วน และเป็นงานพัฒนา: </span>
                        <strong className="text-[#1a5233] tabular-nums">
                            {c.devNotUrgent.toLocaleString()} รายการ ({c.devNotUrgentPct.toFixed(2)}%)
                        </strong>
                    </div>
                    <div
                        className="rounded-xl border px-3 py-2 text-xs"
                        style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}
                    >
                        <span className="text-gray-600">งานเร่งด่วน แต่ไม่ใช่งานพัฒนา: </span>
                        <strong className="text-red-600 tabular-nums">
                            {c.notDevUrgent.toLocaleString()} รายการ ({c.notDevUrgentPct.toFixed(2)}%)
                        </strong>
                    </div>
                </div>
            </div>
        </div>
    );
}