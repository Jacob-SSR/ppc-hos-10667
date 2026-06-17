"use client";

import ReportTable from "@/app/components/ReportTable";

export default function CondomReportPage() {
    return (
        <ReportTable
            apiPath="/api/condom-report"
            exportFilePrefix="condom_opd"
            dateKeys={["วันที่"]}
            sheetName="รายการจ่ายถุงยางอนามัย OPD"
            columnFilterKeys={["แผนก", "เพศ", "ชื่อสิทธิ์"]}
            columnFilterLabels={{
                แผนก: "แผนก",
                เพศ: "เพศ",
                ชื่อสิทธิ์: "ประเภทสิทธิ์",
            }}
        />
    );
}