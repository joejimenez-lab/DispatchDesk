"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { iftaFuelPurchaseSchema, iftaStateMilesSchema, iftaTripSchema } from "@/lib/validation/schemas";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
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

export async function addIftaFuelPurchase(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = iftaFuelPurchaseSchema.parse({
      truck_number: value(formData, "truck_number"),
      purchase_date: value(formData, "purchase_date"),
      city: value(formData, "city"),
      state: value(formData, "state"),
      gallons: value(formData, "gallons"),
      amount_paid: value(formData, "amount_paid"),
      notes: value(formData, "notes"),
    });

    const { error } = await supabase.from("ifta_fuel_purchases").insert(payload);
    if (error) return errorState(error, "Could not add fuel purchase.");
    logInfo("ifta.fuel.created", { truck: payload.truck_number, state: payload.state, userId: user.id });
    revalidatePath("/ifta");
    return successState("Fuel purchase added.");
  } catch (error) {
    return errorState(error, "Could not add fuel purchase.");
  }
}

export async function deleteIftaFuelPurchase(purchaseId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from("ifta_fuel_purchases")
      .delete()
      .eq("id", purchaseId)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Fuel purchase not found.");
    logInfo("ifta.fuel.deleted", { purchaseId, userId: user.id });
    revalidatePath("/ifta");
    return successState("Fuel purchase deleted.");
  } catch (error) {
    return errorState(error, "Could not delete fuel purchase.");
  }
}
