import type { Variants } from "framer-motion";

export const pageVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
};

export const cardVariants: Variants = {
    hidden: { opacity: 0, y: 28, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 260, damping: 22 },
    },
};

export const filterItemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, type: "spring", stiffness: 300, damping: 24 },
    }),
};

export const tableContainerVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.018, delayChildren: 0.05 },
    },
};

export const rowVariants: Variants = {
    hidden: { opacity: 0, x: -14, scale: 0.99 },
    visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 320, damping: 26 },
    },
};

export const fadeSlide: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
    exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
};