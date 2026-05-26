// app/pages/layout.tsx
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/sidebar/Sidebar";
import TopProgressBar from "@/app/components/TopProgressBar";
import MobileSidebarToggle from "@/app/components/MobileSidebarToggle";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <TopProgressBar />

            {/* Navbar */}
            <div className="h-14 shrink-0 border-b border-gray-300 bg-white">
                <Navbar />
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Desktop sidebar — hidden on mobile */}
                <aside className="hidden md:flex flex-col w-56 h-full border-r border-gray-300 bg-white">
                    <Sidebar />
                </aside>

                {/* Content */}
                <main className="flex-1 overflow-auto p-4 md:p-6 bg-white">
                    {children}
                </main>
            </div>

            {/* Mobile bottom burger bar */}
            <MobileSidebarToggle />
        </div>
    );
}