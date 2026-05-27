"use client";

import { useState } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import {
  ChevronDown,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  SidebarSubGroup,
} from "./types";

type Props = {
  label: string;

  icon: React.ComponentType<{
    size?: number;
  }>;

  groups: SidebarSubGroup[];

  isOpen: boolean;

  onToggle: () => void;

  isActive: boolean;
};

export default function NavGroup({
  label,
  icon: Icon,
  groups,
  isOpen,
  onToggle,
  isActive,
}: Props) {
  const pathname =
    usePathname();

  // =========================
  // Sub Dropdown State
  // =========================
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(
      {}
    );

  const toggleSubGroup = (
    title: string
  ) => {
    setOpenGroups((prev) => ({
      ...prev,
      [title]:
        !prev[title],
    }));
  };

  // =========================
  // Active Check
  // =========================
  const isItemActive = (
    href: string
  ) =>
    pathname === href ||
    pathname?.startsWith(
      href + "/"
    );

  return (
    <div className="pt-1">
      {/* ========================= */}
      {/* Main Header */}
      {/* ========================= */}
      <button
        onClick={onToggle}
        className="
          w-full
          flex items-center gap-3
          px-3 py-2
          rounded-md
          transition-all
          text-left
        "
        style={
          isActive || isOpen
            ? {
              backgroundColor:
                "#d6f0e0",
              color: "#1a5233",
              fontWeight: 600,
            }
            : {
              color: "#4b5563",
            }
        }
      >
        <Icon size={18} />

        <span className="flex-1 text-sm">
          {label}
        </span>

        <motion.span
          animate={{
            rotate: isOpen
              ? 180
              : 0,
          }}
        >
          <ChevronDown
            size={16}
          />
        </motion.span>
      </button>

      {/* ========================= */}
      {/* Main Dropdown */}
      {/* ========================= */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              height: 0,
            }}
            animate={{
              height: "auto",
            }}
            exit={{
              height: 0,
            }}
            className="overflow-hidden"
          >
            <div
              className="
                mt-1 ml-3 pl-3
                border-l-2
                space-y-2
              "
              style={{
                borderColor:
                  "#a8d5ba",
              }}
            >
              {groups.map(
                (group) => {
                  const subOpen =
                    openGroups[
                    group.title
                    ] ?? true;

                  return (
                    <div
                      key={
                        group.title
                      }
                    >
                      {/* ========================= */}
                      {/* Sub Group Header */}
                      {/* ========================= */}
                      <button
                        onClick={() =>
                          toggleSubGroup(
                            group.title
                          )
                        }
                        className="
                          w-full
                          flex items-center
                          gap-2
                          px-2 py-1.5
                          rounded-md
                          text-left
                          text-[11px]
                          font-semibold
                          uppercase
                          tracking-wide
                          text-gray-500
                          hover:bg-[#edf7f1]
                          transition-all
                        "
                      >
                        <span className="flex-1">
                          {
                            group.title
                          }
                        </span>

                        <motion.span
                          animate={{
                            rotate:
                              subOpen
                                ? 180
                                : 0,
                          }}
                        >
                          <ChevronDown
                            size={
                              13
                            }
                          />
                        </motion.span>
                      </button>

                      {/* ========================= */}
                      {/* Sub Group Items */}
                      {/* ========================= */}
                      <AnimatePresence>
                        {subOpen && (
                          <motion.div
                            initial={{
                              height: 0,
                            }}
                            animate={{
                              height:
                                "auto",
                            }}
                            exit={{
                              height: 0,
                            }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1 mt-1">
                              {group.items.map(
                                (
                                  item
                                ) => {
                                  const active =
                                    isItemActive(
                                      item.href
                                    );

                                  const ItemIcon =
                                    item.icon;

                                  return (
                                    <Link
                                      key={
                                        item.href
                                      }
                                      href={
                                        item.href
                                      }
                                      className="
                                        flex items-start gap-2
                                        px-2 py-2
                                        rounded-md
                                        transition-all
                                      "
                                      style={
                                        active
                                          ? {
                                            backgroundColor:
                                              "#c2e8d4",
                                            color:
                                              "#1a5233",
                                            fontWeight: 600,
                                          }
                                          : {
                                            color:
                                              "#4b5563",
                                          }
                                      }
                                      onMouseEnter={(
                                        e
                                      ) => {
                                        if (
                                          !active
                                        ) {
                                          e.currentTarget.style.backgroundColor =
                                            "#e8f5ee";
                                        }
                                      }}
                                      onMouseLeave={(
                                        e
                                      ) => {
                                        if (
                                          !active
                                        ) {
                                          e.currentTarget.style.backgroundColor =
                                            "transparent";
                                        }
                                      }}
                                    >
                                      <ItemIcon
                                        size={
                                          16
                                        }
                                      />

                                      <div>
                                        <div className="text-xs">
                                          {
                                            item.label
                                          }
                                        </div>

                                        {item.desc && (
                                          <div className="text-[10px] text-gray-400">
                                            {
                                              item.desc
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </Link>
                                  );
                                }
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}