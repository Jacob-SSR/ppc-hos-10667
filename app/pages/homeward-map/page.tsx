"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    MapPinned,
    Search,
    X,
    Filter,
    Users,
    MapPin,
    AlertCircle,
    RefreshCw,
    BedDouble,
} from "lucide-react";
import { useFetchOnce } from "@/app/components/dashboard/live/useFetchOnce";
import { timeAgo } from "@/app/components/dashboard/live/timeAgo";
import type {
    HomeWardMapData,
    HomeWardMapPoint,
} from "@/app/api/homeward-map/route";

// ─── สีตามชนิดสารเสพติด ────────────────────────────────────────────────────────
const DRUG_HEX: Record<string, string> = {
    "ยาบ้า/Amphetamine (F15)": "#e2483f",
    "แอลกอฮอล์ (F10)": "#ef8b1f",
    "กัญชา (F12)": "#22a35a",
    "ฝิ่น/Opioids (F11)": "#7f56d9",
    "ยานอนหลับ (F13)": "#2f80ed",
    "ยาหลอนประสาท (F16)": "#e6b800",
    "สารระเหย (F18)": "#0ca7a0",
    "สารเสพติดหลายชนิด (F19)": "#d1568c",
    "จิตเภท (F20)": "#5b6b8c",
    ไม่ระบุ: "#8b8b8b",
};
const drugHex = (t: string) => DRUG_HEX[t] ?? "#8b8b8b";

const HOSPITAL_CENTER: [number, number] = [14.6774, 103.129];
const fmtBaht = (n: number) =>
    n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

// ─── Leaflet types ─────────────────────────────────────────────────────────────
type LeafletNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LLayerGroup = import("leaflet").LayerGroup;

