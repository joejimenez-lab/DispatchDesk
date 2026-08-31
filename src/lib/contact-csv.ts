import type { BrokerContact, ContactKind, DriverContact } from "@/lib/contact-quality";

export type BrokerImportValues = Pick<BrokerContact, "company_name" | "contact_name" | "phone" | "email" | "notes">;
export type DriverImportValues = Pick<DriverContact, "name" | "phone" | "email" | "truck_number" | "trailer_number" | "notes">;
export type ContactImportValues = BrokerImportValues | DriverImportValues;

export type ContactCsvRow = {
  rowNumber: number;
  values: ContactImportValues;
  errors: string[];
};

const BROKER_COLUMNS = {
  company_name: ["company_name", "company", "broker", "broker_name", "customer", "customer_name"],
  contact_name: ["contact_name", "contact", "primary_contact"],
  phone: ["phone", "phone_number", "telephone"],
  email: ["email", "email_address"],
  notes: ["notes", "note", "comments"],
} as const;

const DRIVER_COLUMNS = {
  name: ["name", "driver", "driver_name"],
  phone: ["phone", "phone_number", "telephone"],
  email: ["email", "email_address"],
  truck_number: ["truck_number", "truck", "default_truck", "tractor"],
  trailer_number: ["trailer_number", "trailer", "default_trailer"],
  notes: ["notes", "note", "comments"],
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function columnIndexes(headers: string[], aliases: Record<string, readonly string[]>) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, normalized.findIndex((header) => values.includes(header))]));
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? row[index]?.trim() || null : null;
}

function emailError(value: string | null) {
  return value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Email is not valid" : null;
}

export function parseContactCsv(kind: ContactKind, text: string): ContactCsvRow[] {
  const [headers, ...sourceRows] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!headers) return [];
  const indexes = columnIndexes(headers, kind === "broker" ? BROKER_COLUMNS : DRIVER_COLUMNS);

  return sourceRows.map((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    if (kind === "broker") {
      const values: BrokerImportValues = {
        company_name: valueAt(row, indexes.company_name) ?? "",
        contact_name: valueAt(row, indexes.contact_name),
        phone: valueAt(row, indexes.phone),
        email: valueAt(row, indexes.email),
        notes: valueAt(row, indexes.notes),
      };
      if (!values.company_name) errors.push("Company name is required");
      const invalidEmail = emailError(values.email);
      if (invalidEmail) errors.push(invalidEmail);
      return { rowNumber, values, errors };
    }
    const values: DriverImportValues = {
      name: valueAt(row, indexes.name) ?? "",
      phone: valueAt(row, indexes.phone),
      email: valueAt(row, indexes.email),
      truck_number: valueAt(row, indexes.truck_number),
      trailer_number: valueAt(row, indexes.trailer_number),
      notes: valueAt(row, indexes.notes),
    };
    if (!values.name) errors.push("Driver name is required");
    const invalidEmail = emailError(values.email);
    if (invalidEmail) errors.push(invalidEmail);
    return { rowNumber, values, errors };
  });
}

export function acceptedContactColumns(kind: ContactKind) {
  return kind === "broker" ? Object.keys(BROKER_COLUMNS) : Object.keys(DRIVER_COLUMNS);
}
