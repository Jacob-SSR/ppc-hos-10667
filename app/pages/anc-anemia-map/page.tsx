"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    MapPinned,
    Search,
    X,
    Filter,
    MapPin,
    AlertCircle,
    Droplets,
    RefreshCw,
} from "lucide-react";
import { useFetchOnce } from "@/app/components/dashboard/live/useFetchOnce";
import {
    DateRangeToolbar,
} from "@/app/components/ui/DateRangeToolbar";
import type {
    AnemiaMapData,
    AnemiaMapPoint,
} from "@/app/api/anc-anemia-map/route";

// ─── สี ระดับความรุนแรง ────────────────────────────────────────────────────────
const SEV_HEX: Record<string, string> = {
    เล็กน้อย: "#e6b800",
    ปานกลาง: "#ef8b1f",
    รุนแรง: "#e2483f",
};
const sevHex = (s: string) => SEV_HEX[s] ?? "#8b8b8b";

const ACCENT = "#9D174D"; // โทนสี ANC (ชมพูเข้ม)
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

// "2567-10-01" → "1 ต.ค. 67" (แสดงช่วงข้อมูลบน header)
const BE_MON = [
    "",
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
];
function fmtBE(d: string): string {
    const [y, m, day] = (d || "").split("-").map(Number);
    if (!y || !m || !day) return d || "";
    return `${day} ${BE_MON[m]} ${String(y + 543).slice(2)}`;
}

// วันที่ (Date) → "YYYY-MM-DD" สำหรับส่งเข้า API
function fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ปีงบประมาณ (พ.ศ.) ที่ให้เลือก — ตรงกับ anc-nursing-dashboard
const FISCAL_YEARS = [2569, 2568, 2567, 2566, 2565];

// ปีงบ (พ.ศ.) → ช่วง 1 ต.ค. – 30 ก.ย.
function fiscalRangeBE(beYear: number): { start: Date; end: Date } {
    const ceEnd = beYear - 543;
    return { start: new Date(ceEnd - 1, 9, 1), end: new Date(ceEnd, 8, 30) };
}

