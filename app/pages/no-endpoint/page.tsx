"use client";

import ReportTable from "@/app/components/ReportTable";

export default function NoEndpointPage() {
    return (
        <ReportTable
            apiPath="/api/no-endpoint"
            exportFilePrefix="no-endpoint-report"
            dateKeys={[]}
            sheetName="NoEndpoint"
            columnFilterKeys={[
                "แผนก",
                "ชื่อสิทธิ์",
            ]}
            columnFilterLabels={{
                "แผนก": "แผนก",
                "ชื่อสิทธิ์": "ประเภทสิทธิ์",
            }}
        />
    );
}