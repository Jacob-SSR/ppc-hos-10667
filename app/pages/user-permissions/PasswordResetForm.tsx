"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

type Props = {
  username: string;
  name: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
};

export default function PasswordResetForm({ username, name, disabled, onBusyChange }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || disabled) return;
    setError(""); setNotice("");
    if (password.length < 6) { setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (password !== password.trim()) { setError("รหัสผ่านต้องไม่มีช่องว่างที่ต้นหรือท้าย"); return; }
    if (new TextEncoder().encode(password).length > 72) { setError("รหัสผ่านยาวเกิน 72 ไบต์"); return; }
    if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    if (!confirmed) { setError("กรุณายืนยันบัญชีที่จะตั้งรหัสผ่านใหม่"); return; }
    setBusy(true); onBusyChange(true);
    try {
      const response = await fetch("/api/user-permissions/reset-password", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      setPassword(""); setConfirm(""); setConfirmed(false); setShow(false);
      setNotice(`ตั้งรหัสผ่านใหม่ให้ ${name} (${username}) แล้ว แจ้งรหัสใหม่ให้เจ้าของบัญชีผ่านช่องทางส่วนตัว`);
    } catch (err) { setError(err instanceof Error ? err.message : "ตั้งรหัสผ่านไม่สำเร็จ"); }
    finally { setBusy(false); onBusyChange(false); }
  };

  return <form onSubmit={submit} className="mb-6 rounded-xl border border-green-200 bg-green-50/40 p-4" aria-label="ตั้งรหัสผ่านใหม่ให้ผู้ใช้">
    <h3 className="flex items-center gap-2 font-semibold text-gray-800"><KeyRound size={18} className="text-green-700" />ตั้งรหัสผ่านใหม่</h3>
    <p className="mb-4 mt-2 text-sm text-gray-600">ช่วยผู้ใช้ที่เข้าไม่ได้ โดยไม่ต้องใช้รหัสผ่านเดิม</p>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-3 text-sm text-green-800">{notice}</p>}
    <fieldset disabled={disabled || busy} className="space-y-3">
      <div><label htmlFor="reset-password" className="mb-1 block text-sm text-gray-700">รหัสผ่านใหม่</label>
        <input id="reset-password" type={show ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setConfirmed(false); setNotice(""); }} required minLength={6} autoComplete="new-password" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
        <p className="mt-1 text-xs text-gray-500">อย่างน้อย 6 ตัวอักษร สูงสุด 72 ไบต์ (ภาษาไทยใช้หลายไบต์ต่อตัวอักษร)</p></div>
      <div><label htmlFor="confirm-reset-password" className="mb-1 block text-sm text-gray-700">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirm-reset-password" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></div>
      <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-green-700" />แสดงรหัสผ่าน</label>
      <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-green-700" /><span>ยืนยันตั้งรหัสผ่านใหม่ให้ <strong>{name} ({username})</strong> รหัสผ่านเดิมจะใช้เข้าสู่ระบบไม่ได้</span></label>
      <button type="submit" disabled={!password || !confirm || !confirmed} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"><KeyRound size={16} />{busy ? "กำลังตั้งรหัสผ่าน…" : "ยืนยันตั้งรหัสผ่านใหม่"}</button>
    </fieldset>
  </form>;
}
