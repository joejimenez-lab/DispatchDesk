"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { createClient } from "@/lib/supabase/server";
import { documentSchema, loadSchema, noteSchema, paymentSchema } from "@/lib/validation/schemas";
import { loadStatuses, type Database, type LoadStatus } from "@/types/database";

type PaymentFlag = "invoice_sent" | "client_paid" | "driver_paid" | "dispatcher_paid";
type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function loadPayload(formData: FormData) {
  const load = loadSchema.parse({
    load_number: value(formData, "load_number"),
    broker_id: value(formData, "broker_id"),
    carrier_company: value(formData, "carrier_company"),
    driver_id: value(formData, "driver_id"),
    pickup_location: value(formData, "pickup_location"),
    pickup_date: value(formData, "pickup_date"),
    delivery_location: value(formData, "delivery_location"),
    delivery_date: value(formData, "delivery_date"),
    is_round_trip: formData.get("is_round_trip") === "on",
    round_trip_details: value(formData, "round_trip_details"),
    load_rate: value(formData, "load_rate"),
    driver_pay: value(formData, "driver_pay"),
    dispatcher_fee: value(formData, "dispatcher_fee"),
    fuel_cost: value(formData, "fuel_cost"),
    notes: value(formData, "notes"),
    status: value(formData, "status"),
  });

  return {
    ...load,
    round_trip_details: load.is_round_trip ? load.round_trip_details : null,
  };
}

function paymentPayload(formData: FormData) {
  return paymentSchema.parse({
    invoice_sent: formData.get("invoice_sent") === "on",
    invoice_sent_date: value(formData, "invoice_sent_date"),
    client_paid: formData.get("client_paid") === "on",
    client_amount_received: value(formData, "client_amount_received"),
    client_date_received: value(formData, "client_date_received"),
    driver_paid: formData.get("driver_paid") === "on",
    driver_amount_paid: value(formData, "driver_amount_paid"),
    driver_date_paid: value(formData, "driver_date_paid"),
    dispatcher_fee_amount: value(formData, "dispatcher_fee_amount"),
    dispatcher_paid: formData.get("dispatcher_paid") === "on",
    dispatcher_date_paid: value(formData, "dispatcher_date_paid"),
  });
}

export async function createLoad(_state: ActionState, formData: FormData): Promise<ActionState> {
  let loadId: string;

  try {
    const supabase = await createClient();
    const payload = loadPayload(formData);

    const { data, error } = await supabase.from("loads").insert(payload).select("id").single();
    if (error) return errorState(error, "Could not create load.");
    loadId = data.id;
  } catch (error) {
    return errorState(error, "Could not create load.");
  }

  revalidatePath("/loads");
  revalidatePath("/dashboard");
  redirect(`/loads/${loadId}`);
}

export async function updateLoad(loadId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const load = loadPayload(formData);
    const payment = paymentPayload(formData);

    const { error: loadError } = await supabase.from("loads").update(load).eq("id", loadId);
    if (loadError) return errorState(loadError, "Could not save load.");

    const { error: paymentError } = await supabase
      .from("payments")
      .upsert({ load_id: loadId, ...payment }, { onConflict: "load_id" });
    if (paymentError) return errorState(paymentError, "Could not save payment details.");

    await supabase.from("activity_logs").insert({ load_id: loadId, action: "Load and payment details updated" });
  } catch (error) {
    return errorState(error, "Could not save load.");
  }

  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/dashboard");
  redirect(`/loads/${loadId}`);
}

