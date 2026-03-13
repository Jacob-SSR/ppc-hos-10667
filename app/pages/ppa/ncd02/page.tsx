"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaNcd02Page() {
    return (
        <PpaTable
            apiPath="/api/ppa/ncd02"
            exportFilePrefix="ppa-ncd02"
            dateKeys={["vstdate"]}
            sheetName="PPA_NCD02"
            dateRangeLabel="01/02/2569 – 30/04/2569"
        />
    );
}