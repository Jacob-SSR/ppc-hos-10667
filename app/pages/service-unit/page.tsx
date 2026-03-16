"use client";

import ReportTable from "@/app/components/ReportTable";

export default function ServiceUnitPage() {
    return (
        <ReportTable
            apiPath="/api/service-unit"
            exportFilePrefix="service-unit"
            dateKeys={["vstdate"]}
            sheetName="ServiceUnit"
            columnFilterKeys={["service_unit", "pttype", "pcode_name", "hospmain_name"]}
            columnFilterLabels={{
                service_unit: "หน่วยบริการ",
                pttype: "ประเภทสิทธิ์",
                pcode_name: "กลุ่มสิทธิ์",
                hospmain_name: "โรงพยาบาลต้นสังกัด",
            }}
        />
    );
}