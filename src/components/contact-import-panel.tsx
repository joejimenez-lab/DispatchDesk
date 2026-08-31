"use client";

import { useActionState, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/button";
import { acceptedContactColumns, parseContactCsv, type ContactCsvRow } from "@/lib/contact-csv";
import { buildContactImportPreview, initialContactImportState, type ContactImportRequestRow, type ContactImportState, type ImportDecision } from "@/lib/contact-import";
import type { BrokerContact, ContactKind, DriverContact } from "@/lib/contact-quality";

type ImportAction = (state: ContactImportState, formData: FormData) => Promise<ContactImportState>;

export function ContactImportPanel({
  kind,
  existing,
  action,
  templateHref,
}: {
  kind: ContactKind;
  existing: BrokerContact[] | DriverContact[];
  action: ImportAction;
  templateHref: string;
}) {
  const [rows, setRows] = useState<ContactCsvRow[]>([]);
  const [fileError, setFileError] = useState("");
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({});
  const [state, formAction, pending] = useActionState(action, initialContactImportState);

  const previews = useMemo(() => buildContactImportPreview(kind, rows, existing), [existing, kind, rows]);

  const requestRows: ContactImportRequestRow[] = previews.map((row) => ({
    rowNumber: row.rowNumber,
    values: row.values,
    decision: row.errors.length ? "skip" : decisions[row.rowNumber] ?? (row.match ? "skip" : "create"),
    matchId: row.match?.id ?? null,
  }));

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError("");
    setRows([]);
    setDecisions({});
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Choose a CSV file.");
      return;
    }
    try {
      const parsed = parseContactCsv(kind, await file.text());
      if (!parsed.length) setFileError("The CSV has headers but no data rows.");
      setRows(parsed);
      setDecisions({});
    } catch {
      setFileError("The CSV could not be read.");
    }
  }

  return (
    <details className="group rounded-lg border border-zinc-200 bg-white">
      <summary className="cursor-pointer list-none p-4 text-sm font-semibold text-zinc-800">
        <span className="group-open:hidden">Import CSV</span>
        <span className="hidden group-open:inline">Close CSV import</span>
      </summary>
      <div className="border-t border-zinc-200 p-4">
        <p className="text-sm text-zinc-600">Preview and validate every row before anything is saved. Accepted columns: {acceptedContactColumns(kind).join(", ")}.</p>
        <a className="mt-2 inline-block text-sm font-semibold text-blue-700 underline" href={templateHref} download>Download sample template</a>
        <label className="mt-4 block text-sm font-medium text-zinc-800">
          CSV file
          <input className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" type="file" accept=".csv,text/csv" onChange={selectFile} />
        </label>
        {fileError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{fileError}</p> : null}
        {previews.length ? (
          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="rows_json" value={JSON.stringify(requestRows)} />
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Validation / match</th><th className="px-3 py-2">Action</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {previews.map((row) => {
                    const label = kind === "broker" ? (row.values as { company_name: string }).company_name : (row.values as { name: string }).name;
                    const decision = row.errors.length ? "skip" : decisions[row.rowNumber] ?? (row.match ? "skip" : "create");
                    return (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-3 align-top font-medium">{row.rowNumber}</td>
                        <td className="px-3 py-3 align-top"><div className="font-medium text-zinc-950">{label || "Missing name"}</div><div className="text-xs text-zinc-500">{row.values.email || row.values.phone || "No email or phone"}</div></td>
                        <td className="px-3 py-3 align-top">
                          {row.errors.length ? <span className="text-red-700">{row.errors.join("; ")}</span> : row.match ? <span className="text-violet-700">{row.match.confidence} match: {row.match.source === "file" ? "another CSV row" : row.match.label} ({row.match.signals.join(", ")})</span> : <span className="text-emerald-700">Ready to create</span>}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select aria-label={`Action for CSV row ${row.rowNumber}`} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5" value={decision} disabled={Boolean(row.errors.length)} onChange={(event) => setDecisions((current) => ({ ...current, [row.rowNumber]: event.target.value as ImportDecision }))}>
                            {row.match ? <option value="update">{row.match.source === "file" ? "Update earlier CSV row" : "Update match"}</option> : null}
                            <option value="create">Create new</option>
                            <option value="skip">Skip</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {state.message ? <div role={state.status === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${state.status === "error" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{state.message}</div> : null}
            {state.rowErrors?.length ? <ul className="list-disc pl-5 text-sm text-red-700">{state.rowErrors.map((error) => <li key={`${error.rowNumber}-${error.message}`}>Row {error.rowNumber}: {error.message}</li>)}</ul> : null}
            <Button type="submit" disabled={pending}>{pending ? "Importing..." : `Import ${requestRows.filter((row) => row.decision !== "skip").length} rows`}</Button>
          </form>
        ) : null}
      </div>
    </details>
  );
}
