"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Search,
  Info,
  ArrowRight,
  BedDouble,
} from "lucide-react";
import DatePicker from "react-datepicker";
import { th } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import ThaiDateInput from "@/app/components/ThaiDateInput";

// ward config ต้องตรงกับ WARD_CONFIG ใน lib/ipd.service.ts
const WARD_CONFIG: Record<string, { label: string; totalBeds: number }> = {
  "1": { label: "ผู้ป่วยใน", totalBeds: 39 },
  "4": { label: "ห้องพิเศษ", totalBeds: 14 },
  "13": { label: "Ward LR", totalBeds: 10 },
  "14": { label: "HW ยาเสพติด", totalBeds: 31 },
  "15": { label: "พลับพลารักษ์", totalBeds: 10 },
  "16": { label: "HW Palliative", totalBeds: 5 },
  "17": { label: "IMC", totalBeds: 3 },
};

function Shimmer() {
  return (
    <div className="h-[190px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" />
  );
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

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fetchIpd = async () => {
    if (!start || !end) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/ipd/summary?start=${fmt(start)}&end=${fmt(end)}`,
        { credentials: "include" },
      );
      if (res.ok) setSummaryData(await res.json());
    } catch {}
    setFetching(false);
  };

  useEffect(() => {
    fetchIpd();
  }, []); // eslint-disable-line

  const isLoading = loading || fetching;

  // สร้างการ์ดจาก WARD_CONFIG merge กับ API data
  const displayWards = Object.entries(WARD_CONFIG).map(([wc, cfg]) => {
    const apiWard = summaryData?.byWard?.find(
      (w: any) => String(w.ward_code) === wc,
    );
    const admit = apiWard?.admit_total ?? 0;
    const vacant = cfg.totalBeds - admit;
    const vacantLabel =
      vacant <= 0
        ? "เต็ม"
        : admit === 0
          ? `ว่าง ${cfg.totalBeds}`
          : `ว่าง ${vacant}`;
    return {
      ward_code: wc,
      label: cfg.label,
      totalBeds: cfg.totalBeds,
      admit,
      vacantLabel,
    };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-lg font-bold text-[#717171] mb-3">
        ภาพรวมผู้รับบริการ IPD วันนี้
      </h4>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2 text-[#717171]">
          <CalendarDays size={16} />
          <div>
            <p className="text-sm">ข้อมูลตามช่วงเวลา (สำหรับ การ์ด)</p>
            <p className="text-xs text-gray-400">เลือกช่วงเวลาที่ต้องการ</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white">
            <option>วันนี้</option>
          </select>
          <DatePicker
            selected={start}
            onChange={(d: Date | null) => setStart(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <DatePicker
            selected={end}
            onChange={(d: Date | null) => setEnd(d)}
            dateFormat="dd/MM/yyyy"
            locale={th}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            customInput={<ThaiDateInput />}
          />
          <button
            onClick={fetchIpd}
            disabled={fetching}
            className="border border-gray-300 rounded px-3 py-1.5 flex items-center gap-1.5 text-sm hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            <Search size={14} /> ค้นหา
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#717171] mb-4">
        <Info size={14} />
        <span>
          แสดงข้อมูล การ์ด:{" "}
          <span className="font-bold">วันนี้ ({thaiDate})</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} />)
          : displayWards.map((ward, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-700 text-center">
                  {ward.label}
                </p>
                <BedDouble
                  size={52}
                  strokeWidth={1.5}
                  className="text-gray-800 my-1"
                />
                <p className="text-base font-bold text-gray-900 text-center">
                  Admit {ward.admit}/{ward.totalBeds} เตียง
                </p>
                <p className="text-xs text-gray-500">({ward.vacantLabel})</p>
                <button className="flex items-center gap-1.5 border border-gray-300 rounded-full px-4 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors mt-1">
                  รายละเอียด <ArrowRight size={12} />
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}
