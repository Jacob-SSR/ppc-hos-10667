"use client";

import { useState } from "react";
import AgeRangeSlider from "@/app/components/AgeRangeSlider";
import PpaTable from "@/app/components/PpaTable";
import { DEFAULT_AGE_RANGE, POPULATION_REPORT_TITLE } from "@/lib/population-report";

export default function PopulationReportPage() {
  const [ages, setAges] = useState<readonly [number, number]>(DEFAULT_AGE_RANGE);
  const [applied, setApplied] = useState<readonly [number, number]>(DEFAULT_AGE_RANGE);
  const [revision, setRevision] = useState(0);
  const query = `minAge=${applied[0]}&maxAge=${applied[1]}`;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-gray-900">{POPULATION_REPORT_TITLE}</h1>
        <p className="text-sm text-gray-600">โรงพยาบาลพลับพลาชัย จ.บุรีรัมย์ · เฉพาะผู้มีชีวิตและยังไม่จำหน่ายจากบัญชี 1</p>
      </header>
      <section className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5" aria-label="กำหนดช่วงอายุ">
        <AgeRangeSlider value={ages} onChange={setAges} />
        <button type="button" onClick={() => { setApplied([...ages]); setRevision((n) => n + 1); }}
          className="min-h-11 rounded-lg bg-green-800 px-6 py-2 font-semibold text-white hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
          แสดงรายงาน
        </button>
      </section>
      <PpaTable key={`${query}-${revision}`} apiPath={`/api/population-report?${query}`}
        exportFilePrefix={`population-type-1-3-age-${applied[0]}-${applied[1]}`}
        sheetName="ประชากร Type 1,3" dateRangeLabel={`อายุ ${applied[0]}–${applied[1]} ปี · Type 1,3`} />
    </div>
  );
}
