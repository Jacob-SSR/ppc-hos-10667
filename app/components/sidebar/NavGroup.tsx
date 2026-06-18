"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarSubGroup } from "./types";

type Props = {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  groups: SidebarSubGroup[];
  isOpen: boolean;
  onToggle: () => void;
  isActive: boolean;
};

// ── ธีมเขียว รวมไว้ที่เดียว แก้ทีเดียวเปลี่ยนทั้งเมนู ──
const T = {
  primary: "#1a5233",
  mid: "#3aa36a",
  soft: "#a8d5ba",
  bg: "#d6f0e0",
  hover: "#e8f5ee",
  active: "#c2e8d4",
};

const EASE = [0.4, 0, 0.2, 1] as const;

export default function NavGroup({
  label,
  icon: Icon,
  groups,
  isOpen,
  onToggle,
  isActive,
}: Props) {
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "DASHBOARD หลัก": true,
  });

  const toggleSubGroup = (title: string) =>
    setOpenGroups((prev) => ({ ...prev, [title]: !(prev[title] ?? false) }));

  const isItemActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const headerActive = isActive || isOpen;

  return (
    <div className="pt-1">
      {/* ───────── Main Header ───────── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors duration-200"
        style={
          headerActive
            ? { backgroundColor: T.bg, color: T.primary, fontWeight: 600 }
            : { color: "#4b5563" }
        }
        onMouseEnter={(e) => {
          if (!headerActive) e.currentTarget.style.backgroundColor = T.hover;
        }}
        onMouseLeave={(e) => {
          if (!headerActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors"
          style={{ backgroundColor: headerActive ? "rgba(255,255,255,0.6)" : "transparent" }}
        >
          <Icon size={18} />
        </span>
        <span className="flex-1 text-sm text-left">{label}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* ───────── Main Dropdown ───────── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className="mt-1.5 ml-4 pl-3 border-l-2 space-y-1"
              style={{ borderColor: T.soft }}
            >
              {groups.map((group, gi) => {
                const subOpen = openGroups[group.title] ?? false;
                const isLast = gi === groups.length - 1;

                return (
                  <div
                    key={group.title}
                    className={isLast ? "" : "pb-2.5 mb-1"}
                    style={isLast ? {} : { borderBottom: `2px solid ${T.soft}55` }}
                  >
                    {/* ── Sub Group Header ── */}
                    <button
                      onClick={() => toggleSubGroup(group.title)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                      style={{ color: subOpen ? T.primary : "#6b7280" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span className="flex-1 text-[11px] font-bold uppercase tracking-wider">
                        {group.title}
                      </span>
                      <motion.span animate={{ rotate: subOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={13} />
                      </motion.span>
                    </button>

                    {/* ── Sub Group Items ── */}
                    <AnimatePresence initial={false}>
                      {subOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-0.5 mt-1 pb-0.5">
                            {group.items.map((item) => {
                              const active = isItemActive(item.href);
                              const ItemIcon = item.icon;

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className="relative flex items-start gap-2.5 pl-3.5 pr-2 py-2 rounded-lg transition-all duration-150"
                                  style={
                                    active
                                      ? { backgroundColor: T.active, color: T.primary, fontWeight: 600 }
                                      : { color: "#4b5563" }
                                  }
                                  onMouseEnter={(e) => {
                                    if (!active) e.currentTarget.style.backgroundColor = T.hover;
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                                  }}
                                >
                                  {/* แถบเขียวบอกหน้าที่กำลังเปิด */}
                                  {active && (
                                    <motion.span
                                      initial={{ scaleY: 0 }}
                                      animate={{ scaleY: 1 }}
                                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full origin-center"
                                      style={{ backgroundColor: T.mid }}
                                    />
                                  )}
                                  <ItemIcon size={16} className="mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs leading-snug">{item.label}</div>
                                    {item.desc && (
                                      <div className="text-[10px] text-gray-400 leading-snug mt-0.5">
                                        {item.desc}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}