"use client";

import ReportTable from "@/app/components/ReportTable";

export default function PatientNoPersonPage() {
  return (
    <ReportTable
      apiPath="/api/patient-no-person"
      exportFilePrefix="patient-no-person"
      dateKeys={["วันที่รับบริการ", "วันเกิด", "วันที่มาครั้งแรก"]}
      sheetName="PatientNoPerson"
      columnFilterKeys={["บ้านเลขที่", "หมู่"]}
      columnFilterLabels={{
        "บ้านเลขที่": "บ้านเลขที่",
        "หมู่": "หมู่บ้าน",
      }}
    />
  );
}