"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaAgingPage() {
    return (
        <PpaTable
            apiPath="/api/ppa/aging"
            exportFilePrefix="ppa-aging"
            dateKeys={["birthdate"]}
            sheetName="PPA_AGING"
            dateRangeLabel="01/02/2569 – 30/04/2569"
        />
    );
}