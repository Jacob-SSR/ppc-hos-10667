"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaMch02Page() {
    return (
        <PpaTable
            apiPath="/api/ppa/mch02"
            exportFilePrefix="ppa-mch02"
            dateKeys={["lmp", "edc", "LRDATE", "BDATE"]}
            sheetName="PPA_MCH02"
            dateRangeLabel="01/02/2569 – 30/04/2569"
        />
    );
}