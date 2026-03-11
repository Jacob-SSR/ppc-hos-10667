// app/pages/uc-outside/page.tsx  ← มาจากหน้า uc-outside
// หลัง refactor เหลือแค่นี้ ทุกอย่างอยู่ใน <ReportTable>

"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsidePage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside"
            exportFilePrefix="uc-outside"
            dateKeys={["vstdate"]}
            sheetName="Report"
        />
    );
}