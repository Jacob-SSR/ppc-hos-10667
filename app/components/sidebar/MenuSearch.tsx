"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { Search, X, ExternalLink } from "lucide-react";
import type { SidebarItem } from "./types";

export type SearchItem = Pick<SidebarItem, "label" | "href" | "icon" | "desc"> & {
  category: string;
  external?: boolean;
};

export function searchMenu(items: SearchItem[], query: string) {
  const words = query.normalize("NFKC").toLowerCase().trim().split(/\s+/);
  const seen = new Set<string>();
  return items.filter((item) => {
    const text = `${item.label} ${item.category} ${item.desc ?? ""}`.normalize("NFKC").toLowerCase();
    if (!words.every((word) => text.includes(word)) || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

export default function MenuSearch({ items, query, onQueryChange, pathname }: {
  items: SearchItem[];
  query: string;
  onQueryChange: (query: string) => void;
  pathname: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  const results = searching ? searchMenu(items, query) : [];
  const clear = () => {
    onQueryChange("");
    input.current?.focus();
  };

  return (
    <>
      <div className="shrink-0 px-4 pt-4 pb-2">
        <label htmlFor={id} className="sr-only">ค้นหาเมนู</label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 focus-within:border-[#3aa36a] focus-within:ring-2 focus-within:ring-[#d6f0e0]">
          <Search size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
          <input
            ref={input}
            id={id}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                clear();
              }
            }}
            placeholder="ค้นหาเมนู..."
            autoComplete="off"
            className="min-w-0 w-full bg-transparent py-2.5 text-sm text-gray-700 outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={clear} aria-label="ล้างคำค้นหา" className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#3aa36a]">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {searching && <p role="status" className="pt-2 text-xs text-gray-500">พบ {results.length} เมนู</p>}
      </div>
      {searching && (
        <nav aria-label="ผลการค้นหาเมนู" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs leading-relaxed text-gray-500">ไม่พบเมนูที่ตรงกับคำค้นหา<br />ลองค้นด้วยชื่อเมนูหรือหมวดอื่น</p>
          ) : results.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => onQueryChange("")}
                className={`my-1 flex items-start gap-2 rounded-lg px-2.5 py-3 focus-visible:outline-2 focus-visible:outline-[#3aa36a] ${active ? "bg-[#d6f0e0] text-[#1a5233]" : "text-gray-600 hover:bg-[#e8f5ee]"}`}>
                <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="block text-xs font-medium leading-relaxed">{item.label}</span>
                  <span className="mt-1 block text-[10px] text-gray-500">{item.category}</span>
                  {item.desc && <span className="block text-[10px] text-gray-500">{item.desc}</span>}
                </span>
                {item.external && <ExternalLink size={12} className="mt-1 shrink-0" aria-label="เปิดในแท็บใหม่" />}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
