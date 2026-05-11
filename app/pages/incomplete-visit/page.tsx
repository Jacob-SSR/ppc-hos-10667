"use client";

import ReportTable from "@/app/components/ReportTable";

export default function IncompleteVisitPage() {
  return (
    <ReportTable
      apiPath="/api/incomplete-visit"
      exportFilePrefix="incomplete-visit"
      dateKeys={["vstdate"]}
      sheetName="IncompleteVisit"
      columnFilterKeys={["department"]}
      columnFilterLabels={{ department: "แผนก" }}
    />
  );
}