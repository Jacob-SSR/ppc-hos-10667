import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return <div className="mx-auto max-w-lg p-8 text-center">
    <ShieldAlert className="mx-auto mb-4 text-amber-600" size={40} />
    <h1 className="text-xl font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
    <p className="my-4 text-sm text-gray-600">กรุณาติดต่อ IT เพื่อกำหนดสิทธิ์ให้บัญชีของคุณ เมื่อแก้ไขแล้วให้รีเฟรชหน้าเว็บ</p>
    <Link href="/pages/settings" className="text-green-700 underline">ไปที่ตั้งค่าบัญชี</Link>
  </div>;
}
