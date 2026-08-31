import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { brokerSchema, driverSchema } from "@/lib/validation/schemas";
import type { ContactImportRequestRow, ContactImportState } from "@/lib/contact-import";
import type { BrokerContact, ContactKind, DriverContact } from "@/lib/contact-quality";

const requestRowSchema = z.object({
  rowNumber: z.number().int().min(2),
  values: z.record(z.string(), z.string().nullable()),
  decision: z.enum(["create", "update", "skip"]),
  matchId: z.string().min(1).nullable(),
});

function importError(error: unknown) {
  return error instanceof Error ? error.message : "Could not process this row";
}

function formCompatibleValues(values: Record<string, string | null>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ""]));
}

export async function importContacts(kind: ContactKind, formData: FormData): Promise<ContactImportState> {
  const raw = formData.get("rows_json");
  if (typeof raw !== "string" || raw.length > 1_000_000) return { status: "error", message: "The import preview is missing or too large." };

  let rows: ContactImportRequestRow[];
  try {
    const parsed = z.array(requestRowSchema).max(500, "Import no more than 500 rows at a time").parse(JSON.parse(raw));
    rows = parsed as ContactImportRequestRow[];
  } catch (error) {
    return { status: "error", message: importError(error) };
  }

  const { supabase } = await createAuthenticatedClient();
  const table = kind === "broker" ? "brokers" : "drivers";
  const schema = kind === "broker" ? brokerSchema : driverSchema;
  const { data, error } = await supabase.from(table).select("*").order(kind === "broker" ? "company_name" : "name");
  if (error) return { status: "error", message: error.message };
  const existing = (data ?? []) as unknown as (BrokerContact[] | DriverContact[]);
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const rowErrors: { rowNumber: number; message: string }[] = [];
  const createdIds = new Map<string, string>();

  for (const row of rows) {
    if (row.decision === "skip") {
      summary.skipped += 1;
      continue;
    }
    const parsed = schema.safeParse(formCompatibleValues(row.values as Record<string, string | null>));
    if (!parsed.success) {
      summary.failed += 1;
      rowErrors.push({ rowNumber: row.rowNumber, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
      continue;
    }
    if (parsed.data.email && !z.email().safeParse(parsed.data.email).success) {
      summary.failed += 1;
      rowErrors.push({ rowNumber: row.rowNumber, message: "Enter a valid email address" });
      continue;
    }

    try {
      if (row.decision === "update") {
        const resolvedMatchId = row.matchId?.startsWith("__csv_") ? createdIds.get(row.matchId) : row.matchId;
        const match = resolvedMatchId ? existing.find((record) => record.id === resolvedMatchId) : null;
        if (!match) throw new Error("The selected matching record is unavailable.");
        const { error: updateError } = await supabase.from(table).update(parsed.data).eq("id", match.id);
        if (updateError) throw updateError;
        Object.assign(match, parsed.data);
        summary.updated += 1;
      } else {
        const { data: created, error: insertError } = await supabase.from(table).insert(parsed.data as never).select("*").single();
        if (insertError) throw insertError;
        existing.push(created as unknown as never);
        createdIds.set(`__csv_${row.rowNumber}`, (created as { id: string }).id);
        summary.created += 1;
      }
    } catch (rowError) {
      summary.failed += 1;
      rowErrors.push({ rowNumber: row.rowNumber, message: importError(rowError) });
    }
  }

  if (summary.created || summary.updated) revalidatePath(kind === "broker" ? "/brokers" : "/drivers");
  const message = `Import finished: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed.`;
  return { status: summary.failed ? "error" : "success", message, summary, rowErrors };
}
