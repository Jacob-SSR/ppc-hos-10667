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
    const [fontSize, setFontSizeState] = useState<FontSize>("md");
    const [darkMode, setDarkModeState] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const savedFont = readLS("ppchos-font-size", "md") as FontSize;
        const savedDark = readLS("ppchos-dark-mode", "false") === "true";
        setFontSizeState(savedFont);
        setDarkModeState(savedDark);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize];
        localStorage.setItem("ppchos-font-size", fontSize);
    }, [fontSize, mounted]);

    useEffect(() => {
        if (!mounted) return;
        if (darkMode) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
        localStorage.setItem("ppchos-dark-mode", String(darkMode));
    }, [darkMode, mounted]);

    return (
        <SettingsContext.Provider value={{
            fontSize, setFontSize: setFontSizeState,
            darkMode, setDarkMode: setDarkModeState,
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() { return useContext(SettingsContext); }