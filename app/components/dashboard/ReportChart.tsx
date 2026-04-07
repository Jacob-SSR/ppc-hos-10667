"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "ต.ค.", opd: 4800, ipd: 1200 },
  { name: "พ.ย.", opd: 3000, ipd: 2800 },
  { name: "ธ.ค.", opd: 3300, ipd: 300 },
  { name: "ม.ค.", opd: 4700, ipd: 800 },
  { name: "ก.พ.", opd: 2800, ipd: 2200 },
  { name: "มี.ค.", opd: 1300, ipd: 1500 },
];

export default function ReportChart() {
  return (
    <div className="bg-white p-4 rounded-lg">
      <h2 className="text-center mb-4 font-semibold">
        แสดงจำนวนผู้รับบริการ ปีงบประมาณ 2569
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />

          {/* ฟ้า */}
          <Bar dataKey="opd" stackId="a" fill="#2fa4db" />

          {/* แดง */}
          <Bar dataKey="ipd" stackId="a" fill="#ff1a1a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
