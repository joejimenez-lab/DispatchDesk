"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import {
  compensateReceiptUpload,
  prepareBookkeepingReceipt,
  removeReceiptCleanupJobs,
  type PreparedReceipt,
  type ReceiptCleanupJob,
} from "@/lib/actions/bookkeeping-storage";
import { parseMaintenanceRecord } from "@/lib/bookkeeping";
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { bookkeepingExpenseSchema } from "@/lib/validation/schemas";
import type { ExpenseCategory, Json } from "@/types/database";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function operationId(formData: FormData) {
  const id = String(value(formData, "operation_id"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("This form expired. Refresh the page and try again.");
  }
  return id;
}

function revalidateBookkeeping(unitId?: string | null) {
  revalidatePath("/bookkeeping");
  revalidatePath("/reports");
  revalidatePath("/maintenance");
  revalidatePath("/ifta");
  if (unitId) revalidatePath(`/fleet/${unitId}`);
}

function parsedExpense(formData: FormData) {
  return bookkeepingExpenseSchema.parse({
    expense_date: value(formData, "expense_date"),
    category: value(formData, "category"),
    amount: value(formData, "amount"),
    cost_mode: value(formData, "cost_mode") || "total",
    labor_cost: value(formData, "labor_cost"),
    parts_cost: value(formData, "parts_cost"),
    vendor: value(formData, "vendor"),
    unit_id: value(formData, "unit_id"),
    load_id: value(formData, "load_id"),
    driver_id: value(formData, "driver_id"),
    maintenance_record: value(formData, "maintenance_record"),
    notes: value(formData, "notes"),
  });
}

function expenseHeader(parsed: ReturnType<typeof parsedExpense>) {
  const maintenance = parseMaintenanceRecord(parsed.maintenance_record);
  return {
    expense_date: parsed.expense_date,
    vendor: parsed.vendor,
    notes: parsed.notes,
    unit_id: parsed.unit_id,
    load_id: parsed.load_id,
    driver_id: parsed.driver_id,
    category: parsed.category,
    amount: parsed.amount,
    maintenance_table: maintenance?.table ?? null,
    maintenance_id: maintenance?.id ?? null,
  } satisfies Json;
}

function expenseLines(parsed: ReturnType<typeof parsedExpense>, sourceType: string) {
  if (sourceType === "maintenance" && parsed.cost_mode === "breakdown") {
    return [
      parsed.labor_cost > 0 ? { category: "Maintenance" as ExpenseCategory, amount: parsed.labor_cost, line_type: "labor" } : null,
      parsed.parts_cost > 0 ? { category: "Parts" as ExpenseCategory, amount: parsed.parts_cost, line_type: "parts" } : null,
    ].filter((line): line is NonNullable<typeof line> => line !== null);
  }
  return [{ category: parsed.category, amount: parsed.amount, line_type: "total" }];
}

export async function addBookkeepingExpense(_state: ActionState, formData: FormData): Promise<ActionState> {
  let groupId = "";
  let prepared: PreparedReceipt | null = null;
  try {
    groupId = operationId(formData);
    const { supabase, user } = await createAuthenticatedClient();
    const parsed = parsedExpense(formData);
    prepared = await prepareBookkeepingReceipt(supabase, groupId, formData, { idempotencyKey: "initial" });
    const { error } = await supabase.rpc("create_manual_bookkeeping_expense", {
      p_group_id: groupId,
      p_expense: expenseHeader(parsed),
      p_receipt: prepared?.metadata ?? null,
    });
    if (error) {
      await compensateReceiptUpload(supabase, prepared, error);
      return errorState(error, "Could not add expense.");
    }
    logInfo("bookkeeping.expense.created", { groupId, category: parsed.category, userId: user.id });
    revalidateBookkeeping(parsed.unit_id);
    return successState(prepared ? "Expense and receipt saved." : "Expense saved.");
  } catch (error) {
    if (prepared) {
      const { supabase } = await createAuthenticatedClient();
      await compensateReceiptUpload(supabase, prepared, error);
    }
    return errorState(error, "Could not add expense.");
  }
}

export async function updateBookkeepingExpense(
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const parsed = parsedExpense(formData);
    const { data: group, error: groupError } = await supabase
      .from("bookkeeping_expense_groups")
      .select("source_type")
      .eq("id", groupId)
      .single();
    if (groupError || !group) return errorState(groupError, "Bookkeeping transaction not found.");
    const lines = expenseLines(parsed, group.source_type);
    const { error } = await supabase.rpc("update_bookkeeping_expense_group", {
      p_group_id: groupId,
      p_expense: expenseHeader(parsed),
      p_lines: lines,
    });
    if (error) return errorState(error, "Could not update expense.");
    logInfo("bookkeeping.expense.updated", { groupId, userId: user.id });
    revalidateBookkeeping(parsed.unit_id);
    return successState("Expense updated everywhere it appears.");
  } catch (error) {
    return errorState(error, "Could not update expense.");
  }
}

