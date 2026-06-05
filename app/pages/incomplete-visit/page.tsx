// app/pages/incomplete-visit/page.tsx
"use client";

import { useState } from "react";
import IncompleteVisitDashboard from "@/app/components/dashboard/IncompleteVisitDashboard";
import ReportTable from "@/app/components/ReportTable";

export default function IncompleteVisitPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  return (
    <ReportTable
      apiPath="/api/incomplete-visit"
      exportFilePrefix="incomplete-visit"
      dateKeys={["vstdate"]}
      sheetName="IncompleteVisit"
      columnFilterKeys={["department"]}
      columnFilterLabels={{ department: "แผนก" }}
      onData={setRows}
      afterFilter={<IncompleteVisitDashboard rows={rows} />}
    />
  );
}