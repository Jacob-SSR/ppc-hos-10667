import {
    LayoutDashboard,
    BarChart3,
    FileEdit,
    UserX,
    Smile,
    UserRound,
    UserCheck,
    Users,
    HeartPulse,
    Activity,
    Baby
} from "lucide-react";

import { SidebarItem } from "./types";

export const DASHBOARD_ITEMS: SidebarItem[] = [
    {
        label: "Overview",
        href: "/pages/dashboard",
        icon: LayoutDashboard
    },
    {
        label: "สถิติผู้รับบริการแยกเวร",
        href: "/pages/shift-stats",
        icon: BarChart3
    }
];

export const REPORT_ITEMS: SidebarItem[] = [
    {
        label: "แก้ไขสิทธิ์หลัก 10667 เป็น CUP Split",
        href: "/pages/report",
        icon: FileEdit
    },
    {
        label: "คนไทยที่ยังไม่มี endpoint",
        href: "/pages/no-endpoint",
        icon: UserX
    },
    {
        label: "UC ต่างจังหวัดที่มาทำฟัน",
        href: "/pages/uc-outside-dental",
        icon: Smile
    },
    {
        label: "ผู้ป่วยนอก UC สิทธิ์ต่างจังหวัด",
        href: "/pages/uc-outside",
        icon: UserRound
    },
    {
        label: "ผู้รับบริการแต่ขึ้นทะเบียนบัตรทองที่อื่น",
        href: "/pages/service-unit",
        icon: UserCheck
    }
];

export const PPA_ITEMS: SidebarItem[] = [
    {
        label: "Aging (ผู้สูงอายุ)",
        href: "/pages/ppa/aging",
        icon: Users,
        desc: "คัดกรองสมอง/หกล้ม อายุ ≥ 50 ปี"
    },
    {
        label: "NCD01 (คัดกรอง DM/HT)",
        href: "/pages/ppa/ncd01",
        icon: HeartPulse,
        desc: "ข้อมูลการคัดกรองโรคเรื้อรัง"
    },
    {
        label: "NCD02 (R73/R030)",
        href: "/pages/ppa/ncd02",
        icon: Activity,
        desc: "วินิจฉัย R73 หรือ R030"
    },
    {
        label: "MCH01 (ANC)",
        href: "/pages/ppa/mch01",
        icon: Baby,
        desc: "บริการฝากครรภ์"
    },
    {
        label: "MCH02 (คลอด)",
        href: "/pages/ppa/mch02",
        icon: Baby,
        desc: "ข้อมูลการคลอด"
    },
    {
        label: "MCH03 (วางแผนครอบครัว)",
        href: "/pages/ppa/mch-woman",
        icon: Baby,
        desc: "คุมกำเนิด/วางแผนครอบครัว อายุ 15-49 ปี"
    },
    {
        label: "MCH04 (พัฒนาการเด็ก)",
        href: "/pages/ppa/mch04",
        icon: Baby,
        desc: "คัดกรองพัฒนาการเด็ก DSPM"
    }
];