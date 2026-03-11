// app/pages/report/page.tsx  ← มาจากหน้า report
// หลัง refactor เหลือแค่นี้ ทุกอย่างอยู่ใน <ReportTable>

"use client";

import ReportTable from "@/app/components/ReportTable";

export default function ReportPage() {
    return (
        <ReportTable
            apiPath="/api/report"
            exportFilePrefix="report"
            dateKeys={["vstdate"]}
            sheetName="Report"
        />
    );
}