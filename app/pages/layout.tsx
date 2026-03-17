import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/sidebar/Sidebar"
import TopProgressBar from "@/app/components/TopProgressBar";

export default function NoEndpointLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col h-screen bg-gray-50">

            {/* Top progress bar — วิ่งทุกครั้งที่เปลี่ยนหน้า */}
            <TopProgressBar />

            {/* Navbar เต็มความกว้าง */}
            <div className="h-14 shrink-0 border-b border-gray-300 bg-white">
                <Navbar />
            </div>

            {/* ส่วนล่าง */}
            <div className="flex flex-1 overflow-hidden">
                <aside className="flex flex-col w-56 h-full border-r border-gray-300 bg-white">
                    <Sidebar />
                </aside>

                {/* Content */}
                <main className="flex-1 overflow-auto p-6 bg-zinc-100">
                    {children}
                </main>
            </div>
        </div>
    );
}