function esc(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── ชิปตัวกรอง ────────────────────────────────────────────────────────────────
function FilterChips({
    label,
    options,
    selected,
    onToggle,
    colorFn,
}: {
    label: string;
    options: string[];
    selected: Set<string>;
    onToggle: (v: string) => void;
    colorFn?: (v: string) => string;
}) {
    if (options.length === 0) return null;
    return (
        <div className="mb-3">
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5">
                {label}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                    const active = selected.has(opt);
                    return (
                        <button
                            key={opt}
                            onClick={() => onToggle(opt)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${active
                                ? "text-white border-transparent"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#1ca887]"
                                }`}
                            style={active ? { background: "#1ca887" } : undefined}
                        >
                            {colorFn && (
                                <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ background: active ? "#fff" : colorFn(opt) }}
                                />
                            )}
                            {opt || "ไม่ระบุ"}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomeWardMapPage() {
    const { data, loading, error } = useFetchOnce<HomeWardMapData>("/api/homeward-map");

    const [q, setQ] = useState("");
    const [fTambon, setFTambon] = useState<Set<string>>(new Set());
    const [fDrug, setFDrug] = useState<Set<string>>(new Set());
    const [fStatus, setFStatus] = useState<Set<string>>(new Set());
    const [fWard, setFWard] = useState<Set<string>>(new Set());
    const [fMonth, setFMonth] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const toggle =
        (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
            (v: string) =>
                setter((prev) => {
                    const next = new Set(prev);
                    next.has(v) ? next.delete(v) : next.add(v);
                    return next;
                });

    const clearAll = () => {
        setQ("");
        setFTambon(new Set());
        setFDrug(new Set());
        setFStatus(new Set());
        setFWard(new Set());
        setFMonth(new Set());
    };

    const activeFilterCount =
        fTambon.size + fDrug.size + fStatus.size + fWard.size + fMonth.size;

    const filtered = useMemo<HomeWardMapPoint[]>(() => {
        if (!data) return [];
        const term = q.trim().toLowerCase();
        return data.points.filter((p) => {
            if (fTambon.size && !fTambon.has(p.tambon)) return false;
            if (fDrug.size && !fDrug.has(p.drugType)) return false;
            if (fWard.size && !fWard.has(p.ward)) return false;
            if (fStatus.size) {
                const st = p.isCompensated ? "ชดเชยแล้ว" : "รอชดเชย";
                if (!fStatus.has(st)) return false;
            }
            if (fMonth.size && !p.months.some((m) => fMonth.has(m))) return false;
            if (term) {
                const hay = `${p.name} ${p.tambon} ${p.pdx} ${p.an}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [data, q, fTambon, fDrug, fStatus, fWard, fMonth]);

    // ── Leaflet ──
    const mapElRef = useRef<HTMLDivElement | null>(null);
    const LRef = useRef<LeafletNS | null>(null);
    const mapRef = useRef<LMap | null>(null);
    const layerRef = useRef<LLayerGroup | null>(null);
    const markerById = useRef<Map<number, import("leaflet").Marker>>(new Map());
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (mapRef.current || !mapElRef.current) return;
            const leaflet = await import("leaflet");
            await import("leaflet/dist/leaflet.css");
            if (cancelled) return;
            const L = (leaflet.default ?? leaflet) as LeafletNS;
            LRef.current = L;
            const map = L.map(mapElRef.current, {
                center: HOSPITAL_CENTER,
                zoom: 13,
                scrollWheelZoom: true,
            });
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap",
                maxZoom: 19,
            }).addTo(map);
            layerRef.current = L.layerGroup().addTo(map);
            mapRef.current = map;
            setMapReady(true);
            setTimeout(() => map.invalidateSize(), 100);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!L || !map || !layer || !mapReady) return;

        layer.clearLayers();
        markerById.current.clear();

        const bounds: [number, number][] = [];
        for (const p of filtered) {
            const hex = drugHex(p.drugType);
            const icon = L.divIcon({
                className: "hw-pin",
                html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${hex};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });
            const popup = `
        <div style="min-width:220px;font-family:'Prompt','Noto Sans Thai',sans-serif">
          <div style="font-weight:600;font-size:14px;margin-bottom:2px">${esc(p.name)}</div>
          <div style="display:inline-block;font-size:11px;color:#fff;background:${hex};padding:1px 8px;border-radius:999px;margin-bottom:6px">${esc(p.drugType)}</div>
          <div style="font-size:12px;color:#444;line-height:1.5">
            <div>📍 ตำบล ${esc(p.tambon)}</div>
            <div>🩺 วินิจฉัย: <b>${esc(p.pdx || "-")}</b></div>
            <div>🛏️ Ward: ${esc(p.ward || "-")} · สิทธิ ${esc(p.sitthi || "-")}</div>
            <div>🔁 Admit ${p.admissions} ครั้ง${p.age != null ? ` · อายุ ${p.age} ปี` : ""}</div>
            <div>💰 ชดเชยรวม ${fmtBaht(p.totalChodchey)} บาท · <span style="color:${p.isCompensated ? "#22a35a" : "#ef8b1f"}">${p.isCompensated ? "ชดเชยแล้ว" : "รอชดเชย"}</span></div>
            <div style="color:#888">เดือนล่าสุด: ${esc(p.latestMonth || "-")}${p.an ? ` · AN ${esc(p.an)}` : ""}</div>
          </div>
          ${p.mapLink
                    ? `<a href="${esc(p.mapLink)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:7px;font-size:12px;color:#1ca887;font-weight:600;text-decoration:none">🗺️ เปิดใน Google Maps →</a>`
                    : ""
                }
        </div>`;
            const m = L.marker([p.lat, p.lng], { icon }).bindPopup(popup, {
                maxWidth: 300,
            });
            m.addTo(layer);
            markerById.current.set(p.id, m);
            bounds.push([p.lat, p.lng]);
        }

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
    }, [filtered, mapReady]);

    const focusPoint = (p: HomeWardMapPoint) => {
        setSelectedId(p.id);
        const map = mapRef.current;
        const m = markerById.current.get(p.id);
        if (map && m) {
            map.setView([p.lat, p.lng], 17, { animate: true });
            m.openPopup();
        }
    };

    const s = data;
    // ชนิดสารที่ปรากฏจริง (สำหรับ legend)
    const legendTypes = useMemo(
        () => (s ? s.filters.drugType : []),
        [s],
    );

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                        style={{ background: "#1ca887" }}
                    >
                        <BedDouble size={19} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-800 leading-tight">
                            แผนที่บ้านผู้ป่วย Home Ward
                        </h1>
                        <p className="text-[11px] text-gray-500">
                            ชดเชย Home Ward + พลับพลารักษ์ · อ.พลับพลาชัย
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    {s && (
                        <>
                            <span className="flex items-center gap-1">
                                <Users size={13} /> ผู้ป่วย{" "}
                                <b className="text-gray-700">{s.totalPersons}</b>
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin size={13} style={{ color: "#1ca887" }} /> มีพิกัด{" "}
                                <b style={{ color: "#1ca887" }}>{s.matched}</b>
                            </span>
                            {s.unmatched > 0 && (
                                <span
                                    className="flex items-center gap-1"
                                    title="ไม่พบพิกัด (จับคู่ชื่อไม่ได้)"
                                >
                                    <AlertCircle size={13} className="text-amber-500" />{" "}
                                    ไม่พบพิกัด <b className="text-amber-600">{s.unmatched}</b>
                                </span>
                            )}

                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Sidebar */}
                <div
                    className={`bg-white border-r flex flex-col transition-all duration-200 ${showFilters ? "w-80" : "w-0 overflow-hidden"
                        }`}
                >
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="ค้นหาชื่อ / ตำบล / Pdx / AN"
                                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#1ca887]"
                            />
                            {q && (
                                <button
                                    onClick={() => setQ("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-gray-500">
                                แสดง <b className="text-gray-700">{filtered.length}</b> ราย
                                {s ? ` / ${s.matched}` : ""}
                            </span>
                            {(activeFilterCount > 0 || q) && (
                                <button
                                    onClick={clearAll}
                                    className="text-[11px] text-[#1ca887] font-medium hover:underline"
                                >
                                    ล้างตัวกรอง ({activeFilterCount + (q ? 1 : 0)})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-3 border-b overflow-y-auto max-h-[48%]">
                        {s && (
                            <>
                                <FilterChips
                                    label="ชนิดสารเสพติด (Pdx)"
                                    options={s.filters.drugType}
                                    selected={fDrug}
                                    onToggle={toggle(setFDrug)}
                                    colorFn={drugHex}
                                />
                                <FilterChips
                                    label="ตำบล"
                                    options={s.filters.tambon}
                                    selected={fTambon}
                                    onToggle={toggle(setFTambon)}
                                />
                                <FilterChips
                                    label="สถานะชดเชย"
                                    options={s.filters.status}
                                    selected={fStatus}
                                    onToggle={toggle(setFStatus)}
                                />
                                <FilterChips
                                    label="Ward"
                                    options={s.filters.ward}
                                    selected={fWard}
                                    onToggle={toggle(setFWard)}
                                />
                                <FilterChips
                                    label="เดือนที่รับบริการ"
                                    options={s.filters.month}
                                    selected={fMonth}
                                    onToggle={toggle(setFMonth)}
                                />
                            </>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filtered.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => focusPoint(p)}
                                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-[#e8f5ee] transition-colors flex items-start gap-2.5 ${selectedId === p.id ? "bg-[#e8f5ee]" : ""
                                    }`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                    style={{ background: drugHex(p.drugType) }}
                                />
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium text-gray-800 truncate">
                                        {p.name}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                        ต.{p.tambon} · {p.pdx || "-"}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                        <span>Admit {p.admissions} ครั้ง</span>
                                        <span
                                            style={{
                                                color: p.isCompensated ? "#22a35a" : "#ef8b1f",
                                            }}
                                        >
                                            · {p.isCompensated ? "ชดเชยแล้ว" : "รอชดเชย"}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <div className="p-6 text-center text-sm text-gray-400">
                                ไม่พบข้อมูลตามเงื่อนไข
                            </div>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative z-0 isolate min-w-0">
                    <button
                        onClick={() => setShowFilters((v) => !v)}
                        className="absolute top-3 left-3 z-[500] bg-white shadow-md rounded-lg px-3 py-2 text-xs font-medium text-gray-600 flex items-center gap-1.5 hover:bg-gray-50"
                    >
                        <Filter size={14} />
                        {showFilters ? "ซ่อนตัวกรอง" : "ตัวกรอง"}
                        {activeFilterCount > 0 && (
                            <span
                                className="text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                                style={{ background: "#1ca887" }}
                            >
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {legendTypes.length > 0 && (
                        <div className="absolute bottom-4 right-4 z-[500] bg-white/95 backdrop-blur shadow-md rounded-lg px-3 py-2.5 max-w-[190px]">
                            <div className="text-[10px] font-semibold text-gray-500 mb-1.5">
                                ชนิดสารเสพติด
                            </div>
                            <div className="space-y-1">
                                {legendTypes.map((t) => (
                                    <div key={t} className="flex items-center gap-1.5">
                                        <span
                                            className="w-3 h-3 rounded-full border border-white shadow flex-shrink-0"
                                            style={{ background: drugHex(t) }}
                                        />
                                        <span className="text-[11px] text-gray-600 truncate">
                                            {t}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-2 rounded-lg shadow">
                            {error}
                        </div>
                    )}
                    {loading && !data && (
                        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-gray-50/70">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <RefreshCw size={16} className="animate-spin" /> กำลังโหลดข้อมูล…
                            </div>
                        </div>
                    )}

                    <div ref={mapElRef} className="w-full h-full" />
                </div>
            </div>
        </div>
    );
}