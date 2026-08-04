// app/pages/planfin/page.tsx
// ระบบแผนการเงิน (Planfin / PrePlanFin) — ฝังหน้า HTML standalone ผ่าน iframe
// ตัวเนื้อหาจริงเสิร์ฟจาก /api/planfin (ต้อง login ตาม proxy) ข้อมูลบันทึกใน localStorage ของเบราว์เซอร์
export default function PlanfinPage() {
  return (
    <div className="-m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)]">
      <iframe
        src="/api/planfin"
        title="ระบบแผนการเงิน รพ.พลับพลาชัย"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
