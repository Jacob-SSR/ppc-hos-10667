"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarItem } from "./types";

type Props = {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  items: SidebarItem[];
  isOpen: boolean;
  onToggle: () => void;
  isActive: boolean;
};

export default function NavGroup({
  label,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  isActive,
}: Props) {
  const pathname = usePathname();

  const isItemActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="pt-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left"
        style={
          isActive || isOpen
            ? { backgroundColor: "#d6f0e0", color: "#1a5233", fontWeight: 600 }
            : { color: "#4b5563" }
        }
        onMouseEnter={(e) => {
          if (!isActive && !isOpen)
            e.currentTarget.style.backgroundColor = "#e8f5ee";
        }}
        onMouseLeave={(e) => {
          if (!isActive && !isOpen)
            e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Icon size={18} />
        <span className="flex-1 text-sm">{label}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mt-1 ml-3 pl-3 border-l-2 space-y-1"
              style={{ borderColor: "#a8d5ba" }}
            >
              {items.map((item) => {
                const active = isItemActive(item.href);
                const ItemIcon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-2 px-2 py-2 rounded-md transition-all"
                    style={
                      active
                        ? { backgroundColor: "#c2e8d4", color: "#1a5233", fontWeight: 600 }
                        : { color: "#4b5563" }
                    }
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.backgroundColor = "#e8f5ee";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <ItemIcon size={16} />
                    <div>
                      <div className="text-xs">{item.label}</div>
                      {item.desc && (
                        <div className="text-[10px] text-gray-400">
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
}