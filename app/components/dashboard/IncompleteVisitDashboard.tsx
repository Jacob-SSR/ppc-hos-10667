// app/components/dashboard/IncompleteVisitDashboard.tsx
"use client";

import { useMemo } from "react";
import {
    FileWarning, ClipboardList, Stethoscope, FileX, Building2, UserRound,
} from "lucide-react";
import { KpiCard, SectionCard, HBarList } from "@/app/components/dashboard/live";

const blank = (v: unknown) => v == null || String(v).trim() === "";
const str = (v: unknown) => (v == null ? "" : String(v).trim());

export default function IncompleteVisitDashboard({
    rows,
}: {
    rows: Record<string, unknown>[];
}) {
    const stats = useMemo(() => {
        const total = rows.length;
        const missingCC = rows.filter((r) => blank(r.cc)).length;
        const missingDiag = rows.filter((r) => blank(r.diag_text)).length;
        const missingIcd = rows.filter((r) => blank(r.pdx)).length;

        const byDept: Record<string, number> = {};
        const byDoctor: Record<string, number> = {};
        rows.forEach((r) => {
            const dep = str(r.department) || "ไม่ระบุแผนก";
            byDept[dep] = (byDept[dep] || 0) + 1;
            const doc = str(r.name) || "ไม่ระบุแพทย์";
            byDoctor[doc] = (byDoctor[doc] || 0) + 1;
        });

        const top = (m: Record<string, number>) =>
            Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);

        return {
            total, missingCC, missingDiag, missingIcd,
            topDept: top(byDept), topDoctor: top(byDoctor),
        };
    }, [rows]);

    // ยังไม่ค้นหา / ไม่มีข้อมูล → ไม่แสดงอะไร (ตารางมี empty state ของตัวเองอยู่แล้ว)
    if (stats.total === 0) return null;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon={FileWarning} label="เวชระเบียนไม่สมบูรณ์"
                    value={stats.total.toLocaleString()} sub="รายการทั้งหมด"
                    accent="#1a5233" bg="#f0faf4" />
                <KpiCard icon={ClipboardList} label="ไม่มีอาการสำคัญ (CC)"
                    value={stats.missingCC.toLocaleString()} accent="#b45309" bg="#fff7ed" />
                <KpiCard icon={Stethoscope} label="ไม่มีการวินิจฉัย"
                    value={stats.missingDiag.toLocaleString()} accent="#9d174d" bg="#fce7f3" />
                <KpiCard icon={FileX} label="ไม่มีรหัส ICD10"
                    value={stats.missingIcd.toLocaleString()} accent="#991b1b" bg="#fee2e2" />
            </div>
            <p className="text-xs text-gray-400 -mt-2 px-1">
                * แต่ละรายการอาจขาดข้อมูลมากกว่า 1 อย่าง ผลรวมจึงมากกว่ายอดทั้งหมดได้
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="แยกตามแผนก (Top 8)" icon={Building2} titleColor="#1a5233">
                    <HBarList data={stats.topDept} total={stats.total}
                        colors={["#7ec8a0"]} labelWidth={120} />
                </SectionCard>
                <SectionCard title="แยกตามแพทย์ (Top 8)" icon={UserRound} titleColor="#1a5233">
                    <HBarList data={stats.topDoctor} total={stats.total}
                        colors={["#85B7EB"]} labelWidth={120} />
                </SectionCard>
            </div>
        </div>
    );
}