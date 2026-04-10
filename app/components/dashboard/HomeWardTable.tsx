"use client";

import { useEffect, useState } from "react";
import { BedDouble, Plus } from "lucide-react";
import { formatThaiDate } from "@/lib/dateUtils";

interface DischargeRow {
  dchtype_name: string;
  hn: string;
  pname: string;
  fname: string;
  lname: string;
  ward_code: string;
  regdate: string;
  dchdate: string;
  los: number;
  pttype_name: string;
}

const WARD_LABELS: Record<string, string> = {
  "01": "Ward 01 ผู้ป่วยใน",
  "04": "Ward 04 ห้องพิเศษ",
  "14": "HW ยาเสพติด",
  "15": "พลับพลารักษ์",
};

const HOME_WARDS = ["01", "04"];
const NON_HOME_WARDS = ["14", "15"];

interface HomeWardTableProps {
  start: string;
  end: string;
}

function StatusBadge({ dchdate }: { dchdate: string }) {
  const discharged = dchdate && dchdate !== "null" && dchdate !== "";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${discharged ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
      {discharged ? "จำหน่าย" : "รับใหม่"}
    </span>
  );
}

function WardTable({ rows, title }: { rows: DischargeRow[]; title: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BedDouble size={16} className="text-green-700" />
          <h2 className="text-sm font-bold text-gray-600">{title}</h2>
        </div>
        <button className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
          <Plus size={13} /> เพิ่ม
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">ไม่พบข้อมูล</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-green-700">
                {["HN", "ชื่อ-สกุล", "Ward", "วันรับ", "วันจำหน่าย", "สิทธิ์", "LOS", "สถานะ"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap border-r border-green-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-green-50/60 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="px-3 py-2 text-gray-700">{r.hn}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.pname}{r.fname} {r.lname}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{WARD_LABELS[r.ward_code] ?? r.ward_code}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatThaiDate(r.regdate)}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.dchdate ? formatThaiDate(r.dchdate) : "-"}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.pttype_name}</td>
                  <td className="px-3 py-2 text-gray-700">{r.los ?? "-"}</td>
                  <td className="px-3 py-2"><StatusBadge dchdate={r.dchdate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HomeWardTable({ start, end }: HomeWardTableProps) {
  const [rows, setRows] = useState<DischargeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ipd/discharge?start=${start}&end=${end}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [start, end]);

  const homeRows = rows.filter((r) => HOME_WARDS.includes(r.ward_code));
  const nonHomeRows = rows.filter((r) => NON_HOME_WARDS.includes(r.ward_code));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-gray-200 animate-pulse rounded-xl" />
        <div className="h-40 bg-gray-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WardTable rows={homeRows} title="รวม Home Ward (Ward 01 + 04)" />
      <WardTable rows={nonHomeRows} title="ไม่รวม Home Ward (HW ยาเสพติด + พลับพลารักษ์)" />
    </div>
  );
}