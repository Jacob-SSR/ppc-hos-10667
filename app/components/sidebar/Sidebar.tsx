"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Stethoscope,
  HeartHandshake,
} from "lucide-react";

import NavGroup from "./NavGroup";
import {
  DASHBOARD_ITEMS,
  REPORT_ITEMS,
  PPA_ITEMS,
  PRIMARY_CARE_ITEMS,
} from "./sidebarMenu";

export default function Sidebar() {
  const pathname = usePathname();

  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [ppaOpen, setPpaOpen] = useState(false);
  const [primaryCareOpen, setPrimaryCareOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/pages/ppa")) setPpaOpen(true);
    if (REPORT_ITEMS.some((i) => pathname === i.href)) setReportOpen(true);
    if (DASHBOARD_ITEMS.some((i) => pathname === i.href))
      setDashboardOpen(true);
    if (PRIMARY_CARE_ITEMS.some((i) => pathname === i.href))
      setPrimaryCareOpen(true);
  }, [pathname]);

  const isAnyActive = (items: any[]) =>
    items.some((i) => pathname === i.href || pathname?.startsWith(i.href));

  return (
    <aside className="flex flex-col w-60 h-full bg-white border-r border-gray-300 overflow-hidden">
      <nav className="flex-1 px-4 py-6 space-y-1 text-sm overflow-y-auto min-h-0">
        <NavGroup
          label="Dashboard"
          icon={LayoutDashboard}
          items={DASHBOARD_ITEMS}
          isOpen={dashboardOpen}
          onToggle={() => setDashboardOpen((v) => !v)}
          isActive={isAnyActive(DASHBOARD_ITEMS)}
        />

        <NavGroup
          label="รายงาน"
          icon={FileText}
          items={REPORT_ITEMS}
          isOpen={reportOpen}
          onToggle={() => setReportOpen((v) => !v)}
          isActive={isAnyActive(REPORT_ITEMS)}
        />
        <NavGroup
          label="ปฐมภูมิ"
          icon={HeartHandshake}
          items={PRIMARY_CARE_ITEMS}
          isOpen={primaryCareOpen}
          onToggle={() => setPrimaryCareOpen((v) => !v)}
          isActive={isAnyActive(PRIMARY_CARE_ITEMS)}
        />
        <NavGroup
          label="PPA"
          icon={Stethoscope}
          items={PPA_ITEMS}
          isOpen={ppaOpen}
          onToggle={() => setPpaOpen((v) => !v)}
          isActive={isAnyActive(PPA_ITEMS)}
        />
      </nav>
    </aside>
  );
}
