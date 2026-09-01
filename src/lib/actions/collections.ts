"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";

const optionalDate = z.preprocess((value) => value === "" ? null : value, z.string().date().nullable());
const optionalUuid = z.preprocess((value) => value === "" ? null : value, z.string().uuid().nullable());
const invoiceSchema = z.object({
  invoice_status: z.enum(["Draft", "Sent", "Void"]),
  invoice_number: z.string().trim().max(100),
  invoice_date: optionalDate,
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  due_date: optionalDate,
  collection_owner_id: optionalUuid,
  next_follow_up_date: optionalDate,
});
const entrySchema = z.object({
  entry_type: z.enum(["Payment", "Adjustment", "Credit", "Write-off"]),
  amount: z.coerce.number().refine((amount) => amount !== 0, "Enter a non-zero amount"),
  entry_date: z.string().date(),
  note: z.string().trim().max(1000),
});
const contactSchema = z.object({
  contact_type: z.enum(["Note", "Phone", "Email"]),
  contacted_at: z.string().datetime({ local: true }),
  note: z.string().trim().min(1).max(2000),
  next_follow_up_date: optionalDate,
});

function value(data: FormData, key: string) { return String(data.get(key) ?? ""); }
function refresh(loadId: string) {
  revalidatePath("/collections");
  revalidatePath(`/collections/${loadId}`);
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/dashboard");
}

export async function updateInvoiceCollection(loadId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = invoiceSchema.parse(Object.fromEntries(formData));
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.rpc("update_invoice_collection", {
      p_load_id: loadId, p_invoice_status: input.invoice_status, p_invoice_number: input.invoice_number,
      p_invoice_date: input.invoice_date, p_payment_terms_days: input.payment_terms_days, p_due_date: input.due_date,
      p_collection_owner_id: input.collection_owner_id, p_next_follow_up_date: input.next_follow_up_date,
    });
    if (error) return errorState(error, "Could not update invoice details.");
    refresh(loadId);
    return successState("Invoice and collection details updated.");
  } catch (error) { return errorState(error, "Could not update invoice details."); }
}

export async function addReceivableEntry(loadId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = entrySchema.parse(Object.fromEntries(formData));
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.rpc("record_receivable_entry", {
      p_load_id: loadId, p_entry_type: input.entry_type, p_amount: input.amount, p_entry_date: input.entry_date, p_note: input.note,
    });
    if (error) return errorState(error, "Could not record receivable entry.");
    refresh(loadId);
    return successState("Receivable entry recorded.");
  } catch (error) { return errorState(error, "Could not record receivable entry."); }
}

export async function addCollectionContact(loadId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = contactSchema.parse({
      contact_type: value(formData, "contact_type"), contacted_at: value(formData, "contacted_at"),
      note: value(formData, "note"), next_follow_up_date: value(formData, "next_follow_up_date"),
    });
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.rpc("record_collection_contact", {
      p_load_id: loadId, p_contact_type: input.contact_type, p_contacted_at: input.contacted_at,
      p_note: input.note, p_next_follow_up_date: input.next_follow_up_date,
    });
    if (error) return errorState(error, "Could not record collection contact.");
    refresh(loadId);
    return successState("Collection contact recorded.");
  } catch (error) { return errorState(error, "Could not record collection contact."); }
}
