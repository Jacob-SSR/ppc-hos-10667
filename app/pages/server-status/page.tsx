"use client";

import { useCallback, useEffect, useState } from "react";

interface DiskInfo {
    mount: string;
    total: number;
    used: number;
}

interface ServerStats {
    name: string;
    online: boolean;
    error?: string;
    ram?: { total: number; used: number };
    disks?: DiskInfo[];
    uptimeSec?: number;
}

// ตั้งเป็น 0 = ไม่ auto refresh (กดปุ่มเอง) / ใส่ 30000 = refresh ทุก 30 วิ
const REFRESH_MS = 0;

function formatBytes(bytes: number): string {
    if (!bytes) return "0 GB";
    const gb = bytes / 1024 ** 3;
    if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(1)} GB`;
}

function formatUptime(sec?: number): string {
    if (!sec) return "-";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return d > 0 ? `${d} วัน ${h} ชม.` : `${h} ชม. ${Math.floor((sec % 3600) / 60)} นาที`;
}

function barColor(pct: number): string {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
}

function UsageBar({
    label,
    used,
    total,
}: {
    label: string;
    used: number;
    total: number;
}) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="text-gray-500">
                    {formatBytes(used)} / {formatBytes(total)}{" "}
                    <span className="font-semibold text-gray-700">({pct.toFixed(0)}%)</span>
                </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function ServerCard({ server }: { server: ServerStats }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">{server.name}</h2>
                </div>
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${server.online
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                        }`}
                >
                    <span
                        className={`h-2 w-2 rounded-full ${server.online ? "bg-emerald-500" : "bg-red-500"
                            }`}
                    />
                    {server.online ? "Online" : "Offline"}
                </span>
            </div>

            {server.online ? (
                <div className="space-y-4">
                    {server.ram && (
                        <UsageBar label="RAM" used={server.ram.used} total={server.ram.total} />
                    )}
                    {server.disks?.map((d) => (
                        <UsageBar
                            key={d.mount}
                            label={`Disk ${d.mount}`}
                            used={d.used}
                            total={d.total}
                        />
                    ))}
                    <p className="pt-1 text-xs text-gray-400">
                        Uptime: {formatUptime(server.uptimeSec)}
                    </p>
                </div>
            ) : (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    เชื่อมต่อไม่ได้: {server.error}
                </p>
            )}
        </div>
    );
}

export default function ServerStatusPage() {
    const [servers, setServers] = useState<ServerStats[]>([]);
    const [fetchedAt, setFetchedAt] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/server-status", { cache: "no-store" });
            const data = await res.json();
            setServers(data.servers || []);
            setFetchedAt(data.fetchedAt || "");
        } catch {
            // ปล่อยข้อมูลเดิมค้างไว้ ถ้าดึงรอบใหม่ไม่สำเร็จ
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        if (REFRESH_MS > 0) {
            const t = setInterval(load, REFRESH_MS);
            return () => clearInterval(t);
        }
    }, [load]);

    return (
        <main className="mx-auto max-w-6xl p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">สถานะเซิร์ฟเวอร์</h1>
                    <p className="text-sm text-gray-500">
                        RAM และ Harddisk ของเครื่องในระบบ
                        {fetchedAt &&
                            ` · อัปเดตล่าสุด ${new Date(fetchedAt).toLocaleTimeString("th-TH")}`}
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "กำลังโหลด..." : "รีเฟรช"}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {servers.map((s, i) => (
                    <ServerCard key={`${s.name}-${i}`} server={s} />
                ))}
                {!servers.length && loading && (
                    <p className="text-gray-500">กำลังดึงข้อมูลจากทั้ง 3 เครื่อง...</p>
                )}
            </div>
        </main>
    );
}