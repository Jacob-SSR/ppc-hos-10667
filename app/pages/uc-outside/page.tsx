"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsidePage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside"
            exportFilePrefix="uc-outside"
            dateKeys={["วันที่"]}
            sheetName="UCOutside"
            columnFilterKeys={[
                "ชื่อสิทธิ์",
                "เพศ",
                "จังหวัด",
                "แผนก",
                "ชื่อโรงพยาบาลหลัก",
                "รหัสสิทธิ์หลัก",
            ]}
            columnFilterLabels={{
                "ชื่อสิทธิ์": "ประเภทสิทธิ์",
                "เพศ": "เพศ",
                "จังหวัด": "จังหวัด",
                "แผนก": "แผนก",
                "ชื่อโรงพยาบาลหลัก": "โรงพยาบาลต้นสังกัด",
                "รหัสสิทธิ์หลัก": "รหัสสิทธิ์หลัก (hipdata)",
            }}
        />
    );
}