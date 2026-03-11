// app/pages/no-endpoint/page.tsx  ← มาจากหน้า no-endpoint
// หลัง refactor เหลือแค่นี้ ทุกอย่างอยู่ใน <ReportTable>

"use client";

import ReportTable from "@/app/components/ReportTable";

export default function NoEndpointPage() {
    return (
        <ReportTable
            apiPath="/api/no-endpoint"
            exportFilePrefix="no-endpoint-report"
            dateKeys={["DATE", "vstdate"]}
            sheetName="NoEndpoint"
        />
    );
}