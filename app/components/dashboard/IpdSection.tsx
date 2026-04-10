"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Search, Info, ArrowRight, BedDouble } from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";

const WARD_LABELS: Record<string, string> = {
  "01": "ผู้ป่วยใน",
  "04": "ห้องพิเศษ",
  "14": "HW ยาเสพติด",
  "15": "พลับพลารักษ์",
};

const WARD_COLORS: Record<string, string> = {
  "01": "bg-[#60a5fa]",
  "04": "bg-[#fb923c]",
  "14": "bg-[#f472b6]",
  "15": "bg-[#4ade80]",
};

const STATIC_CARDS = [
  { label: "จำหน่ายวันนี้", color: "bg-[#a78bfa]", icon: "discharge" },
  { label: "รับใหม่วันนี้", color: "bg-[#2dd4bf]", icon: "admit" },
  { label: "Refer Out IPD", color: "bg-[#f87171]", icon: "refer" },
  { label: "อัตราครองเตียง", color: "bg-[#fbbf24]", icon: "rate" },
];

function Shimmer() {
  return <div className="h-[160px] rounded-xl bg-gray-200 animate-pulse" />;
}

interface IpdSectionProps {
  loading: boolean;
  dateLabel: string;
}

export default function IpdSection({ loading, dateLabel }: IpdSectionProps) {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [start, setStart] = useState<Date | null>(new Date());
  const [end, setEnd] = useState<Date | null>(new Date());

  const thaiDate = (() => {
    if (!dateLabel) return "";
    const [y, m, d] = dateLabel.split("-");
    return `${d}/${m}/${Number(y) + 543}`;
  })();

  const fetchIpd = async () => {
    if (!start || !end) return;
    setFetching(true);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try {
      const res = await fetch(`/api/ipd/summary?start=${fmt(start)}&end=${fmt(end)}`, {
        credentials: "include",
      });
      if (res.ok) setSummaryData(await res.json());
    } catch {}
    setFetching(false);
  };

  useEffect(() => { fetchIpd(); }, []); // eslint-disable-line

  const wardCards = summaryData?.byWard ?? [];
  const isLoading = loading || fetching;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-600 mb-4">ภาพรวมผู้รับบริการ IPD วันนี้</h2>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 text-gray-500">
          <CalendarDays size={15} />
          <span className="text-xs">ข้อมูลตามช่วงเวลา (IPD)</span>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <DatePicker
            selected={start}
            onChange={(d: Date | null) => setStart(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown showYearDropdown dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <DatePicker
            selected={end}
            onChange={(d: Date | null) => setEnd(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown showYearDropdown dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <button
            onClick={fetchIpd}
            disabled={fetching}
            className="border border-gray-300 rounded-md px-3 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 disabled:opacity-50"
          >
            <Search size={12} /> ค้นหา
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <Info size={13} />
        <span>แสดงข้อมูล การ์ด: <strong className="text-gray-700">วันนี้ ({thaiDate})</strong></span>
      </div>

      {/* Ward cards (4 dynamic) + 4 static */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Shimmer key={i} />)
          : <>
              {/* Dynamic ward cards */}
              {(["01","04","14","15"] as const).map((wCode) => {
                const w = wardCards.find((x: any) => x.ward_code === wCode);
                const color = WARD_COLORS[wCode] ?? "bg-gray-400";
                const label = WARD_LABELS[wCode] ?? `Ward ${wCode}`;
                const admit = w?.admit_total ?? 0;
                const total = w?.total ?? 0;
                return (
                  <div key={wCode} className={`${color} rounded-xl p-4 flex flex-col items-center gap-3 text-white`}>
                    <p className="text-xs font-semibold text-center leading-tight">{label}</p>
                    <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center">
                      <BedDouble size={18} stroke="white" />
                    </div>
                    <p className="text-xs font-bold text-center">Admit {admit}/{w?.unique_patients ?? 0} เตียง</p>
                    <p className="text-[10px] opacity-80">จำหน่าย {total} ราย</p>
                    <button className="flex items-center gap-1 border border-white/80 rounded-full px-3 py-1 text-[11px] hover:bg-white/20 transition-colors">
                      รายละเอียด <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}

              {/* Static summary cards */}
              {STATIC_CARDS.map((card, i) => {
                const total = summaryData?.summary;
                const displayMap: Record<string, string> = {
                  discharge: `${total?.total ?? 0} ราย`,
                  admit: `${wardCards.reduce((a: number, b: any) => a + (b.admit_total ?? 0), 0)} ราย`,
                  refer: "0 ราย",
                  rate: total ? `${Math.round((total.unique_patients / Math.max(total.total, 1)) * 100)}%` : "—",
                };
                return (
                  <div key={i} className={`${card.color} rounded-xl p-4 flex flex-col items-center gap-3 text-white`}>
                    <p className="text-xs font-semibold text-center leading-tight">{card.label}</p>
                    <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center">
                      <BedDouble size={18} stroke="white" />
                    </div>
                    <p className="text-xs font-bold text-center">{displayMap[card.icon]}</p>
                    <button className="flex items-center gap-1 border border-white/80 rounded-full px-3 py-1 text-[11px] hover:bg-white/20 transition-colors">
                      รายละเอียด <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </>
        }
      </div>
    </div>
  );
}