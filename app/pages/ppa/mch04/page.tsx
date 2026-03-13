"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaMch04Page() {
    return (
        <PpaTable
            apiPath="/api/ppa/mch04"
            exportFilePrefix="ppa-mch04"
            dateKeys={["birthdate", "f_date", "f_screen_date", "s_screen_date"]}
            sheetName="PPA_MCH04"
            dateRangeLabel="01/02/2569 – 30/04/2569"
        />
    );
}