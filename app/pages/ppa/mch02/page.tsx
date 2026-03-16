"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaMch02Page() {
    return <PpaTable
        apiPath="/api/ppa/mch02"
        exportFilePrefix="ppa-mch02"
        dateKeys={["DATAEXPORTDATE", "LMP", "EDC", "LDATE", "BDATE"]}
        sheetName="PPA_MCH02"
        dateRangeLabel="01/12/2568 – 31/07/2569" />;
}