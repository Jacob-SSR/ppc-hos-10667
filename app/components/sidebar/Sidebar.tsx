"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  Stethoscope,
  HeartHandshake,
  Settings,
  Sun,
  Moon,
  FilePen,          // ✅ มีอยู่แล้ว ไม่ต้องเพิ่ม
} from "lucide-react";

import NavGroup from "./NavGroup";
import {
  DASHBOARD_ITEMS,
  REPORT_ITEMS,
  PPA_ITEMS,
  PRIMARY_CARE_ITEMS,
} from "./sidebarMenu";
import { SidebarItem } from "./types";
import { useSettings } from "@/app/contexts/SettingsContext";

const GUEST_DASHBOARD_ITEMS = DASHBOARD_ITEMS.filter(
  (item) => item.href === "/pages/dashboard",
);

const isInGroup = (pathname: string | null, items: SidebarItem[]) =>
  items.some((i) => pathname === i.href || pathname?.startsWith(i.href + "/"));

export default function Sidebar() {
  const pathname = usePathname();
  const { darkMode, setDarkMode } = useSettings();
  const isSettings = pathname === "/pages/settings";

  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [isIT, setIsIT] = useState(false);   // ✅ จุด B — เพิ่มบรรทัดนี้

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setIsGuest(data.user?.role === "guest");
          setIsIT(data.user?.role === "IT");   // ✅ จุด C — เพิ่มบรรทัดนี้
        }
      })
      .catch(() => {
        if (!cancelled) setIsGuest(true);
      });
    return () => { cancelled = true; };
  }, []);

  const [dashboardOverride, setDashboardOverride] = useState<boolean | null>(null);
  const [reportOverride, setReportOverride] = useState<boolean | null>(null);
  const [ppaOverride, setPpaOverride] = useState<boolean | null>(null);
  const [primaryCareOverride, setPrimaryCareOverride] = useState<boolean | null>(null);

  const dashboardOpen = dashboardOverride ?? isInGroup(pathname, DASHBOARD_ITEMS);
  const reportOpen = reportOverride ?? isInGroup(pathname, REPORT_ITEMS);
  const ppaOpen = ppaOverride ?? (pathname?.startsWith("/pages/ppa") || false);
  const primaryCareOpen = primaryCareOverride ?? isInGroup(pathname, PRIMARY_CARE_ITEMS);

  const toggle = (current: boolean, setter: (v: boolean | null) => void) =>
    setter(!current);

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

            {/* ✅ จุด D — เพิ่มทั้งก้อนนี้ */}
            {isIT && (
              <Link
                href="/pages/it-worklog-form"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={
                  pathname === "/pages/it-worklog-form"
                    ? { backgroundColor: "#d6f0e0", color: "#1a5233", fontWeight: 600 }
                    : { color: "#4b5563" }
                }
                onMouseEnter={(e) => {
                  if (pathname !== "/pages/it-worklog-form")
                    e.currentTarget.style.backgroundColor = "#e8f5ee";
                }}
                onMouseLeave={(e) => {
                  if (pathname !== "/pages/it-worklog-form")
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <FilePen size={16} />
                <div>
                  <div className="text-xs">บันทึกงาน IT</div>
                  <div className="text-[10px] text-gray-400">กรอกงานประจำวัน</div>
                </div>
              </Link>
            )}
          </>
        )}

        {isGuest && (
          <div className="mt-4 mx-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-1">โหมด Guest</p>
            <p className="text-[11px] text-amber-700 leading-snug">
              เข้าดูได้เฉพาะ Dashboard Overview
              <br />
              Login เพื่อเข้าถึงฟีเจอร์ทั้งหมด
            </p>
          </div>
        )}
      </nav>

      {/* Bottom bar */}
      <div className="px-4 pb-5 pt-2 space-y-1 border-t border-gray-100">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          {darkMode
            ? <Sun size={16} className="text-amber-500" />
            : <Moon size={16} className="text-indigo-500" />}
          <span>{darkMode ? "โหมดกลางวัน" : "โหมดกลางคืน"}</span>
        </button>

        {!isGuest && (
          <Link
            href="/pages/settings"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={
              isSettings
                ? { backgroundColor: "#d6f0e0", color: "#1a5233", fontWeight: 600 }
                : { color: "#4b5563" }
            }
            onMouseEnter={(e) => {
              if (!isSettings) e.currentTarget.style.backgroundColor = "#e8f5ee";
            }}
            onMouseLeave={(e) => {
              if (!isSettings) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Settings size={16} />
            <span>ตั้งค่า</span>
          </Link>
        )}
      </div>
    </aside>
  );
}