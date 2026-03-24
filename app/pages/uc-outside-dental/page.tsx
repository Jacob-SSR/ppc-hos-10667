"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsideDentalPage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside-dental"
            exportFilePrefix="uc-outside-dental"
            dateKeys={["วันที่"]}
            sheetName="UCOutsideDental"
            columnFilterKeys={[
                "ชื่อสิทธิ์",
                "ชื่อโรงพยาบาลหลัก",
                "แผนก",
                "การวินิจฉัย",
            ]}
            columnFilterLabels={{
                "ชื่อสิทธิ์": "ประเภทสิทธิ์",
                "ชื่อโรงพยาบาลหลัก": "โรงพยาบาลต้นสังกัด",
                "แผนก": "แผนก",
                "การวินิจฉัย": "การวินิจฉัย (ICD10)",
            }}
        />
    );
}