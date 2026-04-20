"use client";

import { useEffect, useState } from "react";
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

// Guest เห็นแค่ Overview
const GUEST_DASHBOARD_ITEMS = DASHBOARD_ITEMS.filter(
  (item) => item.href === "/pages/dashboard",
);

// ─── helpers ──────────────────────────────────────────────────────────────────
const isInGroup = (pathname: string | null, items: SidebarItem[]) =>
  items.some((i) => pathname === i.href || pathname?.startsWith(i.href + "/"));

export default function Sidebar() {
  const pathname = usePathname();

  // ── Guest check ──
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setIsGuest(data.user?.role === "guest");
      })
      .catch(() => {
        if (!cancelled) setIsGuest(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Override state (user กดแล้ว override pathname) ──
  const [dashboardOverride, setDashboardOverride] = useState<boolean | null>(
    null,
  );
  const [reportOverride, setReportOverride] = useState<boolean | null>(null);
  const [ppaOverride, setPpaOverride] = useState<boolean | null>(null);
  const [primaryCareOverride, setPrimaryCareOverride] = useState<
    boolean | null
  >(null);
  const dashboardOpen =
    dashboardOverride ?? isInGroup(pathname, DASHBOARD_ITEMS);
  const reportOpen = reportOverride ?? isInGroup(pathname, REPORT_ITEMS);
  const ppaOpen = ppaOverride ?? (pathname?.startsWith("/pages/ppa") || false);
  const primaryCareOpen =
    primaryCareOverride ?? isInGroup(pathname, PRIMARY_CARE_ITEMS);

  const toggle = (current: boolean, setter: (v: boolean | null) => void) =>
    setter(!current);

  // Loading role
  if (isGuest === null) {
    return (
      <aside className="flex flex-col w-60 h-full bg-white border-r border-gray-300 overflow-hidden">
        <nav className="flex-1 px-4 py-6 space-y-1 text-sm">
          <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-60 h-full bg-white border-r border-gray-300 overflow-hidden">
      <nav className="flex-1 px-4 py-6 space-y-1 text-sm overflow-y-auto min-h-0">
        <NavGroup
          label="Dashboard"
          icon={LayoutDashboard}
          items={isGuest ? GUEST_DASHBOARD_ITEMS : DASHBOARD_ITEMS}
          isOpen={dashboardOpen}
          onToggle={() => toggle(dashboardOpen, setDashboardOverride)}
          isActive={isInGroup(pathname, DASHBOARD_ITEMS)}
        />

        {/* เมนูเหล่านี้ซ่อนสำหรับ Guest */}
        {!isGuest && (
          <>
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
          </>
        )}

        {/* Guest Notice */}
        {isGuest && (
          <div className="mt-4 mx-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-1">
              โหมด Guest
            </p>
            <p className="text-[11px] text-amber-700 leading-snug">
              เข้าดูได้เฉพาะ Dashboard Overview
              <br />
              Login เพื่อเข้าถึงฟีเจอร์ทั้งหมด
            </p>
          </div>
        )}
      </nav>
    </aside>
  );
}
