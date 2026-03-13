"use client";
import PpaTable from "@/app/components/PpaTable";

export default function PpaMchWomanPage() {
    return (
        <PpaTable
            apiPath="/api/ppa/mch-woman"
            exportFilePrefix="ppa-mch-woman"
            dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "SERVICESDATE", "C_DATE"]}
            sheetName="PPA_MCH_WOMAN"
            dateRangeLabel="01/12/2568 – 31/07/2569"
        />
    );
}