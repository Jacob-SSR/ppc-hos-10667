"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaMch04Page() {
    return <PpaTable
        apiPath="/api/ppa/mch04"
        exportFilePrefix="ppa-mch04"
        dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "DATE_PERIOD", "F_SCREEN_DATE", "S_SCREEN_DATE"]}
        sheetName="PPA_MCH04"
        dateRangeLabel="01/12/2568 – 31/07/2569" />;
}