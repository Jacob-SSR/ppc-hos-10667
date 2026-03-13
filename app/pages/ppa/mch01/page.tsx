"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaMch01Page() {
    return (
        <PpaTable
            apiPath="/api/ppa/mch01"
            exportFilePrefix="ppa-mch01"
            dateKeys={["lmp", "edc", "anc_register_date", "labor_date"]}
            sheetName="PPA_MCH01"
            dateRangeLabel="01/02/2569 – 30/04/2569"
        />
    );
}