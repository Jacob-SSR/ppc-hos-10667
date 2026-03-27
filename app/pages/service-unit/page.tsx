"use client";

import ReportTable from "@/app/components/ReportTable";

export default function ServiceUnitPage() {
    return (
        <ReportTable
            apiPath="/api/service-unit"
            exportFilePrefix="service-unit"
            dateKeys={["วันที่รับบริการ"]}
            sheetName="ServiceUnit"
            columnFilterKeys={[
                "หน่วยบริการ",
                "รหัสสิทธิ์",
                "ชื่อสิทธิ์",
                "ชื่อโรงพยาบาลหลัก",
                "ที่อยู่",
                "หมู่",
            ]}
            columnFilterLabels={{
                "หน่วยบริการ": "หน่วยบริการ",
                "รหัสสิทธิ์": "รหัสสิทธิ์",
                "ชื่อสิทธิ์": "กลุ่มสิทธิ์",
                "ชื่อโรงพยาบาลหลัก": "โรงพยาบาลต้นสังกัด",
                "ที่อยู่": "ที่อยู่ (ตำบล/อำเภอ)",
                "หมู่": "หมู่บ้าน",
            }}
        />
    );
}