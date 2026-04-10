"use client";

const OPD_MOCK = [
  { rank: 1, icd10: "J00", name: "ไข้หวัด", count: 120 },
  { rank: 2, icd10: "E11", name: "เบาหวาน", count: 98 },
  { rank: 3, icd10: "I10", name: "ความดันโลหิตสูง", count: 87 },
  { rank: 4, icd10: "K29", name: "กระเพาะอาหารอักเสบ", count: 65 },
  { rank: 5, icd10: "J18", name: "ปอดอักเสบ", count: 54 },
  { rank: 6, icd10: "M79", name: "ปวดกล้ามเนื้อ", count: 48 },
  { rank: 7, icd10: "Z00", name: "ตรวจสุขภาพ", count: 42 },
  { rank: 8, icd10: "A09", name: "ท้องเสีย", count: 38 },
  { rank: 9, icd10: "L30", name: "โรคผิวหนัง", count: 30 },
  { rank: 10, icd10: "N39", name: "ติดเชื้อทางเดินปัสสาวะ", count: 25 },
];

const IPD_MOCK = [
  { rank: 1, icd10: "J18", name: "ปอดอักเสบ", count: 45 },
  { rank: 2, icd10: "I50", name: "หัวใจล้มเหลว", count: 32 },
  { rank: 3, icd10: "E11", name: "เบาหวาน (DM)", count: 28 },
  { rank: 4, icd10: "A09", name: "ท้องเสียรุนแรง", count: 22 },
  { rank: 5, icd10: "I63", name: "Stroke", count: 19 },
  { rank: 6, icd10: "N18", name: "ไตวายเรื้อรัง", count: 15 },
  { rank: 7, icd10: "K92", name: "เลือดออก GI", count: 12 },
  { rank: 8, icd10: "J44", name: "COPD", count: 10 },
  { rank: 9, icd10: "S72", name: "กระดูกสะโพกหัก", count: 8 },
  { rank: 10, icd10: "O80", name: "คลอดปกติ", count: 6 },
];

interface TableProps {
  title: string;
  rows: typeof OPD_MOCK;
}

function Top10Table({ title, rows }: TableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
      <h2 className="text-sm font-bold text-gray-600 mb-3">{title}</h2>
      <div className="flex gap-2 mb-3">
        <span className="bg-green-100 text-green-800 text-[11px] font-semibold px-3 py-0.5 rounded-full">ICD10</span>
        <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-3 py-0.5 rounded-full">Diag</span>
        <span className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-3 py-0.5 rounded-full">อื่นๆ</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-green-700">
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">#</th>
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">ICD10</th>
              <th className="px-3 py-2 text-left text-white font-semibold border-r border-green-600">การวินิจฉัย</th>
              <th className="px-3 py-2 text-left text-white font-semibold">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-gray-100 hover:bg-green-50/60 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="px-3 py-2 text-gray-500 font-medium">{r.rank}</td>
                <td className="px-3 py-2 text-gray-700 font-mono">{r.icd10}</td>
                <td className="px-3 py-2 text-gray-700">{r.name}</td>
                <td className="px-3 py-2 text-gray-800 font-bold">{r.count.toLocaleString()}</td>
              </tr>
            ))}
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Top10Table title="10 อันดับผู้ป่วยนอก OPD" rows={OPD_MOCK} />
      <Top10Table title="10 อันดับผู้ป่วยใน IPD" rows={IPD_MOCK} />
    </div>
  );
}