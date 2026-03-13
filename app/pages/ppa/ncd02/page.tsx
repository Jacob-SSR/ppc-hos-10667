"use client";
import PpaTable from "@/app/components/PpaTable";
export default function PpaNcd02Page() {
    return <PpaTable
        apiPath="/api/ppa/ncd02"
        exportFilePrefix="ppa-ncd02"
        dateKeys={["DATAEXPORTDATE", "BIRTHDATE", "DATE_SERV", "D_UPDATE", "FU_DATE_SERV", "FU_D_UPDATE"]}
        sheetName="PPA_NCD02"
        dateRangeLabel="01/12/2568 – 31/07/2569" />;
}