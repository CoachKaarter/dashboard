function escapeCsvField(v: string): string {
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((v) => escapeCsvField(String(v))).join(","));
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens accented characters correctly
}

// Minimal RFC4180-ish parser: handles quoted fields (with embedded commas,
// semicolons, or escaped quotes) and both comma- and semicolon-separated
// files, since Excel's French locale exports the latter by default.
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = (body.split("\n")[0]?.split(";").length ?? 1) > (body.split("\n")[0]?.split(",").length ?? 1) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}
