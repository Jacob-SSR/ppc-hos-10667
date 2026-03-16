"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaNcd01Page() {
    return <PpaTable
        apiPath="/api/ppa/ncd01"
        exportFilePrefix="ppa-ncd01"
        dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "DATE_SERV", "D_UPDATE", "FU_DATE_SERV", "FU_D_UPDATE"]}
        sheetName="PPA_NCD01"
        dateRangeLabel="01/12/2568 – 31/07/2569" />;
}