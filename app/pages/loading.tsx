// app/pages/loading.tsx
// Suspense fallback ของกลุ่มหน้า dashboard
// แสดงตอน "นำทางเข้า/เปลี่ยนหน้า" ระหว่างที่ server เตรียม segment เสร็จ
// → ผู้ใช้เห็น skeleton ทันทีแทนหน้าจอว่าง (เห็นชัดเฉพาะหน้าที่ render ฝั่ง server
//   ส่วนหน้าที่เป็น client component + fetch ใน useEffect จะเห็นแวบสั้น ๆ แล้ว
//   หน้านั้นจะคุม loading ภายในของตัวเองต่อ)
//
// ไม่ต้องใส่ "use client" — เป็น Server Component ได้ ไม่มี interactivity

function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}
        >
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            <div className="space-y-3">
                <div className="h-3 w-full animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
            </div>
        </div>
    );
}

export default function DashboardLoading() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
            {/* แถวการ์ดสรุปด้านบน */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-2xl border border-gray-200 bg-white p-5"
                    >
                        <div className="mb-3 h-3 w-20 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
                        <div className="h-7 w-24 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
                    </div>
                ))}
            </div>

            {/* กราฟ/ตารางหลัก */}
            <SkeletonCard className="h-64" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </div>
    );
}