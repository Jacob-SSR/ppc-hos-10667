"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, Save, Search, ShieldCheck, Users } from "lucide-react";
import { FEATURE_LABELS, FEATURE_PATHS, ROLE_FEATURES, ROLE_LABELS, type FeatureKey } from "@/lib/permissions";
import type { UserAccess } from "@/lib/user-access";

const keys = Object.keys(FEATURE_PATHS) as FeatureKey[];
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const roleFeatures = (role: string): FeatureKey[] => {
  const features = ROLE_FEATURES[role] ?? ROLE_FEATURES.USER;
  return features === "*" ? [...keys] : [...features];
};

export default function UserPermissionsPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [total, setTotal] = useState(0);
  const [currentUsername, setCurrentUsername] = useState("");
  const [selected, setSelected] = useState<UserAccess | null>(null);
  const [role, setRole] = useState("USER");
  const [custom, setCustom] = useState(false);
  const [features, setFeatures] = useState<FeatureKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ search: query, page: String(page) });
    fetch(`/api/user-permissions?${qs}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดผู้ใช้ไม่สำเร็จ");
        setUsers(data.users); setTotal(data.total); setCurrentUsername(data.currentUsername);
      })
      .catch((e: Error) => { if (!controller.signal.aborted) { setError(e.message); setUsers([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page, refresh]);

  const choose = (user: UserAccess) => {
    setSelected(user); setRole(user.role); setCustom(user.features !== null);
    setFeatures(user.features ?? roleFeatures(user.role)); setNotice(""); setError("");
    editor.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const changeRole = (value: string) => {
    setRole(value);
    if (!custom || value === "IT") { setFeatures(roleFeatures(value)); }
    if (value === "IT") setCustom(false);
  };
  const save = async () => {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/user-permissions", {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selected.username, role, features: custom ? features : null, revision: selected.revision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSelected(data.user);
      setNotice(`บันทึกสิทธิ์ของ ${data.user.name} (${data.user.username}) แล้ว ให้ผู้ใช้กด F5 เพื่ออัปเดตเมนู`);
      setRefresh((v) => v + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };
  const pages = Math.max(1, Math.ceil(total / 50));

  return <div className="mx-auto max-w-7xl p-4 md:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-gray-800"><ShieldCheck className="text-green-700" />จัดการสิทธิ์ผู้ใช้</h1>
        <p className="mt-1 text-sm text-gray-500">สำหรับ IT · เลือกบัญชี ตั้ง role และกำหนดกลุ่มเมนูที่เปิดดูได้</p></div>
      <button className={button} onClick={() => setRefresh((v) => v + 1)} disabled={loading || saving}><RefreshCw size={16} />โหลดรายชื่อใหม่</button>
    </div>
    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {notice && <div role="status" className="mb-4 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><Check size={18} />{notice}</div>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label="รายชื่อผู้ใช้">
        <div className="border-b border-gray-100 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800"><Users size={17} />ผู้ใช้ทั้งหมด <span className="text-sm font-normal text-gray-500">{total.toLocaleString()} บัญชี</span></h2>
          <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input aria-label="ค้นหาชื่อหรือบัญชีผู้ใช้" value={search} onChange={(e) => setSearch(e.target.value)} disabled={saving} placeholder="ค้นหาชื่อ / username เช่น kotchii" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30" /></label>
        </div>
        <div className="max-h-[620px] overflow-auto" aria-busy={loading}>
          {loading ? <p role="status" className="p-8 text-center text-sm text-gray-500">กำลังโหลดผู้ใช้…</p> : users.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">ไม่พบผู้ใช้</p> : users.map((user) => <button key={user.username} disabled={saving} onClick={() => choose(user)} aria-pressed={selected?.username === user.username} className={`block w-full border-b border-gray-100 px-4 py-3 text-left disabled:opacity-50 ${selected?.username === user.username ? "bg-green-50" : "hover:bg-gray-50"}`}>
            <span className="block text-sm font-semibold text-gray-800">{user.name}</span>
            <span className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-gray-500"><span>{user.username}</span><span>{ROLE_LABELS[user.role] ?? user.role} · {user.features === null ? "ตาม role" : `${user.features.length} กลุ่ม`}</span></span>
          </button>)}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3 text-xs text-gray-500"><span>หน้า {page} / {pages}</span><div className="flex gap-2">
          <button className={button} disabled={page <= 1 || loading || saving} onClick={() => setPage((v) => v - 1)}>ก่อนหน้า</button>
          <button className={button} disabled={page >= pages || loading || saving} onClick={() => setPage((v) => v + 1)}>ถัดไป</button></div></div>
      </section>
      <section ref={editor} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="แก้ไขสิทธิ์ผู้ใช้">
        {!selected ? <div className="py-16 text-center text-gray-500"><ShieldCheck size={36} className="mx-auto mb-3 text-green-600" /><h2 className="font-semibold">เลือกผู้ใช้เพื่อกำหนดสิทธิ์</h2><p className="mt-2 text-sm">ค้นหาชื่อหรือ username จากรายการด้านซ้าย</p></div> : <>
          <h2 className="font-bold text-gray-800">{selected.name}</h2><p className="mb-5 mt-1 text-sm text-gray-500">บัญชี {selected.username}</p>
          <fieldset disabled={saving} className="space-y-5">
            <div><label htmlFor="user-role" className="mb-2 block text-sm font-semibold text-gray-700">Role / สายงาน</label>
              <select id="user-role" value={role} disabled={selected.username === currentUsername} onChange={(e) => changeRole(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-50">
                {!Object.hasOwn(ROLE_FEATURES, role) && <option value={role}>{role} (เดิม)</option>}
                {Object.keys(ROLE_FEATURES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r} ({r})</option>)}
              </select>
              {selected.username === currentUsername && <p className="mt-2 text-xs text-gray-500">บัญชีที่กำลังใช้งานต้องคงสิทธิ์ IT เพื่อจัดการระบบต่อได้</p>}
            </div>
            {role === "IT" ? <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">IT เข้าถึงทุกกลุ่มเมนู และตั้งสิทธิ์ให้ผู้ใช้ทุกคนได้</div> : <>
              <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="permission-mode" checked={!custom} onChange={() => { setCustom(false); setFeatures(roleFeatures(role)); }} className="accent-green-700" />ใช้สิทธิ์ตาม role</label>
                <label className="flex items-center gap-2"><input type="radio" name="permission-mode" checked={custom} onChange={() => setCustom(true)} className="accent-green-700" />กำหนดกลุ่มเมนูเอง</label></div>
              <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-700">กลุ่มเมนูที่ดูได้ ({(custom ? features : roleFeatures(role)).length}/{keys.length})</h3>
                {custom && <div className="flex gap-2"><button type="button" className={button} onClick={() => setFeatures([...keys])}>เลือกทั้งหมด</button><button type="button" className={button} onClick={() => setFeatures([])}>ล้างทั้งหมด</button></div>}</div>
                <div className="grid gap-2 sm:grid-cols-2">{keys.map((key) => <label key={key} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
                  <input type="checkbox" disabled={!custom} checked={(custom ? features : roleFeatures(role)).includes(key)} onChange={(e) => setFeatures((old) => e.target.checked ? [...old, key] : old.filter((f) => f !== key))} className="mt-0.5 accent-green-700" /><span>{FEATURE_LABELS[key]}</span>
                </label>)}</div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">กำหนดเองจะใช้เฉพาะกลุ่มที่เลือกแทนสิทธิ์ตาม role ทุกคนยังเปิดตั้งค่าบัญชีของตัวเองได้ การเลือกทั้งหมดให้สิทธิ์ดูทุกกลุ่ม แต่การตั้งสิทธิ์ผู้ใช้อื่นต้องมี role IT</p>
              </div>
            </>}
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50" onClick={save}><Save size={17} />{saving ? "กำลังบันทึก…" : "บันทึกสิทธิ์"}</button>
          </fieldset>
        </>}
      </section>
    </div>
  </div>;
}
