"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaAgingPage() {
    return <PpaTable
        apiPath="/api/ppa/aging"
        exportFilePrefix="ppa-aging"
        dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "SERVICESDATE"]}
        sheetName="PPA_AGING"
        dateRangeLabel="01/12/2568 – 31/07/2569" />;
}