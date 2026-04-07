"use client";

import SectionCard from "@/app/components/dashboard/SectionCard";
import ReportChart from "@/app/components/dashboard/ReportChart";
import Card from "@/app/components/dashboard/Card";

export default function DashboardPage() {
  return (
    <div>
      {/* Header */}
      <div className="border bg-white rounded-lg p-4">
        <h1 className="text-xl font-bold text-[#717171]">
          Dashboard โรงพยาบาลพลับพลาชัย
        </h1>
      </div>

      {/* Sections */}
      <SectionCard title="ภาพรวมผู้รับบริการ OPD วันนี้">
        <Card />
      </SectionCard>

      <SectionCard title="ภาพรวมผู้รับบริการ IPD วันนี้">
        <Card />
      </SectionCard>

      {/* Chart */}
      <div className="border bg-white rounded-lg p-4 mt-4">
        <ReportChart />
      </div>

      <div className="border bg-white rounded-lg p-4 mt-4">
        <SectionCard title="อัตราการครองเตียง ปีงบประมาณ 2569 (01-10-2568 ถึง 30-09-2569)">
          <ReportChart />
        </SectionCard>
      </div>
    </div>
  );
}
