"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FontSize = "sm" | "md" | "lg" | "xl";

interface SettingsContextValue {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    darkMode: boolean;
    setDarkMode: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
    fontSize: "md",
    setFontSize: () => { },
    darkMode: false,
    setDarkMode: () => { },
});

const FONT_SIZE_MAP: Record<FontSize, string> = {
    sm: "13px",
    md: "15px",
    lg: "17px",
    xl: "20px",
};

function readLS(key: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    try { return localStorage.getItem(key) ?? fallback; }
    catch { return fallback; }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    // ── lazy initializer — อ่าน localStorage ครั้งเดียวตอน mount ──
    const [fontSize, setFontSizeState] = useState<FontSize>(
        () => readLS("ppchos-font-size", "md") as FontSize
    );
    const [darkMode, setDarkModeState] = useState<boolean>(
        () => readLS("ppchos-dark-mode", "false") === "true"
    );

    // ── sync font size → DOM ──
    useEffect(() => {
        document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize];
        localStorage.setItem("ppchos-font-size", fontSize);
    }, [fontSize]);

    // ── sync dark mode → DOM ──
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("ppchos-dark-mode", String(darkMode));
    }, [darkMode]);

    return (
        <SettingsContext.Provider value={{
            fontSize,
            setFontSize: setFontSizeState,
            darkMode,
            setDarkMode: setDarkModeState,
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() { return useContext(SettingsContext); }