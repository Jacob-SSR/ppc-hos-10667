"use client";

import { useEffect, useState } from "react";
import { BedDouble } from "lucide-react";
import { SectionCard, HBarList } from "@/app/components/dashboard/live";

interface PttypeCount {
    name: string;
    count: number;
}
interface WardGroupSummary {
    key: string;
    label: string;
    discharged: number;
    avgLos: number;
    byPttype: PttypeCount[];
}
interface SummaryResponse {
    groups: WardGroupSummary[];
}

const BAR_COLORS = ["#7ec8a0", "#85B7EB", "#EF9F27", "#c084fc", "#f472b6", "#60a5fa"];

function GroupCard({ g }: { g: WardGroupSummary }) {
    return (
        <SectionCard title={g.label} icon={BedDouble} titleColor="#1a5233">
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                    className="rounded-xl px-4 py-3 border"
                    style={{ backgroundColor: "#f0faf4", borderColor: "#a8d5ba" }}
                >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 mb-1">
                        จำหน่ายในช่วง
                    </p>
                    <p className="text-2xl font-extrabold tabular-nums text-green-800">
                        {g.discharged.toLocaleString()}
                        <span className="text-sm font-medium ml-1">ราย</span>
                    </p>
                </div>
                <div
                    className="rounded-xl px-4 py-3 border"
                    style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}
                >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        LOS เฉลี่ย
                    </p>
                    <p className="text-2xl font-extrabold tabular-nums text-gray-700">
                        {g.avgLos.toFixed(1)}
                        <span className="text-sm font-medium ml-1">วัน</span>
                    </p>
                </div>
            </div>

            {g.byPttype.length > 0 ? (
                <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                        แยกตามสิทธิ์
                    </p>
                    <HBarList
                        data={g.byPttype.map((p) => [p.name, p.count] as [string, number])}
                        total={g.discharged}
                        colors={BAR_COLORS}
                        labelWidth={150}
                    />
                </>
            ) : (
                <p className="text-xs text-gray-400 text-center py-6">ไม่พบข้อมูลในช่วงนี้</p>
            )}
        </SectionCard>
    );
}

export default function HomeWardSummaryCard({
    start,
    end,
}: {
    start: string;
    end: string;
}) {
    const [groups, setGroups] = useState<WardGroupSummary[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/ipd/ward-summary?start=${start}&end=${end}`,
                    { credentials: "include" },
                );
                const d: SummaryResponse = await res.json();
                if (!cancelled) setGroups(d.groups ?? []);
            } catch {
                if (!cancelled) setGroups([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [start, end]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-56 bg-gray-100 animate-pulse rounded-2xl" />
                <div className="h-56 bg-gray-100 animate-pulse rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(groups ?? []).map((g) => (
                <GroupCard key={g.key} g={g} />
            ))}
        </div>
    );
}