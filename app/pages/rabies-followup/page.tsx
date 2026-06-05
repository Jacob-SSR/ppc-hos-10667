// app/pages/rabies-followup/page.tsx
"use client";

import ReportTable from "@/app/components/ReportTable";

export default function RabiesFollowupPage() {
    return (
        <ReportTable
            apiPath="/api/rabies-followup"
            exportFilePrefix="rabies-followup"
            dateKeys={["วันที่นัดล่าสุด", "วันที่นัด"]}
            sheetName="RabiesFollowup"
            columnFilterKeys={["คลินิก", "หมู่"]}
            columnFilterLabels={{
                คลินิก: "คลินิก",
                หมู่: "หมู่บ้าน",
            }}
        />
    );
}