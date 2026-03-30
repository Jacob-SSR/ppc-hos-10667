import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { ExportOptions } from "@/types/allTypes";
import { formatThaiDate } from "./dateUtils";

export function exportToExcel(
    data: Record<string, unknown>[],
    options: ExportOptions,
): void {
    const { sheetName = "Report", filePrefix, dateKeys = ["vstdate"] } = options;

    const cleanedData = data.map((row) => {
        const newRow: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, val]) => {
            newRow[key] = dateKeys.includes(key) ? formatThaiDate(val) : (val ?? "");
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(cleanedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const file = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const nowTH = new Date()
        .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
        .replace(" ", "_");

    saveAs(file, `${filePrefix}_${nowTH}.xlsx`);
}