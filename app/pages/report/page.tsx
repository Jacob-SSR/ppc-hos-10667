"use client";

import ReportTable from "@/app/components/ReportTable";

export default function ReportPage() {
    return (
        <ReportTable
            apiPath="/api/report"
            exportFilePrefix="report"
            dateKeys={["vstdate"]}
            sheetName="Report"
            columnFilterKeys={["pttype_name", "gender", "hospmain", "hospsub"]}
            columnFilterLabels={{
                pttype_name: "ประเภทสิทธิ์",
                gender: "เพศ",
                hospmain: "รหัส hospmain",
                hospsub: "รหัส hospsub",
            }}
        />
    );
}