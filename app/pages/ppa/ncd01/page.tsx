"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaNcd01Page() {
    return (
        <PpaTable
            apiPath="/api/ppa/ncd01"
            exportFilePrefix="ppa-ncd01"
            dateKeys={["screen_date", "f_screen_date"]}
            sheetName="PPA_NCD01"
            dateRangeLabel="01/10/2568 – 30/04/2569"
        />
    );
}