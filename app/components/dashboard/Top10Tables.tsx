"use client";

import { useEffect, useState } from "react";

interface Top10Row {
  rank: number;
  icd10: string;
  name: string;
  visits: number;
  patients: number;
}

interface TableProps {
  title: string;
  rows: Top10Row[];
  loading: boolean;
}

function Top10Table({ title, rows, loading }: TableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
      <h2 className="text-sm font-bold text-gray-600 mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-green-700">
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">#</th>
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">ICD10</th>
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">การวินิจฉัย</th>
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">ครั้ง</th>
              <th className="px-3 py-2 text-left text-white font-semibold">ผู้ป่วย</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5 border-r border-gray-100">
                      <div className="h-3 rounded bg-gray-100 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  ไม่พบข้อมูลในช่วงนี้
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-green-50/60 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="px-3 py-2 text-gray-500 font-medium">{r.rank}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono">{r.icd10}</td>
                  <td className="px-3 py-2 text-gray-700">{r.name}</td>
                  <td className="px-3 py-2 text-gray-800 font-bold">{r.visits.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-600">{r.patients.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Top10TablesProps {
  start: string;
  end: string;
}

export default function Top10Tables({ start, end }: Top10TablesProps) {
  const [opd, setOpd] = useState<Top10Row[]>([]);
  const [ipd, setIpd] = useState<Top10Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard/top10?start=${start}&end=${end}`,
          { credentials: "include" },
        );
        const data = await res.json();
        if (cancelled) return;
        setOpd(Array.isArray(data.opd) ? data.opd : []);
        setIpd(Array.isArray(data.ipd) ? data.ipd : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [start, end]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Top10Table title="10 อันดับผู้ป่วยนอก OPD" rows={opd} loading={loading} />
      <Top10Table title="10 อันดับผู้ป่วยใน IPD" rows={ipd} loading={loading} />
    </div>
  );
}