"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsidePage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside"
            exportFilePrefix="uc-outside"
            dateKeys={["vstdate"]}
            sheetName="UCOutside"
            columnFilterKeys={["pttype_name", "gender", "province_name", "department", "hospmain_name"]}
            columnFilterLabels={{
                pttype_name: "ประเภทสิทธิ์",
                gender: "เพศ",
                province_name: "จังหวัด",
                department: "แผนก",
                hospmain_name: "โรงพยาบาลต้นสังกัด",
            }}
        />
    );
}