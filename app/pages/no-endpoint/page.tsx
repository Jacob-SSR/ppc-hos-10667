"use client";

import ReportTable from "@/app/components/ReportTable";

export default function NoEndpointPage() {
    return (
        <ReportTable
            apiPath="/api/no-endpoint"
            exportFilePrefix="no-endpoint-report"
            dateKeys={["DATE", "vstdate"]}
            sheetName="NoEndpoint"
            columnFilterKeys={["Department", "pttypename"]}
            columnFilterLabels={{
                Department: "แผนก",
                pttypename: "ประเภทสิทธิ์",
            }}
        />
    );
}