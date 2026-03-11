"use client";

import { forwardRef } from "react";

interface ThaiDateInputProps {
    value?: string;
    onClick?: () => void;
}

const ThaiDateInput = forwardRef<HTMLInputElement, ThaiDateInputProps>(
    ({ value, onClick }, ref) => {
        const thaiValue = value
            ? (() => {
                const [d, m, y] = value.split("/");
                return `${d}/${m}/${Number(y) + 543}`;
            })()
            : "";

        return (
            <input
                ref={ref}
                value={thaiValue}
                onClick={onClick}
                readOnly
                className="border-2 border-gray-300 px-4 py-2 rounded-lg w-40 cursor-pointer text-sm text-gray-800 bg-white focus:outline-none focus:border-green-800 shadow-sm"
            />
        );
    }
);

ThaiDateInput.displayName = "ThaiDateInput";

export default ThaiDateInput;