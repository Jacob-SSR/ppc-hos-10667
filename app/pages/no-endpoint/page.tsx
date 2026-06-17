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
                "สัญชาติ",
                "แผนก",
                "ชื่อสิทธิ์",
            ]}
            columnFilterLabels={{
                "สัญชาติ": "สัญชาติ",
                "แผนก": "แผนก",
                "ชื่อสิทธิ์": "ประเภทสิทธิ์",
            }}
            defaultColumnFilters={{ "สัญชาติ": "ไทย" }}
        />
    );
}