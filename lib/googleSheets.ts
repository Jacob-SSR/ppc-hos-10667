import { google, sheets_v4 } from "googleapis";

function toThaiDate(val: unknown): string {
  if (!val) return "";
  const date = new Date(String(val));
  if (isNaN(date.getTime())) return String(val);
  const [d, m, y] = date
    .toLocaleDateString("en-GB", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .split("/");
  return `${d}/${m}/${Number(y) + 543}`;
}

export async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// ── ดึง CID + ชื่อ-นามสกุล ที่มีอยู่ใน Sheet แล้ว ──────────────────────────
export async function getExistingKeys(sheetName: string): Promise<Set<string>> {
  const sheets = await getSheetClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = res.data.values ?? [];
    if (rows.length < 2) return new Set();

    const header = rows[0].map((h: string) => String(h).trim());
    const cidIdx = header.indexOf("cid");
    const nameIdx = header.indexOf("ชื่อ-นามสกุล");

    if (cidIdx === -1 || nameIdx === -1) return new Set();

    const keys = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cid = String(row[cidIdx] ?? "").trim();
      const name = String(row[nameIdx] ?? "").trim();
      if (cid && name) {
        keys.add(`${cid}||${name}`);
      }
    }
    return keys;
  } catch {
    return new Set();
  }
}

// ── Append พร้อม dedup mark ─────────────────────────────────────────────────
export async function appendRowsWithDedup(
  rawRows: Record<string, unknown>[],
  dateLabel: string,
): Promise<{ appended: number; duplicates: number; newRows: number }> {
  if (rawRows.length === 0) return { appended: 0, duplicates: 0, newRows: 0 };

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? "ServiceUnit";
  const sheets = await getSheetClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // ── 1. ดึง key ที่มีอยู่แล้ว ──
  const existingKeys = await getExistingKeys(sheetName);

  // ── 2. สร้าง header + เพิ่มคอลัมน์ สถานะ ──
  const dataHeaders = Object.keys(rawRows[0]);
  const isFirstWrite = existingKeys.size === 0;
  const fullHeaders = [...dataHeaders, "สถานะ"];

  // ── 3. เปรียบเทียบและ mark ──
  let duplicates = 0;
  let newRows = 0;

  const dataRows = rawRows.map((row) => {
    const cid = String(row["cid"] ?? "").trim();
    const name = String(row["ชื่อ-นามสกุล"] ?? "").trim();
    const key = `${cid}||${name}`;

    const isDuplicate = existingKeys.has(key);
    if (isDuplicate) {
      duplicates++;
    } else {
      newRows++;
      existingKeys.add(key);
    }

    const status = isDuplicate ? "ซ้ำ" : "ใหม่";

    return [
      ...dataHeaders.map((h) => {
        const val = row[h];
        if (h === "วันที่รับบริการ" && val) {
          return toThaiDate(val);
        }
        return String(val ?? "");
      }),
      status,
    ];
  });

  // ── 4. สร้าง separator row ──
  const separatorRow = [
    `=== Sync วันจันทร์ ${dateLabel} | ใหม่ ${newRows} ราย | ซ้ำ ${duplicates} ราย ===`,
  ];

  // ── 5. Append ──
  const valuesToAppend: string[][] = [];

  if (isFirstWrite) {
    valuesToAppend.push(fullHeaders);
  }

  valuesToAppend.push(separatorRow);
  valuesToAppend.push(...dataRows);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: valuesToAppend,
    },
  });

  // ── 6. Color แถวที่ซ้ำ (highlight สีเหลือง) ──
  await highlightDuplicateRows(sheets, spreadsheetId, sheetName, dataRows);

  return { appended: rawRows.length, duplicates, newRows };
}

// ── Highlight แถวซ้ำด้วยสีเหลือง ────────────────────────────────────────────
async function highlightDuplicateRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  dataRows: string[][],
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = meta.data.sheets?.find(
    (s: sheets_v4.Schema$Sheet) => s.properties?.title === sheetName,
  );
  if (!sheetMeta) return;
  if (!sheetMeta.properties?.sheetId) return;

  const sheetId = sheetMeta.properties.sheetId;

  const currentData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });
  const totalRows = (currentData.data.values ?? []).length;

  const startRowIndex = totalRows - dataRows.length;

  const requests: sheets_v4.Schema$Request[] = [];

  dataRows.forEach((row, i) => {
    const statusColIndex = row.length - 2;
    const isDuplicate = row[statusColIndex] === "ซ้ำ";

    if (isDuplicate) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRowIndex + i,
            endRowIndex: startRowIndex + i + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 1.0,
                green: 0.95,
                blue: 0.6,
              },
            },
          },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
  });

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}
