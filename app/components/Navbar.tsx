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
        <header className="h-16 bg-white border-b border-gray-300 flex items-center px-6 ">

            {/* Left: Logo only */}
            <div className="w-1/3 flex items-center">
                <Image
                    src="/logo.png"
                    alt="Hospital Logo"
                    width={150}
                    height={150}
                    priority
                />
            </div>

            {/* Center: Page Title */}
            <div className="w-1/3 text-center text-green-800">
                <h1 className="text-lg font-medium">
                    PLAIPLACHAI HOSPITAL
                </h1>
            </div>

            {/* Right: Username */}
            <div className="w-1/3 flex justify-end items-center">
                <span className="text-sm font-semibold text-gray-700">
                    {username ?? "Guest"}
                </span>
            </div>
        </header>
    );
}