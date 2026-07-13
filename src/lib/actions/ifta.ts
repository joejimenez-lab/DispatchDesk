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
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { iftaFuelPurchaseSchema, iftaStateMilesSchema, iftaTripSchema } from "@/lib/validation/schemas";

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

function stateMilesEntries(formData: FormData) {
  const states = formData.getAll("state_code").map(String);
  const miles = formData.getAll("state_miles").map(String);
  const rows = states
    .map((state, index) => ({ state, miles: miles[index] ?? "" }))
    .filter((row) => row.state !== "" || row.miles.trim() !== "");
  return iftaStateMilesSchema.parse(rows);
}

export async function addIftaTrip(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const trip = iftaTripSchema.parse({
      truck_number: value(formData, "truck_number"),
      start_date: value(formData, "start_date"),
      end_date: value(formData, "end_date"),
      pickup_city: value(formData, "pickup_city"),
      dropoff_city: value(formData, "dropoff_city"),
      notes: value(formData, "notes"),
    });
    if (trip.end_date && trip.end_date < trip.start_date) {
      throw new Error("Trip end date must be on or after the start date.");
    }
    const stateMiles = stateMilesEntries(formData);

    const { data: created, error } = await supabase.from("ifta_trips").insert(trip).select("id").single();
    if (error || !created) return errorState(error, "Could not add trip.");

    const { error: milesError } = await supabase
      .from("ifta_trip_miles")
      .insert(stateMiles.map((leg) => ({ trip_id: created.id, ...leg })));
    if (milesError) {
      await supabase.from("ifta_trips").delete().eq("id", created.id);
      return errorState(milesError, "Could not save the state miles for this trip.");
    }

    logInfo("ifta.trip.created", { tripId: created.id, truck: trip.truck_number, userId: user.id });
    revalidatePath("/ifta");
    return successState("Trip added.");
  } catch (error) {
    return errorState(error, "Could not add trip.");
  }
}

export async function deleteIftaTrip(tripId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from("ifta_trips")
      .delete()
      .eq("id", tripId)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Trip not found.");
    logInfo("ifta.trip.deleted", { tripId, userId: user.id });
    revalidatePath("/ifta");
    return successState("Trip deleted.");
  } catch (error) {
    return errorState(error, "Could not delete trip.");
  }
}

function fuelPayload(formData: FormData) {
  return iftaFuelPurchaseSchema.parse({
    unit_id: value(formData, "unit_id"),
    purchase_date: value(formData, "purchase_date"),
    city: value(formData, "city"),
    state: value(formData, "state"),
    gallons: value(formData, "gallons"),
    amount_paid: value(formData, "amount_paid"),
    vendor: value(formData, "vendor"),
    notes: value(formData, "notes"),
  });
}

function revalidateFuel(unitId?: string) {
  revalidatePath("/ifta");
  revalidatePath("/bookkeeping");
  revalidatePath("/reports");
  if (unitId) revalidatePath(`/fleet/${unitId}`);
}

async function saveFuelPurchase(purchaseId: string, groupId: string, formData: FormData, allowReceipt: boolean) {
  let prepared: PreparedReceipt | null = null;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = fuelPayload(formData);
    if (allowReceipt) prepared = await prepareBookkeepingReceipt(supabase, groupId, formData, { idempotencyKey: "initial" });
    const { error } = await supabase.rpc("save_ifta_fuel_purchase_with_expense", {
      p_purchase_id: purchaseId,
      p_group_id: groupId,
      p_purchase: payload,
      p_receipt: prepared?.metadata ?? null,
    });
    if (error) {
      await compensateReceiptUpload(supabase, prepared, error);
      return errorState(error, "Could not save fuel purchase.");
    }
    logInfo("ifta.fuel.saved", { purchaseId, unitId: payload.unit_id, state: payload.state, userId: user.id });
    revalidateFuel(payload.unit_id);
    return successState(allowReceipt ? "Fuel purchase added to IFTA and Bookkeeping." : "Fuel purchase updated everywhere it appears.");
  } catch (error) {
    if (prepared) {
      const { supabase } = await createAuthenticatedClient();
      await compensateReceiptUpload(supabase, prepared, error);
    }
    return errorState(error, "Could not save fuel purchase.");
  }
}

export async function addIftaFuelPurchase(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = operationId(formData);
  return saveFuelPurchase(id, id, formData, true);
}

export async function updateIftaFuelPurchase(
  purchaseId: string,
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return saveFuelPurchase(purchaseId, groupId, formData, false);
}

export async function deleteIftaFuelPurchase(purchaseId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase.rpc("delete_ifta_fuel_purchase_with_expense", { p_purchase_id: purchaseId });
    if (error) return errorState(error, "Fuel purchase not found.");
    const cleanupError = await removeReceiptCleanupJobs(supabase, (data ?? []) as ReceiptCleanupJob[]);
    if (cleanupError) return errorState(cleanupError, "Fuel purchase was removed, but receipt cleanup is queued for retry.");
    logInfo("ifta.fuel.deleted", { purchaseId, userId: user.id });
    revalidateFuel();
    return successState("Fuel purchase and linked Bookkeeping transaction deleted.");
  } catch (error) {
    return errorState(error, "Could not delete fuel purchase.");
  }
}
