"use client";

import ReportTable from "@/app/components/ReportTable";

export default function PatientNoPersonPage() {
  return (
    <ReportTable
      apiPath="/api/patient-no-person"
      exportFilePrefix="patient-no-person"
      dateKeys={["วันที่รับบริการ", "วันเกิด", "วันที่ขึ้นทะเบียน"]}
      sheetName="PatientNoPerson"
      columnFilterKeys={["การศึกษา", "สถานภาพสมรส", "กรุ๊ปเลือด", "หมู่"]}
      columnFilterLabels={{
        "การศึกษา": "การศึกษา",
        "สถานภาพสมรส": "สถานภาพสมรส",
        "กรุ๊ปเลือด": "กรุ๊ปเลือด",
        "หมู่": "หมู่บ้าน",
      }}
    />
  );
}