import { redirect } from "next/navigation";

// หน้านี้ถูกรวมเข้ากับ dashboard แล้ว (แท็บ "แผนที่บ้าน")
// เก็บ redirect ไว้เผื่อ bookmark
export default function Page() {
    redirect("/pages/acs-dashboard?tab=map");
}