export async function updatePaymentFlag(loadId: string, flag: PaymentFlag, paid: boolean) {
  const supabase = await createClient();
  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("load_rate, driver_pay, dispatcher_fee, payments(*)")
    .eq("id", loadId)
    .single();

  if (loadError) return errorState(loadError, "Could not update payment.");

  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
  const today = new Date().toISOString().slice(0, 10);
  const updates: PaymentUpdate = { [flag]: paid };

  if (flag === "invoice_sent") {
    updates.invoice_sent_date = paid ? today : null;
  }

  if (flag === "client_paid") {
    updates.client_date_received = paid ? today : null;
    if (paid && !payment?.client_amount_received) updates.client_amount_received = Number(load.load_rate);
  }

  if (flag === "driver_paid") {
    updates.driver_date_paid = paid ? today : null;
    if (paid && !payment?.driver_amount_paid) updates.driver_amount_paid = Number(load.driver_pay);
  }

  if (flag === "dispatcher_paid") {
    updates.dispatcher_date_paid = paid ? today : null;
    if (paid && !payment?.dispatcher_fee_amount) updates.dispatcher_fee_amount = Number(load.dispatcher_fee);
  }

  const { error } = await supabase
    .from("payments")
    .upsert({ load_id: loadId, ...updates }, { onConflict: "load_id" });
  if (error) return errorState(error, "Could not update payment.");

  const label = flag.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  await supabase.from("activity_logs").insert({
    load_id: loadId,
    action: `${label} marked ${paid ? "Yes" : "No"}`,
  });

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/loads");
  revalidatePath("/dashboard");
  return successState("Load progress updated.");
}

export async function updateLoadStatus(loadId: string, status: LoadStatus): Promise<ActionState> {
  if (!loadId || !loadStatuses.includes(status as LoadStatus)) {
    return errorState(new Error("Invalid load status."), "Could not update status.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ status: status as LoadStatus })
    .eq("id", loadId);

  if (error) return errorState(error, "Could not update status.");

  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/dashboard");
  return successState("Status updated.");
}

export async function deleteLoad(loadId: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const supabase = await createClient();
    const { data: docs } = await supabase.from("documents").select("storage_path").eq("load_id", loadId);
    if (docs?.length) {
      await supabase.storage.from("load-documents").remove(docs.map((doc) => doc.storage_path));
    }

    const { error } = await supabase.from("loads").delete().eq("id", loadId);
    if (error) return errorState(error, "Could not delete load.");
  } catch (error) {
    return errorState(error, "Could not delete load.");
  }

  revalidatePath("/loads");
  revalidatePath("/dashboard");
  redirect("/loads");
}

export async function addNote(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const payload = noteSchema.parse({
      load_id: value(formData, "load_id"),
      note_text: value(formData, "note_text"),
    });

    const { error } = await supabase.from("notes").insert(payload);
    if (error) return errorState(error, "Could not add note.");

    await supabase.from("activity_logs").insert({ load_id: payload.load_id, action: "Note added" });
    revalidatePath(`/loads/${payload.load_id}`);
    return successState("Note added.");
  } catch (error) {
    return errorState(error, "Could not add note.");
  }
}

export async function uploadDocument(_state: ActionState, formData: FormData): Promise<ActionState> {
  let storagePath = "";
  const supabase = await createClient();

  try {
    const parsed = documentSchema.parse({
      load_id: value(formData, "load_id"),
      category: value(formData, "category"),
      notes: value(formData, "notes"),
    });
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return errorState(new Error("Choose a document before uploading."));
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `${parsed.load_id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("load-documents")
      .upload(storagePath, file, { upsert: false });

    if (uploadError) return errorState(uploadError, "Could not upload document.");

    const { error } = await supabase.from("documents").insert({
      load_id: parsed.load_id,
      file_name: file.name,
      category: parsed.category,
      notes: parsed.notes,
      storage_path: storagePath,
    });

    if (error) {
      await supabase.storage.from("load-documents").remove([storagePath]);
      return errorState(error, "Could not save document record.");
    }

    await supabase.from("activity_logs").insert({ load_id: parsed.load_id, action: "Document uploaded" });
    revalidatePath(`/loads/${parsed.load_id}`);
    return successState("Document uploaded.");
  } catch (error) {
    if (storagePath) await supabase.storage.from("load-documents").remove([storagePath]);
    return errorState(error, "Could not upload document.");
  }
}

export async function deleteDocument(documentId: string, loadId: string, storagePath: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const supabase = await createClient();
    await supabase.storage.from("load-documents").remove([storagePath]);

    const { error } = await supabase.from("documents").delete().eq("id", documentId);
    if (error) return errorState(error, "Could not delete document.");

    await supabase.from("activity_logs").insert({ load_id: loadId, action: "Document deleted" });
    revalidatePath(`/loads/${loadId}`);
    return successState("Document deleted.");
  } catch (error) {
    return errorState(error, "Could not delete document.");
  }
}

export async function getDocumentUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("load-documents")
    .createSignedUrl(storagePath, 60);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
