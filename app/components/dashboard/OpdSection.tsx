"use client";

import { CalendarDays, Search, Info, ArrowRight, User } from "lucide-react";
import { useState } from "react";

const OPD_CARDS = [
  { label: "ผู้รับบริการทั้งหมด", color: "bg-[#22d3ee]", key: "totalVisit", patKey: "totalPatient" },
  { label: "OPD สิทธิ์ UC", color: "bg-[#4ade80]", key: "totalVisit", patKey: "totalPatient" },
  { label: "OPD สิทธิ์ราชการ", color: "bg-[#a78bfa]", key: null, patKey: null },
  { label: "OPD สิทธิ์ประกันสังคม", color: "bg-[#f472b6]", key: null, patKey: null },
  { label: "OPD ไม่มี Endpoint", color: "bg-[#f87171]", key: "noEndpoint", patKey: null },
  { label: "OPD UC ต่างจังหวัด", color: "bg-[#fb923c]", key: "ucOutside", patKey: null },
  { label: "OPD ทำฟัน UC", color: "bg-[#60a5fa]", key: "ucOutsideDental", patKey: null },
  { label: "OPD รับชำระเงิน", color: "bg-[#2dd4bf]", key: null, patKey: null },
  { label: "OPD เบิก DF", color: "bg-[#fb7185]", key: null, patKey: null },
  { label: "OPD Refer In", color: "bg-[#818cf8]", key: null, patKey: null },
  { label: "OPD Refer Out", color: "bg-[#fbbf24]", key: null, patKey: null },
  { label: "OPD รายได้รวม", color: "bg-[#a3e635]", key: "unpaidTotal", patKey: null },
];

function Shimmer() {
  return <div className="h-[160px] rounded-xl bg-gray-200 animate-pulse" />;
}

interface OpdSectionProps {
  data: any;
  loading: boolean;
  dateLabel: string;
}

export default function OpdSection({ data, loading, dateLabel }: OpdSectionProps) {
  const [preset, setPreset] = useState("วันนี้");

  const thaiDate = (() => {
    if (!dateLabel) return "";
    const [y, m, d] = dateLabel.split("-");
    return `${d}/${m}/${Number(y) + 543}`;
  })();

  const getValue = (key: string | null) => {
    if (!key || !data?.summary) return null;
    const v = data.summary[key];
    if (v == null) return null;
    return Number(v).toLocaleString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      {/* Title */}
      <h2 className="text-sm font-bold text-gray-600 mb-4">ภาพรวมผู้รับบริการ OPD วันนี้</h2>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 text-gray-500">
          <CalendarDays size={15} />
          <span className="text-xs">ข้อมูลตามช่วงเวลา (สำหรับการ์ด)</span>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-600 bg-white"
          >
            <option>วันนี้</option>
            <option>สัปดาห์นี้</option>
            <option>เดือนนี้</option>
          </select>
          <input readOnly value={thaiDate} className="border border-gray-300 rounded-md px-2 py-1 text-xs w-[110px]" />
          <input readOnly value={thaiDate} className="border border-gray-300 rounded-md px-2 py-1 text-xs w-[110px]" />
          <button className="border border-gray-300 rounded-md px-3 py-1 text-xs flex items-center gap-1 hover:bg-gray-50">
            <Search size={12} /> ค้นหา
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <Info size={13} />
        <span>แสดงข้อมูล การ์ด: <strong className="text-gray-700">วันนี้ ({thaiDate})</strong></span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <Shimmer key={i} />)
          : OPD_CARDS.map((card, i) => {
              const visits = getValue(card.key);
              const patients = getValue(card.patKey);
              const display =
                visits != null && patients != null
                  ? `${patients} คน (${visits} ครั้ง)`
                  : visits != null
                  ? `${visits} ราย`
                  : "999 คน (1,000 ครั้ง)";

              return (
                <div
                  key={i}
                  className={`${card.color} rounded-xl p-4 flex flex-col items-center gap-3 text-white`}
                >
                  <p className="text-xs font-semibold text-center leading-tight opacity-95">{card.label}</p>
                  <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center">
                    <User size={18} fill="white" stroke="none" />
                  </div>
                  <p className="text-xs font-bold text-center">{display}</p>
                  <button className="flex items-center gap-1 border border-white/80 rounded-full px-3 py-1 text-[11px] hover:bg-white/20 transition-colors">
                    รายละเอียด <ArrowRight size={11} />
                  </button>
                </div>
              );
            })}
      </div>
    </div>
  );
}