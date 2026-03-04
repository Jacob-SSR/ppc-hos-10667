"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                credentials: "include",
            });

            if (!res.ok) throw new Error("Login failed");

            router.replace("/pages/report");
        } catch (err) {
            alert("Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-200 text-gray-900">

            <motion.form
                onSubmit={handleLogin}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white w-96 p-10 rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
                <h1 className="text-2xl font-bold text-center mb-8 text-gray-900">
                    Login PPCHOS
                </h1>

                {/* USER */}
                <div className="mb-5">
                    <label className="block mb-2 text-sm font-medium text-gray-800">
                        User
                    </label>
                    <input
                        className="w-full border-2 border-black rounded-lg p-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 transition"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                {/* PASSWORD */}
                <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-gray-800">
                        Password
                    </label>
                    <input
                        type="password"
                        className="w-full border-2 border-black rounded-lg p-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 transition"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {/* BUTTON */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-green-800 transition"
                >
                    {loading ? "Logging in..." : "Login"}
                </motion.button>

                {/* LOGO */}
                <div className="mt-8 flex justify-center">
                    <img
                        src="/logo.png"
                        alt="Hospital Logo"
                        className="h-14"
                    />
                </div>
            </motion.form>
        </div>
    );
}