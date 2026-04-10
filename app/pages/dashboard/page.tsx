"use client";

import { useEffect, useState } from "react";
import OpdSection from "@/app/components/dashboard/OpdSection";
import IpdSection from "@/app/components/dashboard/IpdSection";
import AnnualChart from "@/app/components/dashboard/AnnualChart";
import BedOccupancyChart from "@/app/components/dashboard/BedOccupancyChart";
import HomeWardTable from "@/app/components/dashboard/HomeWardTable";
import Top10Tables from "@/app/components/dashboard/Top10Tables";
import PpaOverview from "@/app/components/dashboard/PpaOverview";

export default function DashboardPage() {
  const [dashData, setDashData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    Promise.all([
      fetch(`/api/dashboard?start=${todayStr}&end=${todayStr}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/dashboard/monthly?months=6`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([dash, monthly]) => {
        setDashData(dash);
        setMonthlyData(monthly);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-700">Dashboard โรงพยาบาลพลับพลาชัย</h1>
      </div>

      {/* OPD */}
      <OpdSection data={dashData} loading={loading} dateLabel={todayStr} />

      {/* IPD */}
      <IpdSection loading={loading} dateLabel={todayStr} />

      {/* Annual OPD/IPD Chart */}
      <AnnualChart months={monthlyData?.months ?? []} loading={loading} />

      {/* Bed Occupancy Chart */}
      <BedOccupancyChart months={monthlyData?.months ?? []} loading={loading} />

      {/* Home Ward Tables */}
      <HomeWardTable start={todayStr} end={todayStr} />

      {/* Top 10 OPD / IPD */}
      <Top10Tables start={todayStr} end={todayStr} />

      {/* PPA Overview */}
      <PpaOverview />
    </div>
  );
}