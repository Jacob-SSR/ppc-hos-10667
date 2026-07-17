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

export function SummaryTablesSection({
    staffLoad,
    totalJobs,
    devCount,
    urgentCount,
    onTimeCount,
}: {
    staffLoad: { name: string; count: number }[];
    totalJobs: number;
    devCount: number;
    urgentCount: number;
    onTimeCount: number;
}) {
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
        </div>
    );
}