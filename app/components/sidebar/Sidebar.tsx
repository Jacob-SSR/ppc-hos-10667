"use client";

import { useState } from "react";
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
import { SidebarItem } from "./types";

// ─── helpers ──────────────────────────────────────────────────────────────────
const isInGroup = (pathname: string | null, items: SidebarItem[]) =>
  items.some((i) => pathname === i.href || pathname?.startsWith(i.href + "/"));

export default function Sidebar() {
  const pathname = usePathname();

  // User override: null = ยังไม่กด (ใช้ auto ตาม pathname)
  //                true/false = user กดแล้ว (ใช้ค่านี้แทน)
  const [dashboardOverride, setDashboardOverride] = useState<boolean | null>(
    null,
  );
  const [reportOverride, setReportOverride] = useState<boolean | null>(null);
  const [ppaOverride, setPpaOverride] = useState<boolean | null>(null);
  const [primaryCareOverride, setPrimaryCareOverride] = useState<
    boolean | null
  >(null);

  // ค่าที่ใช้จริง: ถ้า user กดแล้ว → ใช้ override, ไม่งั้นคำนวณจาก pathname
  const dashboardOpen =
    dashboardOverride ?? isInGroup(pathname, DASHBOARD_ITEMS);
  const reportOpen = reportOverride ?? isInGroup(pathname, REPORT_ITEMS);
  const ppaOpen = ppaOverride ?? (pathname?.startsWith("/pages/ppa") || false);
  const primaryCareOpen =
    primaryCareOverride ?? isInGroup(pathname, PRIMARY_CARE_ITEMS);

  const toggle = (current: boolean, setter: (v: boolean | null) => void) =>
    setter(!current);

  return (
    <aside className="flex flex-col w-60 h-full bg-white border-r border-gray-300 overflow-hidden">
      <nav className="flex-1 px-4 py-6 space-y-1 text-sm overflow-y-auto min-h-0">
        <NavGroup
          label="Dashboard"
          icon={LayoutDashboard}
          items={DASHBOARD_ITEMS}
          isOpen={dashboardOpen}
          onToggle={() => toggle(dashboardOpen, setDashboardOverride)}
          isActive={isInGroup(pathname, DASHBOARD_ITEMS)}
        />

        <NavGroup
          label="รายงาน"
          icon={FileText}
          items={REPORT_ITEMS}
          isOpen={reportOpen}
          onToggle={() => toggle(reportOpen, setReportOverride)}
          isActive={isInGroup(pathname, REPORT_ITEMS)}
        />

        <NavGroup
          label="ปฐมภูมิ"
          icon={HeartHandshake}
          items={PRIMARY_CARE_ITEMS}
          isOpen={primaryCareOpen}
          onToggle={() => toggle(primaryCareOpen, setPrimaryCareOverride)}
          isActive={isInGroup(pathname, PRIMARY_CARE_ITEMS)}
        />

        <NavGroup
          label="PPA"
          icon={Stethoscope}
          items={PPA_ITEMS}
          isOpen={ppaOpen}
          onToggle={() => toggle(ppaOpen, setPpaOverride)}
          isActive={pathname?.startsWith("/pages/ppa") || false}
        />
      </nav>
    </aside>
  );
}
