"use client";

import ReportTable from "@/app/components/ReportTable";

export default function ReportPage() {
    return (
        <ReportTable
            apiPath="/api/report"
            exportFilePrefix="report"
            dateKeys={["วันที่"]}
            sheetName="Report"
            columnFilterKeys={[
                "คำนำหน้า",
                "เพศ",
                "ชื่อสิทธิ์",
                "รหัสโรงพยาบาลหลัก",
                "รหัสโรงพยาบาลรอง",
            ]}
            columnFilterLabels={{
                "คำนำหน้า": "คำนำหน้า",
                "เพศ": "เพศ",
                "ชื่อสิทธิ์": "ประเภทสิทธิ์",
                "รหัสโรงพยาบาลหลัก": "รหัส hospmain",
                "รหัสโรงพยาบาลรอง": "รหัส hospsub",
            }}
        />
    );
}