// ปีงบปัจจุบัน (พ.ศ.)
function currentFiscalBE(): number {
    const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
    );
    const fyStart = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return fyStart + 544;
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
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#9D174D]"
                                }`}
                            style={active ? { background: ACCENT } : undefined}
                        >
                            {colorMode && (
                                <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ background: active ? "#fff" : sevHex(opt) }}
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
export default function AncAnemiaMapPage() {
    // ── ช่วงวันที่ (default = ปีงบปัจจุบัน ให้ตรงกับ dashboard) ──
    // ── ช่วงวันที่ (default = ปีงบปัจจุบัน ให้ตรงกับ dashboard) ──
    const def = useMemo(() => fiscalRangeBE(currentFiscalBE()), []);
    const [fy, setFy] = useState<number | "">(currentFiscalBE());
    const [start, setStart] = useState<Date>(def.start);
    const [end, setEnd] = useState<Date>(def.end);
    const [applied, setApplied] = useState<{ start: string; end: string }>({
        start: fmtDate(def.start),
        end: fmtDate(def.end),
    });

    const { data, loading, error } = useFetchOnce<AnemiaMapData>(
        `/api/anc-anemia-map?start=${applied.start}&end=${applied.end}`,
    );

    // กด "ค้นหา" → โหลดใหม่ตามช่วงที่เลือก
    const handleSearch = () =>
        setApplied({ start: fmtDate(start), end: fmtDate(end) });

    // เลือกปีงบ / กำหนดเอง
    const handlePeriod = (v: string) => {
        if (v === "custom") {
            setFy("");
            return;
        }
        const be = Number(v.replace("fy:", ""));
        setFy(be);
        const r = fiscalRangeBE(be);
        setStart(r.start);
        setEnd(r.end);
        setApplied({ start: fmtDate(r.start), end: fmtDate(r.end) });
    };

    // แก้วันที่เอง → เข้าโหมดกำหนดเอง
    const onDate =
        (setter: React.Dispatch<React.SetStateAction<Date>>) =>
            (d: Date | null) => {
                if (d) {
                    setter(d);
                    setFy("");
                }
            };

    // ── ตัวกรอง ──
    const [q, setQ] = useState("");
    const [fTambon, setFTambon] = useState<Set<string>>(new Set());
    const [fSev, setFSev] = useState<Set<string>>(new Set());
    const [fYear, setFYear] = useState<Set<string>>(new Set());
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
        setFSev(new Set());
        setFYear(new Set());
        setFMonth(new Set());
    };

    const activeFilterCount =
        fTambon.size + fSev.size + fYear.size + fMonth.size;

    // ── จุดที่ผ่านตัวกรอง ──
    const filtered = useMemo<AnemiaMapPoint[]>(() => {
        if (!data) return [];
        const term = q.trim().toLowerCase();
        return data.points.filter((p) => {
            if (fTambon.size && !fTambon.has(p.tambon)) return false;
            if (fSev.size && !fSev.has(p.severity)) return false;
            if (fYear.size && !fYear.has(p.yearBE)) return false;
            if (fMonth.size && !fMonth.has(p.monthName)) return false;
            if (term) {
                const hay =
                    `${p.fullName} ${p.hn} ${p.address} ${p.tambon}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [data, q, fTambon, fSev, fYear, fMonth]);

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
                className: "anemia-pin",
                html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${hex};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });
            const labVals: string[] = [];
            if (p.hct != null) labVals.push(`HCT ${p.hct}%`);
            const popup = `
        <div style="min-width:210px;font-family:'Prompt','Noto Sans Thai',sans-serif">
          <div style="font-weight:600;font-size:14px;margin-bottom:2px">${esc(p.fullName)}</div>
          <div style="display:inline-block;font-size:11px;color:#fff;background:${hex};padding:1px 8px;border-radius:999px;margin-bottom:6px">ซีด${esc(p.severity)}</div>
          <div style="font-size:12px;color:#444;line-height:1.5">
            <div>🏠 ${esc(p.address || "-")}</div>
            <div>🩸 ${labVals.length ? esc(labVals.join(" · ")) : "-"}</div>
            ${p.age ? `<div>อายุ ${p.age} ปี</div>` : ""}
            ${p.testDate ? `<div>วันที่ตรวจ: ${esc(p.testDate)}</div>` : ""}
            ${p.hn ? `<div style="color:#888">HN ${esc(p.hn)}</div>` : ""}
          </div>
          ${p.mapLink
                    ? `<a href="${esc(p.mapLink)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:7px;font-size:12px;color:${ACCENT};font-weight:600;text-decoration:none">🗺️ เปิดใน Google Maps →</a>`
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
    const focusPoint = (p: AnemiaMapPoint) => {
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
                        style={{ background: ACCENT }}
                    >
                        <MapPinned size={19} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-800 leading-tight">
                            แผนที่บ้านหญิงตั้งครรภ์ที่มีภาวะซีด
                        </h1>
                        <p className="text-[11px] text-gray-500">
                            HCT &lt; 33% · พิกัดหลังคาเรือน
                            {s ? ` · ${fmtBE(s.start)} – ${fmtBE(s.end)}` : ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                    {s && (
                        <>
                            <span
                                className="flex items-center gap-1"
                                title="distinct คน HCT < 33% · ตรงกับการ์ด KPI ของ dashboard"
                            >
                                <Droplets size={13} style={{ color: "#A32D2D" }} /> ซีด HCT &lt; 33%{" "}
                                <b style={{ color: "#A32D2D" }}>{s.total}</b>
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin size={13} style={{ color: ACCENT }} /> มีพิกัด{" "}
                                <b style={{ color: ACCENT }}>{s.matched}</b>
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

            {/* ── แถบเลือกช่วงวันที่ (ตั้งให้ตรงกับ dashboard เพื่อเทียบยอด) ── */}
            <div className="bg-white border-b px-5 py-2 flex flex-wrap items-center gap-2">
                {/* เลือกปีงบ / กำหนดเอง */}
                <select
                    value={fy === "" ? "custom" : `fy:${fy}`}
                    onChange={(e) => handlePeriod(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"
                >
                    {FISCAL_YEARS.map((y) => (
                        <option key={y} value={`fy:${y}`}>
                            ปีงบ {y}
                        </option>
                    ))}
                    <option value="custom">กำหนดเอง</option>
                </select>

                <DateRangeToolbar
                    start={start}
                    end={end}
                    onStartChange={onDate(setStart)}
                    onEndChange={onDate(setEnd)}
                    onSearch={handleSearch}
                    loading={loading}
                />
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
                                placeholder="ค้นหาชื่อ / HN / ที่อยู่"
                                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#9D174D]"
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
                                    className="text-[11px] font-medium hover:underline"
                                    style={{ color: ACCENT }}
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
                                    label="ระดับความรุนแรง"
                                    options={s.filters.severity}
                                    selected={fSev}
                                    onToggle={toggle(setFSev)}
                                    colorMode
                                />
                                <FilterChips
                                    label="ตำบล"
                                    options={s.filters.tambon}
                                    selected={fTambon}
                                    onToggle={toggle(setFTambon)}
                                />
                                <FilterChips
                                    label="ปีที่ตรวจ (พ.ศ.)"
                                    options={s.filters.year}
                                    selected={fYear}
                                    onToggle={toggle(setFYear)}
                                />
                                <FilterChips
                                    label="เดือนที่ตรวจ"
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
                                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-[#fce7f3] transition-colors flex items-start gap-2.5 ${selectedId === p.id ? "bg-[#fce7f3]" : ""
                                    }`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                    style={{ background: sevHex(p.severity) }}
                                />
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium text-gray-800 truncate">
                                        {p.fullName}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                        {p.address || p.tambon || "-"}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                        <span>ซีด{p.severity}</span>
                                        {p.hct != null && <span>· HCT {p.hct}%</span>}
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
                <div className="flex-1 relative min-w-0">
                    <button
                        onClick={() => setShowFilters((v) => !v)}
                        className="absolute top-3 left-3 z-[500] bg-white shadow-md rounded-lg px-3 py-2 text-xs font-medium text-gray-600 flex items-center gap-1.5 hover:bg-gray-50"
                    >
                        <Filter size={14} />
                        {showFilters ? "ซ่อนตัวกรอง" : "ตัวกรอง"}
                        {activeFilterCount > 0 && (
                            <span
                                className="text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                                style={{ background: ACCENT }}
                            >
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 z-[500] bg-white/95 backdrop-blur shadow-md rounded-lg px-3 py-2.5">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                            <Droplets size={11} style={{ color: ACCENT }} /> ระดับความรุนแรง
                        </div>
                        <div className="space-y-1">
                            {["เล็กน้อย", "ปานกลาง", "รุนแรง"].map((c) => (
                                <div key={c} className="flex items-center gap-1.5">
                                    <span
                                        className="w-3 h-3 rounded-full border border-white shadow"
                                        style={{ background: sevHex(c) }}
                                    />
                                    <span className="text-[11px] text-gray-600">ซีด{c}</span>
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