// app/pages/uc-outside-dental/page.tsx  ← มาจากหน้า uc-outside-dental
// หลัง refactor เหลือแค่นี้ ทุกอย่างอยู่ใน <ReportTable>

"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsideDentalPage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside-dental"
            exportFilePrefix="uc-outside-dental"
            dateKeys={["vstdate"]}
            sheetName="Report"
        />
    );
}