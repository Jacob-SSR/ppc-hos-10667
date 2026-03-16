"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaMch01Page() {
    return <PpaTable
        apiPath="/api/ppa/mch01"
        exportFilePrefix="ppa-mch01"
        dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "SERVICESDATE", "LMP", "EDC", "BDATE"]}
        sheetName="PPA_MCH01"
        dateRangeLabel="01/02/2568 – 31/07/2569" />;
}