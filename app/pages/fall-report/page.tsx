"use client";

import ReportTable from "@/app/components/ReportTable";

export default function FallReportPage() {
    return (
        <ReportTable
            apiPath="/api/fall-report"
            exportFilePrefix="fall-report"
            dateKeys={["วันที่รับบริการ"]}
            sheetName="FallReport"
            columnFilterKeys={["เพศ", "รหัส ICD10", "การวินิจฉัย", "สถานะผู้ป่วย", "ตำบล", "หมู่"]}
            columnFilterLabels={{
                "เพศ": "เพศ",
                "รหัส ICD10": "รหัส ICD10",
                "การวินิจฉัย": "การวินิจฉัย",
                "สถานะผู้ป่วย": "สถานะผู้ป่วย",
                "หมู่": "หมู่บ้าน",
                "ตำบล": "ตำบล",
            }}
        />
    );
}