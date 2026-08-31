import type { BrokerContact, ContactKind, DriverContact } from "@/lib/contact-quality";
import { findBrokerDuplicates, findDriverDuplicates } from "@/lib/contact-quality";
import type { ContactImportValues } from "@/lib/contact-csv";
import type { ContactCsvRow } from "@/lib/contact-csv";

export type ImportDecision = "create" | "update" | "skip";

export type ContactImportRequestRow = {
  rowNumber: number;
  values: ContactImportValues;
  decision: ImportDecision;
  matchId: string | null;
};

export type ContactImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type ContactImportState = {
  status: "idle" | "success" | "error";
  message: string;
  summary?: ContactImportSummary;
  rowErrors?: { rowNumber: number; message: string }[];
};

export const initialContactImportState: ContactImportState = { status: "idle", message: "" };

export function findExistingContactMatch(
  kind: ContactKind,
  values: ContactImportValues,
  existing: BrokerContact[] | DriverContact[],
) {
  const temporary = { id: "__import__", ...values };
  const suggestion = kind === "broker"
    ? findBrokerDuplicates([...(existing as BrokerContact[]), temporary as BrokerContact]).find((match) => match.second.id === "__import__")
    : findDriverDuplicates([...(existing as DriverContact[]), temporary as DriverContact]).find((match) => match.second.id === "__import__");
  if (!suggestion) return null;
  return {
    id: suggestion.first.id,
    label: kind === "broker" ? (suggestion.first as BrokerContact).company_name : (suggestion.first as DriverContact).name,
    confidence: suggestion.confidence,
    signals: suggestion.signals,
  };
}

export function buildContactImportPreview(
  kind: ContactKind,
  rows: ContactCsvRow[],
  existing: BrokerContact[] | DriverContact[],
) {
  const candidates = [...existing] as (BrokerContact | DriverContact)[];
  return rows.map((row) => {
    const match = row.errors.length ? null : findExistingContactMatch(kind, row.values, candidates as BrokerContact[] | DriverContact[]);
    if (!row.errors.length) candidates.push({ id: `__csv_${row.rowNumber}`, ...row.values } as BrokerContact | DriverContact);
    return {
      ...row,
      match: match ? { ...match, source: match.id.startsWith("__csv_") ? "file" as const : "existing" as const } : null,
    };
  });
}
