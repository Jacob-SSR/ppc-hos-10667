// app/pages/billing-dashboard/components/billing.constants.ts

export const SHORT_LABELS: Record<string, string> = {
  "บริการฉีดวัคซีนพื้นฐานตามกาหนดการให้วัคซีนตามแผนงานสร้างเสริมภูมิคุ้มกันโรค (EPI) ของกระทรวงสาธารณสุข":
    "วัคซีน EPI",
  "บริการฉีดวัคซีนคอตีบ-บาดทะยัก (dT) ในผู้ใหญ่": "วัคซีน dT",
  "บริการควบคุมป้องกันและรักษาผู้ป่วยเบาหวาน หรือความดันโลหิตสูง": "ควบคุม DM/HT",
  "บริการผู้ป่วยเบาหวานชนิดที่ 2": "เบาหวาน T2",
  "บริการโรคความดันโลหิตสูง": "ความดันโลหิตสูง",
};

export const ALL_SERVICES = [
  "รวมทั้งหมด",
  "วัคซีน EPI",
  "วัคซีน dT",
  "ควบคุม DM/HT",
  "เบาหวาน T2",
  "ความดันโลหิตสูง",
] as const;

export type ServiceKey = (typeof ALL_SERVICES)[number];

export const SERVICE_COLORS: Record<
  string,
  { claim: string; comp: string; pending: string; label: string }
> = {
  "วัคซีน EPI": {
    claim: "#60a5fa",
    comp: "#34d399",
    pending: "#fca5a5",
    label: "วัคซีน EPI พื้นฐาน",
  },
  "วัคซีน dT": {
    claim: "#818cf8",
    comp: "#6ee7b7",
    pending: "#f9a8d4",
    label: "วัคซีน dT คอตีบ-บาดทะยัก",
  },
  "ควบคุม DM/HT": {
    claim: "#fbbf24",
    comp: "#4ade80",
    pending: "#fb923c",
    label: "ควบคุม DM/HT",
  },
  "เบาหวาน T2": {
    claim: "#a78bfa",
    comp: "#86efac",
    pending: "#fda4af",
    label: "ผู้ป่วยเบาหวานชนิดที่ 2",
  },
  "ความดันโลหิตสูง": {
    claim: "#38bdf8",
    comp: "#4ade80",
    pending: "#f87171",
    label: "โรคความดันโลหิตสูง",
  },
  "รวมทั้งหมด": {
    claim: "#85B7EB",
    comp: "#97C459",
    pending: "#F09595",
    label: "รวมทั้งหมด",
  },
};

export const fmt = (n: number) => n.toLocaleString("th-TH");
export const fmtB = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });