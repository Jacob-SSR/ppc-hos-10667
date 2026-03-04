"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Navbar() {
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/me", { credentials: "include" })
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then(data => {
                if (data.user) {
                    setUsername(data.user.username);
                }
            })
            .catch(() => {
                setUsername(null);
            });
    }, []);

    return (
        <header className="h-16 bg-white shadow-md flex items-center px-8">

            {/* Left: Logo */}
            <div className="flex-1 flex items-center gap-3">
                <Image
                    src="/logo.png"
                    alt="Hospital Logo"
                    width={120}
                    height={120}
                    priority
                    className="object-contain"
                />
            </div>

            {/* Center: Title */}
            <div className="flex-1 text-center">
                <h1 className="text-lg font-semibold text-green-700 tracking-wide">
                    PLABPLACHAI HOSPITAL
                </h1>
                <div className="h-[2px] w-24 bg-green-600 mx-auto mt-1 rounded-full opacity-70"></div>
            </div>

            {/* Right: Username */}
            <div className="flex-1 flex justify-end items-center">
                <div className="bg-gray-100 px-4 py-1.5 rounded-full shadow-sm">
                    <span className="text-sm font-medium text-gray-700">
                        {username ?? "Guest"}
                    </span>
                </div>
            </div>
        </header>
    );
}