export async function deleteBookkeepingExpense(groupId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase.rpc("queue_bookkeeping_group_delete", { p_group_id: groupId });
    if (error) return errorState(error, "Could not delete expense.");
    const cleanupError = await removeReceiptCleanupJobs(supabase, (data ?? []) as ReceiptCleanupJob[]);
    if (cleanupError) return errorState(cleanupError, "Expense was removed, but receipt cleanup is queued for retry.");
    logInfo("bookkeeping.expense.deleted", { groupId, userId: user.id });
    revalidateBookkeeping();
    return successState("Expense deleted.");
  } catch (error) {
    return errorState(error, "Could not delete expense.");
  }
}

export async function uploadBookkeepingReceipt(
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let prepared = null;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    prepared = await prepareBookkeepingReceipt(supabase, groupId, formData);
    if (!prepared) return errorState(new Error("Choose a receipt before uploading."));
    const metadata = prepared.metadata as Record<string, Json>;
    const { error } = await supabase.from("bookkeeping_receipts").insert({
      group_id: groupId,
      file_name: String(metadata.file_name),
      storage_path: String(metadata.storage_path),
      content_type: String(metadata.content_type),
      file_size: Number(metadata.file_size),
    });
    if (error) {
      await compensateReceiptUpload(supabase, prepared, error);
      return errorState(error, "Could not save receipt.");
    }
    logInfo("bookkeeping.receipt.uploaded", { groupId, userId: user.id });
    revalidateBookkeeping();
    return successState("Receipt uploaded.");
  } catch (error) {
    if (prepared) {
      const { supabase } = await createAuthenticatedClient();
      await compensateReceiptUpload(supabase, prepared, error);
    }
    return errorState(error, "Could not upload receipt.");
  }
}

export async function deleteBookkeepingReceipt(receiptId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase.rpc("queue_bookkeeping_receipt_delete", { p_receipt_id: receiptId });
    if (error) return errorState(error, "Could not delete receipt.");
    const jobs = (data ?? []) as ReceiptCleanupJob[];
    const cleanupError = await removeReceiptCleanupJobs(supabase, jobs);
    if (cleanupError) return errorState(cleanupError, "Receipt was removed, but file cleanup is queued for retry.");
    logInfo("bookkeeping.receipt.deleted", { receiptId, groupId: jobs[0]?.expense_group_id, userId: user.id });
    revalidateBookkeeping();
    return successState("Receipt deleted.");
  } catch (error) {
    return errorState(error, "Could not delete receipt.");
  }
}

export async function reconcileOperationalExpenses(_state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase.rpc("reconcile_operational_expenses", { p_apply: true });
    if (error) return errorState(error, "Could not reconcile historical expenses.");
    const result = data as { created: number; matched: number; skipped: number; ambiguous: number };
    logInfo("bookkeeping.reconciled", { ...result, userId: user.id });
    revalidateBookkeeping();
    return successState(`Reconciliation complete: ${result.created} created, ${result.matched} matched, ${result.skipped} already linked, ${result.ambiguous} need review.`);
  } catch (error) {
    return errorState(error, "Could not reconcile historical expenses.");
  }
}
