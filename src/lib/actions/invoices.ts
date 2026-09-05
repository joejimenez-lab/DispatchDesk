"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, type ActionState } from "@/lib/actions/state";
import { logError } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { invoiceSchema } from "@/lib/validation/schemas";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function invoiceError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") return errorState(new Error("That invoice number is already in use."));
  return errorState(error, "Could not save invoice.");
}

async function saveInvoice(formData: FormData, expectedLoadId?: string): Promise<ActionState> {
  let loadId: string;

  try {
    const invoice = invoiceSchema.parse({
      load_id: expectedLoadId ?? value(formData, "load_id"),
      invoice_status: value(formData, "invoice_status"),
      invoice_number: value(formData, "invoice_number"),
      invoice_date: value(formData, "invoice_date"),
      payment_terms_days: value(formData, "payment_terms_days"),
      due_date: value(formData, "due_date"),
    });
    loadId = invoice.load_id;

    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.rpc("save_invoice", {
      p_load_id: invoice.load_id,
      p_invoice_status: invoice.invoice_status,
      p_invoice_number: invoice.invoice_number,
      p_invoice_date: invoice.invoice_date,
      p_payment_terms_days: invoice.payment_terms_days,
      p_due_date: invoice.due_date,
    });
    if (error) {
      logError("invoice.save_failed", error, { loadId });
      return invoiceError(error);
    }
  } catch (error) {
    return invoiceError(error);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${loadId}`);
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/invoices/${loadId}`);
}

export async function createInvoice(_state: ActionState, formData: FormData) {
  return saveInvoice(formData);
}

export async function updateInvoice(loadId: string, _state: ActionState, formData: FormData) {
  return saveInvoice(formData, loadId);
}
