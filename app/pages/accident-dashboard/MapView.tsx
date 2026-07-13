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
} from "lucide-react";
import { useFetchOnce } from "@/app/components/dashboard/live/useFetchOnce";
import type {
    AccidentMapData,
    AccidentMapPoint,
} from "@/app/api/accident-map/route";

// ─── สีตามระดับความรุนแรง (triage) — ชุดเดียวกับกราฟใน Overview ────────────────
const SEVERITY_COLOR: Record<string, string> = {
    Dead: "#A32D2D",
    Resuscitation: "#791F1F",
    Emergency: "#E24B4A",
    Urgent: "#BA7517",
    "semi - urgent": "#378ADD",
    "non - urgent": "#639922",
    ไม่ระบุ: "#888780",
};
const sevHex = (s: string) => SEVERITY_COLOR[s] ?? "#888780";

const HOSPITAL_CENTER: [number, number] = [14.6774, 103.129]; // รพ.พลับพลาชัย

// ─── Leaflet (โหลดฝั่ง client เท่านั้น) ─────────────────────────────────────────
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

// ─── ชิปตัวกรอง (multi-select) ─────────────────────────────────────────────────
function FilterChips({
    label,
    options,
    selected,
    onToggle,
    colorMode = false,
}: {
    label: string;
    options: string[];
    selected: Set<string>;
    onToggle: (v: string) => void;
    colorMode?: boolean;
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
                            {colorMode && (
                                <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{
                                        background: active ? "#fff" : sevHex(opt),
                                    }}
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
export default function AccidentMapView() {
    const { data, loading, error } =
        useFetchOnce<AccidentMapData>("/api/accident-map");

    // ── ตัวกรอง ──
    const [q, setQ] = useState("");
    const [fSeverity, setFSeverity] = useState<Set<string>>(new Set());
    const [fVehicle, setFVehicle] = useState<Set<string>>(new Set());
    const [fTambon, setFTambon] = useState<Set<string>>(new Set());
    const [fStatus, setFStatus] = useState<Set<string>>(new Set());
    const [fAlcohol, setFAlcohol] = useState<Set<string>>(new Set());
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
        setFSeverity(new Set());
        setFVehicle(new Set());
        setFTambon(new Set());
        setFStatus(new Set());
        setFAlcohol(new Set());
        setFMonth(new Set());
    };

    const activeFilterCount =
        fSeverity.size +
        fVehicle.size +
        fTambon.size +
        fStatus.size +
        fAlcohol.size +
        fMonth.size;

    // ── จุดที่ผ่านตัวกรอง ──
    const filtered = useMemo<AccidentMapPoint[]>(() => {
        if (!data) return [];
        const term = q.trim().toLowerCase();
        return data.points.filter((p) => {
            if (fSeverity.size && !fSeverity.has(p.severity)) return false;
            if (fVehicle.size && !fVehicle.has(p.vehicle)) return false;
            if (fTambon.size && !fTambon.has(p.tambon)) return false;
            if (fStatus.size && !fStatus.has(p.status)) return false;
            if (fAlcohol.size && !fAlcohol.has(p.alcohol)) return false;
            if (fMonth.size && !fMonth.has(p.serviceMonth)) return false;
            if (term) {
                const hay =
                    `${p.fullName} ${p.hn} ${p.address} ${p.road} ${p.diagnosis}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [data, q, fSeverity, fVehicle, fTambon, fStatus, fAlcohol, fMonth]);

    // ── Leaflet refs ──
    const mapElRef = useRef<HTMLDivElement | null>(null);
    const LRef = useRef<LeafletNS | null>(null);
    const mapRef = useRef<LMap | null>(null);
    const layerRef = useRef<LLayerGroup | null>(null);
    const markerById = useRef<Map<number, import("leaflet").Marker>>(new Map());
    const [mapReady, setMapReady] = useState(false);

    // สร้างแผนที่ครั้งเดียว
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
            // ทำลาย map ตอน unmount (เช่น สลับแท็บ) กัน memory leak และกัน
            // error "Map container is already initialized" ตอน mount ใหม่
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                layerRef.current = null;
            }
        };
    }, []);

    // วาด marker ใหม่ทุกครั้งที่ filtered เปลี่ยน
    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!L || !map || !layer || !mapReady) return;

        layer.clearLayers();
        markerById.current.clear();

        const bounds: [number, number][] = [];
        for (const p of filtered) {
            const hex = sevHex(p.severity);
            const icon = L.divIcon({
                className: "accident-pin",
                html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${hex};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });

            const popup = `
        <div style="min-width:220px;font-family:'Prompt','Noto Sans Thai',sans-serif">
          <div style="font-weight:600;font-size:14px;margin-bottom:2px">${esc(p.fullName || `HN ${p.hn}`)}</div>
          <div style="display:inline-block;font-size:11px;color:#fff;background:${hex};padding:1px 8px;border-radius:999px;margin-bottom:6px">${esc(p.severity)}</div>
          <div style="font-size:12px;color:#444;line-height:1.5">
            <div>👤 ${esc(p.sex || "-")}${p.age ? ` · อายุ ${p.age} ปี` : ""}</div>
            <div>🏠 ${esc(p.address || "-")}</div>
            <div>🏍️ ${esc(p.vehicle || "-")}${p.protection ? ` · ${esc(p.protection)}` : ""}</div>
            <div>📍 ที่เกิดเหตุ: ต.${esc(p.tambon || "-")}${p.road ? ` · ${esc(p.road)}` : ""}</div>
            ${p.alcohol && p.alcohol !== "ไม่ระบุ" ? `<div>🍺 สุรา: <b style="color:${p.alcohol === "ดื่ม" ? "#A32D2D" : "#3B6D11"}">${esc(p.alcohol)}</b></div>` : ""}
            <div>🩺 สถานะ: <b>${esc(p.status || "-")}</b></div>
            ${p.diagnosis ? `<div>📋 ${esc(p.diagnosis)}</div>` : ""}
            ${p.treatDate ? `<div>🗓️ รักษา ${esc(p.treatDate)}</div>` : ""}
            ${p.hn ? `<div style="color:#888">HN ${esc(p.hn)}</div>` : ""}
          </div>
          ${p.mapLink
                    ? `<a href="${esc(p.mapLink)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:7px;font-size:12px;color:#1ca887;font-weight:600;text-decoration:none">🗺️ เปิดใน Google Maps →</a>`
                    : ""
                }
        </div>`;
            const m = L.marker([p.lat, p.lng], { icon }).bindPopup(popup, {
                maxWidth: 280,
            });
            m.addTo(layer);
            markerById.current.set(p.id, m);
            bounds.push([p.lat, p.lng]);
        }

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
    }, [filtered, mapReady]);

    // คลิกจากรายชื่อ → zoom + เปิด popup
    const focusPoint = (p: AccidentMapPoint) => {
        setSelectedId(p.id);
        const map = mapRef.current;
        const m = markerById.current.get(p.id);
        if (map && m) {
            map.setView([p.lat, p.lng], 17, { animate: true });
            m.openPopup();
        }
    };

    const s = data;

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* ── Header ── */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                        style={{ background: "#1ca887" }}
                    >
                        <MapPinned size={19} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-800 leading-tight">
                            แผนที่บ้านผู้ป่วยอุบัติเหตุ
                        </h1>
                        <p className="text-[11px] text-gray-500">
                            พิกัดหลังคาเรือน · อ.พลับพลาชัย จ.บุรีรัมย์
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    {s && (
                        <>
                            <span className="flex items-center gap-1">
                                <Users size={13} /> ทั้งหมด{" "}
                                <b className="text-gray-700">{s.total}</b>
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin size={13} style={{ color: "#1ca887" }} /> มีพิกัด{" "}
                                <b style={{ color: "#1ca887" }}>{s.matched}</b>
                            </span>
                            {s.unmatched > 0 && (
                                <span
                                    className="flex items-center gap-1"
                                    title="ไม่พบพิกัดในชีตหลังคาเรือน"
                                >
                                    <AlertCircle size={13} className="text-amber-500" />{" "}
                                    ไม่พบพิกัด{" "}
                                    <b className="text-amber-600">{s.unmatched}</b>
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* ── Sidebar filter + list ── */}
                <div
                    className={`bg-white border-r flex flex-col transition-all duration-200 ${showFilters ? "w-80" : "w-0 overflow-hidden"
                        }`}
                >
                    {/* Search */}
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search
                                size={15}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="ค้นหาชื่อ / HN / ถนน / ที่อยู่"
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

                    {/* Filters */}
                    <div className="p-3 border-b overflow-y-auto max-h-[45%]">
                        {s && (
                            <>
                                <FilterChips
                                    label="ระดับความรุนแรง (Triage)"
                                    options={s.filters.severity}
                                    selected={fSeverity}
                                    onToggle={toggle(setFSeverity)}
                                    colorMode
                                />
                                <FilterChips
                                    label="ประเภทพาหนะ"
                                    options={s.filters.vehicle}
                                    selected={fVehicle}
                                    onToggle={toggle(setFVehicle)}
                                />
                                <FilterChips
                                    label="ตำบลที่เกิดเหตุ"
                                    options={s.filters.tambon}
                                    selected={fTambon}
                                    onToggle={toggle(setFTambon)}
                                />
                                <FilterChips
                                    label="สถานะ"
                                    options={s.filters.status}
                                    selected={fStatus}
                                    onToggle={toggle(setFStatus)}
                                />
                                <FilterChips
                                    label="ดื่มสุรา"
                                    options={s.filters.alcohol}
                                    selected={fAlcohol}
                                    onToggle={toggle(setFAlcohol)}
                                />
                                <FilterChips
                                    label="เดือนที่รับการรักษา"
                                    options={s.filters.month}
                                    selected={fMonth}
                                    onToggle={toggle(setFMonth)}
                                />
                            </>
                        )}
                    </div>

                    {/* รายชื่อ */}
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
                                    style={{ background: sevHex(p.severity) }}
                                />
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium text-gray-800 truncate">
                                        {p.fullName || `HN ${p.hn}`}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                        {p.vehicle} · ต.{p.tambon || "-"}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                        <span>{p.severity}</span>
                                        {p.status && <span>· {p.status}</span>}
                                        {p.alcohol === "ดื่ม" && (
                                            <span className="text-red-500">· ดื่มสุรา</span>
                                        )}
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

                {/* ── Map ── */}
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

                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 z-[500] bg-white/95 backdrop-blur shadow-md rounded-lg px-3 py-2.5">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5">
                            ระดับความรุนแรง (Triage)
                        </div>
                        <div className="space-y-1">
                            {Object.entries(SEVERITY_COLOR)
                                .filter(([k]) => k !== "ไม่ระบุ")
                                .map(([sev, hex]) => (
                                    <div key={sev} className="flex items-center gap-1.5">
                                        <span
                                            className="w-3 h-3 rounded-full border border-white shadow"
                                            style={{ background: hex }}
                                        />
                                        <span className="text-[11px] text-gray-600">{sev}</span>
                                    </div>
                                ))}
                        </div>
                    </div>

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
