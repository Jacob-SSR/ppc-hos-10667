"use client";

import ReportTable from "@/app/components/ReportTable";

export default function MedicalCodingPage() {
    return (
        <ReportTable
            apiPath="/api/medical-coding"
            exportFilePrefix="medical-coding"
            dateKeys={["วันที่รับไว้", "วันที่ Admit", "วันที่จำหน่าย"]}
            sheetName="MedicalCoding"
            columnFilterKeys={["ประเภทการจำหน่าย", "ชื่อประเภทการจำหน่าย"]}
            columnFilterLabels={{
                "ประเภทการจำหน่าย": "ประเภทการจำหน่าย",
                "ชื่อประเภทการจำหน่าย": "ชื่อประเภทการจำหน่าย",
            }}
        />
    );
}
