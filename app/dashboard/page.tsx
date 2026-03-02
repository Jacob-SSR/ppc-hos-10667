"use client";

import { useEffect, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend
);

export default function DashboardPage() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        fetch("/api/dashboard?start=2025-01-01&end=2025-01-31")
            .then((res) => res.json())
            .then(setData);
    }, []);

    if (!data)
        return (
            <div className="p-10 text-lg text-gray-700">
                กำลังโหลดข้อมูล...
            </div>
        );

    const labels = data.daily.map((d: any) =>
        new Date(d.date).toLocaleDateString("th-TH")
    );

    const totalData = data.daily.map((d: any) => d.total);
    const noEndpointData = data.daily.map((d: any) => d.noEndpoint || 0);

    const commonOptions = {
        responsive: true,
        plugins: {
            legend: {
                labels: {
                    color: "#374151",
                    font: {
                        size: 14,
                        family: "Prompt, sans-serif",
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: "#374151",
                    font: {
                        size: 12,
                    },
                },
                grid: {
                    color: "#f3f4f6",
                },
            },
            y: {
                ticks: {
                    color: "#374151",
                    font: {
                        size: 12,
                    },
                },
                grid: {
                    color: "#f3f4f6",
                },
            },
        },
    };

    return (
        <div className="p-10 bg-slate-50 min-h-screen font-[Prompt]">
            <h1 className="text-3xl font-bold text-gray-800 mb-10">
                📊 Dashboard ภาพรวมระบบ
            </h1>

            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <Card
                    title="Total Visit"
                    value={data.summary.totalVisit}
                    color="text-blue-600"
                />
                <Card
                    title="No Endpoint"
                    value={data.summary.noEndpoint}
                    color="text-red-600"
                />
                <Card
                    title="UC Outside"
                    value={data.summary.ucOutside}
                    color="text-emerald-600"
                />
                <Card
                    title="Unpaid (บาท)"
                    value={Number(data.summary.unpaidTotal).toLocaleString()}
                    color="text-amber-600"
                />
            </div>

            {/* Line Chart */}
            <div className="bg-white rounded-3xl shadow-md p-8 mb-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">
                    แนวโน้มจำนวนผู้รับบริการรายวัน
                </h2>
                <Line
                    data={{
                        labels,
                        datasets: [
                            {
                                label: "จำนวน Visit",
                                data: totalData,
                                borderColor: "#2563eb",
                                backgroundColor: "rgba(37,99,235,0.2)",
                                fill: true,
                                tension: 0.3,
                            },
                        ],
                    }}
                    options={commonOptions}
                />
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-3xl shadow-md p-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">
                    จำนวน No Endpoint รายวัน
                </h2>
                <Bar
                    data={{
                        labels,
                        datasets: [
                            {
                                label: "No Endpoint",
                                data: noEndpointData,
                                backgroundColor: "#ef4444",
                                borderRadius: 8,
                            },
                        ],
                    }}
                    options={commonOptions}
                />
            </div>
        </div>
    );
}

function Card({
    title,
    value,
    color,
}: {
    title: string;
    value: any;
    color: string;
}) {
    return (
        <div className="bg-white rounded-3xl shadow-md p-6 transition hover:shadow-lg">
            <p className="text-sm text-gray-500">{title}</p>
            <p className={`text-3xl font-bold mt-2 ${color}`}>
                {value}
            </p>
        </div>
    );
}