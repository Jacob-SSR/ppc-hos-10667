import { LucideIcon } from "lucide-react";

export type SidebarGroup =
  | "main"
  | "claim"
  | "disease"
  | "report"
  | "primarycare"
  | "ppa"
  | "settings";

export type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  desc?: string;
  group: SidebarGroup;
};

export type SidebarSubGroup = {
  title: string;
  items: SidebarItem[];
};
