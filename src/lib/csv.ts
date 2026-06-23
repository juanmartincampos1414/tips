type Cell = string | number | boolean | null | undefined;

/** Build a UTF-8 CSV string (with BOM so Excel reads accents correctly). */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  return "﻿" + body;
}
