"use client";

import { useEffect, useMemo, useState } from "react";
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
  FilePen,
  MapPinned,
  Server,
} from "lucide-react";

import NavGroup from "./NavGroup";

import {
  DASHBOARD_GROUPS,
  REPORT_ITEMS,
  PPA_ITEMS,
  PRIMARY_CARE_ITEMS,
} from "./sidebarMenu";

import { SidebarItem } from "./types";

import { useSettings } from "@/app/contexts/SettingsContext";
import { canAccessPath } from "@/lib/permissions";

// =========================
// Guest Dashboard
// =========================
const GUEST_DASHBOARD_ITEMS =
  DASHBOARD_GROUPS[0].items.filter(
    (item) => item.href === "/pages/dashboard"
  );

// =========================
// Check Active
// =========================
const isInGroup = (
  pathname: string | null,
  items: SidebarItem[]
) => {
  return items.some(
    (item) =>
      pathname === item.href ||
      pathname?.startsWith(item.href + "/")
  );
};

export default function Sidebar() {
  const pathname = usePathname();

  const { darkMode, setDarkMode } =
    useSettings();

  const isSettings =
    pathname === "/pages/settings";

  // role จาก API เป็นตัวพิมพ์ใหญ่เสมอ (GUEST/USER/IT/ADMIN/สายงานต่างๆ)
  // null = ยังโหลดอยู่
  const [role, setRole] =
    useState<string | null>(null);

  const isGuest = role === "GUEST";
  const isIT = role === "IT";

  // =========================
  // Fetch User
  // =========================
  useEffect(() => {
    let cancelled = false;

    fetch("/api/me", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setRole(
            data.user?.role?.toUpperCase() ??
              "GUEST"
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole("GUEST");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================
  // กรองเมนูตามสายงาน (role)
  // แพทย์ / ผอ. / ADMIN / IT เห็นทุกเมนู — สายงานอื่นเห็นเฉพาะโซนตัวเอง
  // =========================
  const visibleDashboardGroups =
    useMemo(
      () =>
        DASHBOARD_GROUPS.map(
          (group) => ({
            ...group,
            items:
              group.items.filter(
                (item) =>
                  canAccessPath(
                    role,
                    item.href
                  )
              ),
          })
        ).filter(
          (group) =>
            group.items.length > 0
        ),
      [role]
    );

  const visibleReportItems =
    useMemo(
      () =>
        REPORT_ITEMS.filter(
          (item) =>
            canAccessPath(
              role,
              item.href
            )
        ),
      [role]
    );

  const visiblePrimaryCareItems =
    useMemo(
      () =>
        PRIMARY_CARE_ITEMS.filter(
          (item) =>
            canAccessPath(
              role,
              item.href
            )
        ),
      [role]
    );

  const visiblePpaItems =
    useMemo(
      () =>
        PPA_ITEMS.filter(
          (item) =>
            canAccessPath(
              role,
              item.href
            )
        ),
      [role]
    );

  // =========================
  // Collapse State
  // =========================
  const [
    dashboardOverride,
    setDashboardOverride,
  ] =
    useState<boolean | null>(
      null
    );

  const [
    reportOverride,
    setReportOverride,
  ] =
    useState<boolean | null>(
      null
    );

  const [
    ppaOverride,
    setPpaOverride,
  ] =
    useState<boolean | null>(
      null
    );

  const [
    primaryCareOverride,
    setPrimaryCareOverride,
  ] =
    useState<boolean | null>(
      null
    );

  // =========================
  // Open State
  // =========================
  const dashboardOpen =
    dashboardOverride ??
    DASHBOARD_GROUPS.some(
      (group) =>
        isInGroup(
          pathname,
          group.items
        )
    );

  const reportOpen =
    reportOverride ??
    isInGroup(
      pathname,
      REPORT_ITEMS
    );

  const ppaOpen =
    ppaOverride ??
    isInGroup(
      pathname,
      PPA_ITEMS
    );

  const primaryCareOpen =
    primaryCareOverride ??
    isInGroup(
      pathname,
      PRIMARY_CARE_ITEMS
    );

  // =========================
  // Toggle
  // =========================
  const toggle = (
    current: boolean,
    setter: (
      v: boolean | null
    ) => void
  ) => {
    setter(!current);
  };

  // =========================
  // Loading
  // =========================
  if (role === null) {
    return (
      <aside className="flex flex-col w-60 h-full bg-white border-r-2 shadow-[2px_0_12px_rgba(0,0,0,0.06)] overflow-hidden" style={{ borderColor: "#d6f0e0" }}>
        <nav className="flex-1 px-4 py-6">
          <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-60 h-full bg-white border-r-2 shadow-[2px_0_12px_rgba(0,0,0,0.06)] overflow-hidden" style={{ borderColor: "#d6f0e0" }}>
      {/* ========================= */}
      {/* Menu */}
      {/* ========================= */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto min-h-0 text-sm">

        {/* Dashboard */}
        <NavGroup
          label="Dashboard"
          icon={LayoutDashboard}
          groups={
            isGuest
              ? [
                {
                  title:
                    "Dashboard หลัก",
                  items:
                    GUEST_DASHBOARD_ITEMS,
                },
              ]
              : visibleDashboardGroups
          }
          isOpen={dashboardOpen}
          onToggle={() =>
            toggle(
              dashboardOpen,
              setDashboardOverride
            )
          }
          isActive={DASHBOARD_GROUPS.some(
            (group) =>
              isInGroup(
                pathname,
                group.items
              )
          )}
        />

        {!isGuest && (
          <>
            {/* Report */}
            {visibleReportItems.length >
              0 && (
              <NavGroup
                label="รายงาน"
                icon={FileText}
                groups={[
                  {
                    title:
                      "รายงาน",
                    items:
                      visibleReportItems,
                  },
                ]}
                isOpen={reportOpen}
                onToggle={() =>
                  toggle(
                    reportOpen,
                    setReportOverride
                  )
                }
                isActive={isInGroup(
                  pathname,
                  visibleReportItems
                )}
              />
            )}

            {/* Primary Care */}
            {visiblePrimaryCareItems.length >
              0 && (
              <NavGroup
                label="ปฐมภูมิ"
                icon={
                  HeartHandshake
                }
                groups={[
                  {
                    title:
                      "ปฐมภูมิ",
                    items:
                      visiblePrimaryCareItems,
                  },
                ]}
                isOpen={
                  primaryCareOpen
                }
                onToggle={() =>
                  toggle(
                    primaryCareOpen,
                    setPrimaryCareOverride
                  )
                }
                isActive={isInGroup(
                  pathname,
                  visiblePrimaryCareItems
                )}
              />
            )}

            {/* PPA */}
            {visiblePpaItems.length >
              0 && (
              <NavGroup
                label="PPA"
                icon={
                  Stethoscope
                }
                groups={[
                  {
                    title: "PPA",
                    items:
                      visiblePpaItems,
                  },
                ]}
                isOpen={ppaOpen}
                onToggle={() =>
                  toggle(
                    ppaOpen,
                    setPpaOverride
                  )
                }
                isActive={isInGroup(
                  pathname,
                  visiblePpaItems
                )}
              />
            )}

            {/* IT Worklog */}
            {isIT && (
              <Link
                href="/pages/it-worklog-form"
                className={`
                  flex items-center gap-2.5
                  px-3 py-2.5 rounded-lg
                  text-sm font-medium
                  transition-colors
                  ${pathname ===
                    "/pages/it-worklog-form"
                    ? "bg-[#d6f0e0] text-[#1a5233]"
                    : "text-gray-600 hover:bg-[#e8f5ee]"
                  }
                `}
              >
                <FilePen size={16} />

                <div>
                  <div className="text-xs">
                    บันทึกงาน IT
                  </div>

                  <div className="text-[10px] text-gray-400">
                    กรอกงานประจำวัน
                  </div>
                </div>
              </Link>
            )}

            {/* Server Status */}
            {isIT && (
              <Link
                href="/pages/server-status"
                className={`
                  flex items-center gap-2.5
                  px-3 py-2.5 rounded-lg
                  text-sm font-medium
                  transition-colors
                  ${pathname ===
                    "/pages/server-status"
                    ? "bg-[#d6f0e0] text-[#1a5233]"
                    : "text-gray-600 hover:bg-[#e8f5ee]"
                  }
                `}
              >
                <Server size={16} />

                <div>
                  <div className="text-xs">
                    สถานะเซิร์ฟเวอร์
                  </div>

                  <div className="text-[10px] text-gray-400">
                    RAM / Harddisk เครื่องแม่ข่าย
                  </div>
                </div>
              </Link>
            )}

            <Link
              href="https://pikad-phlapphla-chai.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="
    flex items-center gap-2.5
    px-3 py-2.5 rounded-lg
    text-sm font-medium
    transition-colors
    text-gray-600 hover:bg-[#e8f5ee]
  "
            >
              <MapPinned size={16} />

              <div>
                <div className="text-xs">
                  ค้นหาพิกัดหลังคาเรือน
                </div>

                <div className="text-[10px] text-gray-400">
                  ระบบค้นหาพิกัด
                </div>
              </div>
            </Link>
          </>
        )}

        {/* Guest Notice */}
        {isGuest && (
          <div className="mt-4 mx-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-1">
              โหมด Guest
            </p>

            <p className="text-[11px] text-amber-700 leading-snug">
              เข้าดูได้เฉพาะ
              Dashboard Overview
              <br />
              Login
              เพื่อเข้าถึงฟีเจอร์ทั้งหมด
            </p>
          </div>
        )}
      </nav>

      {/* ========================= */}
      {/* Bottom */}
      {/* ========================= */}
      <div className="px-4 pb-5 pt-2 space-y-1 border-t border-gray-100">
        <button
          onClick={() =>
            setDarkMode(
              !darkMode
            )
          }
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          {darkMode ? (
            <Sun
              size={16}
              className="text-amber-500"
            />
          ) : (
            <Moon
              size={16}
              className="text-indigo-500"
            />
          )}

          <span>
            {darkMode
              ? "โหมดกลางวัน"
              : "โหมดกลางคืน"}
          </span>
        </button>

        {!isGuest && (
          <Link
            href="/pages/settings"
            className={`
              flex items-center gap-2.5
              px-3 py-2.5 rounded-lg
              text-sm font-medium
              transition-colors
              ${isSettings
                ? "bg-[#d6f0e0] text-[#1a5233]"
                : "text-gray-600 hover:bg-[#e8f5ee]"
              }
            `}
          >
            <Settings size={16} />
            <span>ตั้งค่า</span>
          </Link>
        )}
      </div>
    </aside>
  );
}