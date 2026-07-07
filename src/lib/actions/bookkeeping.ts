"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { parseMaintenanceRecord, type MaintenanceRecordLink } from "@/lib/bookkeeping";
import { validateUploadedDocument } from "@/lib/document-security";
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { bookkeepingExpenseSchema } from "@/lib/validation/schemas";
import type { Database } from "@/types/database";

type SupabaseClient = Awaited<ReturnType<typeof createAuthenticatedClient>>["supabase"];
type ExpenseInsert = Database["public"]["Tables"]["bookkeeping_expenses"]["Insert"];

const receiptBucket = "bookkeeping-receipts";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function optionalFile(formData: FormData) {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

function revalidateBookkeeping(unitId?: string | null) {
  revalidatePath("/bookkeeping");
  revalidatePath("/reports");
  revalidatePath("/maintenance");
  if (unitId) revalidatePath(`/fleet/${unitId}`);
}

async function maintenanceRecordFields(
  supabase: SupabaseClient,
  link: MaintenanceRecordLink | null,
  selectedUnitId: string | null,
): Promise<Pick<ExpenseInsert, "unit_id" | "service_record_id" | "inspection_record_id" | "repair_log_id">> {
  const empty = {
    unit_id: selectedUnitId,
    service_record_id: null,
    inspection_record_id: null,
    repair_log_id: null,
  };
  if (!link) return empty;

  const table = link.table;
  const { data, error } = await supabase.from(table).select("unit_id").eq("id", link.id).single();
  if (error || !data) throw new Error("Maintenance record not found.");
  const unitId = data.unit_id as string | null;
  if (selectedUnitId && unitId && selectedUnitId !== unitId) {
    throw new Error("The selected maintenance record belongs to a different truck or trailer.");
  }

  return {
    unit_id: unitId ?? selectedUnitId,
    service_record_id: table === "service_records" ? link.id : null,
    inspection_record_id: table === "inspection_records" ? link.id : null,
    repair_log_id: table === "repair_logs" ? link.id : null,
  };
}

async function expensePayload(supabase: SupabaseClient, formData: FormData): Promise<ExpenseInsert> {
  const parsed = bookkeepingExpenseSchema.parse({
    expense_date: value(formData, "expense_date"),
    category: value(formData, "category"),
    amount: value(formData, "amount"),
    vendor: value(formData, "vendor"),
    unit_id: value(formData, "unit_id"),
    load_id: value(formData, "load_id"),
    driver_id: value(formData, "driver_id"),
    maintenance_record: value(formData, "maintenance_record"),
    notes: value(formData, "notes"),
  });
  const maintenanceRecord = parseMaintenanceRecord(parsed.maintenance_record);
  const maintenanceFields = await maintenanceRecordFields(supabase, maintenanceRecord, parsed.unit_id);

  return {
    expense_date: parsed.expense_date,
    category: parsed.category,
    amount: parsed.amount,
    vendor: parsed.vendor,
    notes: parsed.notes,
    load_id: parsed.load_id,
    driver_id: parsed.driver_id,
    ...maintenanceFields,
  };
}

async function uploadReceiptFile(supabase: SupabaseClient, expenseId: string, file: File) {
  const document = await validateUploadedDocument(file);
  const storagePath = `${expenseId}/${crypto.randomUUID()}-${document.safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(receiptBucket)
    .upload(storagePath, file, { contentType: document.mimeType, upsert: false });

  if (uploadError) throw uploadError;

  const { error } = await supabase.from("bookkeeping_receipts").insert({
    expense_id: expenseId,
    file_name: file.name,
    storage_path: storagePath,
    content_type: document.mimeType,
    file_size: file.size,
  });

  if (error) {
    await supabase.storage.from(receiptBucket).remove([storagePath]);
    throw error;
  }

  return storagePath;
}

export async function addBookkeepingExpense(_state: ActionState, formData: FormData): Promise<ActionState> {
  let expenseId: string | null = null;
  let unitId: string | null = null;
  let cleanupClient: SupabaseClient | null = null;

  try {
    const { supabase, user } = await createAuthenticatedClient();
    cleanupClient = supabase;
    const payload = await expensePayload(supabase, formData);
    unitId = payload.unit_id ?? null;
    const { data, error } = await supabase.from("bookkeeping_expenses").insert({
      ...payload,
      created_by: user.id,
      created_by_email: user.email ?? null,
    }).select("id").single();
    if (error || !data) return errorState(error, "Could not add expense.");
    expenseId = data.id;

    const file = optionalFile(formData);
    if (file) await uploadReceiptFile(supabase, expenseId, file);

    logInfo("bookkeeping.expense.created", { expenseId, category: payload.category, userId: user.id });
    revalidateBookkeeping(unitId);
    return successState(file ? "Expense and receipt saved." : "Expense saved.");
  } catch (error) {
    if (expenseId && cleanupClient) {
      await cleanupClient.from("bookkeeping_expenses").delete().eq("id", expenseId);
    }
    return errorState(error, "Could not add expense.");
  }
}

export async function updateBookkeepingExpense(
  expenseId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = await expensePayload(supabase, formData);
    const { data, error } = await supabase
      .from("bookkeeping_expenses")
      .update(payload)
      .eq("id", expenseId)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Expense not found.");
    logInfo("bookkeeping.expense.updated", { expenseId, userId: user.id });
    revalidateBookkeeping(payload.unit_id ?? null);
    return successState("Expense updated.");
  } catch (error) {
    return errorState(error, "Could not update expense.");
  }
}

export async function deleteBookkeepingExpense(expenseId: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data: receipts, error: receiptError } = await supabase
      .from("bookkeeping_receipts")
      .select("storage_path")
      .eq("expense_id", expenseId);
    if (receiptError) return errorState(receiptError, "Could not delete expense receipts.");
    if (receipts?.length) {
      await supabase.storage.from(receiptBucket).remove(receipts.map((receipt) => receipt.storage_path));
    }

    const { data, error } = await supabase
      .from("bookkeeping_expenses")
      .delete()
      .eq("id", expenseId)
      .select("id, unit_id")
      .single();
    if (error || !data) return errorState(error, "Expense not found.");
    logInfo("bookkeeping.expense.deleted", { expenseId, userId: user.id });
    revalidateBookkeeping(data.unit_id);
    return successState("Expense deleted.");
  } catch (error) {
    return errorState(error, "Could not delete expense.");
  }
}

export async function uploadBookkeepingReceipt(
  expenseId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const file = optionalFile(formData);
    if (!file) return errorState(new Error("Choose a receipt before uploading."));
    await uploadReceiptFile(supabase, expenseId, file);

    const { data } = await supabase.from("bookkeeping_expenses").select("unit_id").eq("id", expenseId).single();
    logInfo("bookkeeping.receipt.uploaded", { expenseId, userId: user.id });
    revalidateBookkeeping(data?.unit_id ?? null);
    return successState("Receipt uploaded.");
  } catch (error) {
    return errorState(error, "Could not upload receipt.");
  }
}

export async function deleteBookkeepingReceipt(
  receiptId: string,
  storagePath: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;

  try {
    const { supabase, user } = await createAuthenticatedClient();
    await supabase.storage.from(receiptBucket).remove([storagePath]);
    const { data, error } = await supabase
      .from("bookkeeping_receipts")
      .delete()
      .eq("id", receiptId)
      .select("expense_id, bookkeeping_expenses(unit_id)")
      .single();
    if (error || !data) return errorState(error, "Receipt not found.");

    const expense = Array.isArray(data.bookkeeping_expenses)
      ? data.bookkeeping_expenses[0]
      : data.bookkeeping_expenses;
    logInfo("bookkeeping.receipt.deleted", { receiptId, expenseId: data.expense_id, userId: user.id });
    revalidateBookkeeping(expense?.unit_id ?? null);
    return successState("Receipt deleted.");
  } catch (error) {
    return errorState(error, "Could not delete receipt.");
  }
}
