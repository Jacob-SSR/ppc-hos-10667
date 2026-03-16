"use client";

import ReportTable from "@/app/components/ReportTable";

export default function UcOutsideDentalPage() {
    return (
        <ReportTable
            apiPath="/api/uc-outside-dental"
            exportFilePrefix="uc-outside-dental"
            dateKeys={["vstdate"]}
            sheetName="UCOutsideDental"
            columnFilterKeys={["pttype_name", "hospmain_name", "department"]}
            columnFilterLabels={{
                pttype_name: "ประเภทสิทธิ์",
                hospmain_name: "โรงพยาบาลต้นสังกัด",
                department: "แผนก",
            }}
        />
    );
}