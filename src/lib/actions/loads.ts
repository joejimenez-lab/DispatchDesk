"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { documentSchema, loadSchema, noteSchema, paymentSchema } from "@/lib/validation/schemas";
import type { Database } from "@/types/database";

type PaymentFlag = "client_paid" | "driver_paid" | "dispatcher_paid";
type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function loadPayload(formData: FormData) {
  return loadSchema.parse({
    load_number: value(formData, "load_number"),
    broker_id: value(formData, "broker_id"),
    carrier_company: value(formData, "carrier_company"),
    driver_id: value(formData, "driver_id"),
    pickup_location: value(formData, "pickup_location"),
    pickup_date: value(formData, "pickup_date"),
    delivery_location: value(formData, "delivery_location"),
    delivery_date: value(formData, "delivery_date"),
    load_rate: value(formData, "load_rate"),
    driver_pay: value(formData, "driver_pay"),
    dispatcher_fee: value(formData, "dispatcher_fee"),
    fuel_cost: value(formData, "fuel_cost"),
    notes: value(formData, "notes"),
    status: value(formData, "status"),
  });
}

function paymentPayload(formData: FormData) {
  return paymentSchema.parse({
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

export async function createLoad(formData: FormData) {
  const supabase = await createClient();
  const payload = loadPayload(formData);

  const { data, error } = await supabase.from("loads").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  revalidatePath("/loads");
  revalidatePath("/dashboard");
  redirect(`/loads/${data.id}`);
}

export async function updateLoad(loadId: string, formData: FormData) {
  const supabase = await createClient();
  const load = loadPayload(formData);
  const payment = paymentPayload(formData);

  const { error: loadError } = await supabase.from("loads").update(load).eq("id", loadId);
  if (loadError) throw new Error(loadError.message);

  const { error: paymentError } = await supabase.from("payments").update(payment).eq("load_id", loadId);
  if (paymentError) throw new Error(paymentError.message);

  await supabase.from("activity_logs").insert({ load_id: loadId, action: "Payment recorded" });

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

  if (loadError) throw new Error(loadError.message);

  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
  const today = new Date().toISOString().slice(0, 10);
  const updates: PaymentUpdate = { [flag]: paid };

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

  const { error } = await supabase.from("payments").update(updates).eq("load_id", loadId);
  if (error) throw new Error(error.message);

  const label = flag.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  await supabase.from("activity_logs").insert({
    load_id: loadId,
    action: `${label} marked ${paid ? "Yes" : "No"}`,
  });

  revalidatePath(`/loads/${loadId}`);
  revalidatePath("/loads");
  revalidatePath("/dashboard");
}

export async function deleteLoad(loadId: string) {
  const supabase = await createClient();
  const { data: docs } = await supabase.from("documents").select("storage_path").eq("load_id", loadId);
  if (docs?.length) {
    await supabase.storage.from("load-documents").remove(docs.map((doc) => doc.storage_path));
  }

  const { error } = await supabase.from("loads").delete().eq("id", loadId);
  if (error) throw new Error(error.message);

  revalidatePath("/loads");
  revalidatePath("/dashboard");
  redirect("/loads");
}

export async function addNote(formData: FormData) {
  const supabase = await createClient();
  const payload = noteSchema.parse({
    load_id: value(formData, "load_id"),
    note_text: value(formData, "note_text"),
  });

  const { error } = await supabase.from("notes").insert(payload);
  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({ load_id: payload.load_id, action: "Note added" });
  revalidatePath(`/loads/${payload.load_id}`);
}

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const parsed = documentSchema.parse({
    load_id: value(formData, "load_id"),
    category: value(formData, "category"),
    notes: value(formData, "notes"),
  });
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Document file is required");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${parsed.load_id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("load-documents")
    .upload(storagePath, file, { upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("documents").insert({
    load_id: parsed.load_id,
    file_name: file.name,
    category: parsed.category,
    notes: parsed.notes,
    storage_path: storagePath,
  });

  if (error) {
    await supabase.storage.from("load-documents").remove([storagePath]);
    throw new Error(error.message);
  }

  await supabase.from("activity_logs").insert({ load_id: parsed.load_id, action: "Document uploaded" });
  revalidatePath(`/loads/${parsed.load_id}`);
}

export async function deleteDocument(documentId: string, loadId: string, storagePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("load-documents").remove([storagePath]);

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({ load_id: loadId, action: "Document deleted" });
  revalidatePath(`/loads/${loadId}`);
}

export async function getDocumentUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("load-documents")
    .createSignedUrl(storagePath, 60);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
