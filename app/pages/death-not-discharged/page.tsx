"use client";

import PpaTable from "@/app/components/PpaTable";

export default function DeathNotDischargedPage() {
  return (
    <PpaTable
      apiPath="/api/death-not-discharged"
      exportFilePrefix="death-not-discharged"
      dateKeys={[]}
      sheetName="DeathNotDischarged"
      dateRangeLabel="ข้อมูลปัจจุบัน"
    />
  );
}
