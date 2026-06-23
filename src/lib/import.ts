import "server-only";

import * as XLSX from "xlsx";

export type MappedGuest = {
  name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  visits: number | null;
  last_visit: string | null;
  segment: string | null;
};

// Header synonyms (lowercased, accent-stripped). Spanish + English (Maitre,
// OpenTable, SevenRooms, CoverManager, PMS exports). first_name/last_name are
// combined into name when there is no single full-name column.
const SYNONYMS: Record<string, string[]> = {
  name: [
    "nombre", "nombre completo", "nombre y apellido", "name", "full name",
    "fullname", "cliente", "client", "customer", "guest", "contacto", "contact",
  ],
  first_name: ["primer nombre", "first name", "firstname", "nombres"],
  last_name: ["apellido", "apellidos", "last name", "lastname", "surname"],
  email: ["email", "e-mail", "correo", "correo electronico", "mail"],
  phone: [
    "telefono", "phone", "phone number", "celular", "movil", "mobile", "tel",
    "whatsapp", "numero", "número", "cell",
  ],
  birth_date: ["nacimiento", "fecha nacimiento", "fecha de nacimiento", "birth", "birthday", "birth date", "dob", "cumpleanos"],
  country: ["pais", "country", "nacionalidad", "nationality"],
  notes: ["notas", "nota", "notes", "comentarios", "observaciones", "comment", "comments"],
  tags: ["tags", "tag", "etiquetas", "labels"],
  visits: ["visitas", "visits", "covers", "cantidad de visitas", "total visitas", "book"],
  last_visit: ["ultima visita", "last visit", "ultima reserva", "last seen", "last visit date"],
  segment: ["segmento", "segment", "tipo", "categoria", "category"],
};

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export type ParsedFile = { headers: string[]; rows: unknown[][] };

/** Parse a CSV or XLSX file into headers + rows. */
export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  // Decode CSV as UTF-8 text (avoids latin1 mojibake on accented names);
  // read XLSX as binary.
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buf), {
        type: "string",
        cellDates: true,
      })
    : XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  const headers = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
  return { headers, rows: matrix.slice(1) };
}

/** Map source column indexes to our fields: exact match first, then substring;
 *  a column is claimed by at most one field. */
export function mapHeaders(headers: string[]): Record<string, number> {
  const norm = headers.map(strip);
  const map: Record<string, number> = {};
  const used = new Set<number>();
  const entries = Object.entries(SYNONYMS);
  for (const [field, syns] of entries) {
    const idx = norm.findIndex((h, i) => !used.has(i) && h && syns.includes(h));
    if (idx >= 0) {
      map[field] = idx;
      used.add(idx);
    }
  }
  for (const [field, syns] of entries) {
    if (map[field] != null) continue;
    const idx = norm.findIndex(
      (h, i) => !used.has(i) && h && syns.some((s) => h.includes(s)),
    );
    if (idx >= 0) {
      map[field] = idx;
      used.add(idx);
    }
  }
  return map;
}

const cell = (row: unknown[], idx: number | undefined): string => {
  if (idx == null) return "";
  const v = row[idx];
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
};

const toDate = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export function normalizeEmail(s: string): string | null {
  const e = s.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Phone dedup key: last 10 digits, so the same number matches across formats
 * (+54 11 …, 011 …, with/without country code or leading zero).
 */
export function phoneKey(s: string): string | null {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function mapRow(row: unknown[], hmap: Record<string, number>): MappedGuest {
  const tagsRaw = cell(row, hmap.tags);
  // Single full-name column, else combine first + last name.
  const name =
    cell(row, hmap.name) ||
    [cell(row, hmap.first_name), cell(row, hmap.last_name)]
      .filter(Boolean)
      .join(" ") ||
    "";
  return {
    name: name || null,
    email: normalizeEmail(cell(row, hmap.email)),
    phone: cell(row, hmap.phone) || null,
    birth_date: toDate(cell(row, hmap.birth_date)),
    country: cell(row, hmap.country) || null,
    notes: cell(row, hmap.notes) || null,
    tags: tagsRaw
      ? tagsRaw
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    visits: cell(row, hmap.visits)
      ? Number(cell(row, hmap.visits).replace(/\D/g, "")) || null
      : null,
    last_visit: toDate(cell(row, hmap.last_visit)),
    segment: cell(row, hmap.segment) || null,
  };
}
