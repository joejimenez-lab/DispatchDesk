"use client";

import { useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";
import { formatQuantity, iftaJurisdictions, type IftaRouteTemplate } from "@/lib/ifta";

type StateMilesRow = { key: number; state: string; miles: string };

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  truckNumbers: string[];
  routes: IftaRouteTemplate[];
};

export function IftaTripForm({ action, truckNumbers, routes }: Props) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<StateMilesRow[]>([{ key: 0, state: "", miles: "" }]);
  const [pickupCity, setPickupCity] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");

  function newRow(state = "", miles = ""): StateMilesRow {
    return { key: nextKey.current++, state, miles };
  }

  function applyRoute(routeIndex: string) {
    const route = routes[Number(routeIndex)];
    if (!route) return;
    setPickupCity(route.pickup_city);
    setDropoffCity(route.dropoff_city);
    setRows(route.miles.map((leg) => newRow(leg.state, String(leg.miles))));
  }

  function updateRow(key: number, patch: Partial<StateMilesRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const totalMiles = rows.reduce((total, row) => total + (Number(row.miles) || 0), 0);

  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Truck #">
        <Input name="truck_number" required list="ifta-trip-trucks" placeholder="e.g. 521" />
      </Field>
      <datalist id="ifta-trip-trucks">
        {truckNumbers.map((truck) => <option key={truck} value={truck} />)}
      </datalist>

      <Field label="Trip start date">
        <Input type="date" name="start_date" required />
      </Field>
      <Field label="Trip end date">
        <Input type="date" name="end_date" />
      </Field>

      {routes.length ? (
        <Field label="Saved route">
          <Select defaultValue="" onChange={(event) => applyRoute(event.target.value)}>
            <option value="">Fill from a past trip...</option>
            {routes.map((route, index) => (
              <option key={`${route.pickup_city}|${route.dropoff_city}`} value={index}>
                {route.pickup_city} → {route.dropoff_city}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Pickup city">
        <Input
          name="pickup_city"
          required
          value={pickupCity}
          onChange={(event) => setPickupCity(event.target.value)}
          placeholder="e.g. Fontana"
        />
      </Field>
      <Field label="Drop-off city">
        <Input
          name="dropoff_city"
          required
          value={dropoffCity}
          onChange={(event) => setDropoffCity(event.target.value)}
          placeholder="e.g. Salt Lake"
        />
      </Field>

      <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:col-span-2 lg:col-span-4">
        Most lanes cross the same states for the same miles on every run. Pick a saved route to fill the
        state miles from the last trip on that lane, then adjust only if the truck deviated.
      </p>

      <fieldset className="sm:col-span-2 lg:col-span-4">
        <legend className="text-sm font-medium text-zinc-700">Miles per state</legend>
        <div className="mt-1 grid gap-2">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2">
              <Select
                name="state_code"
                required
                value={row.state}
                onChange={(event) => updateRow(row.key, { state: event.target.value })}
                className="mt-0 w-full sm:w-56"
              >
                <option value="">Select state</option>
                {iftaJurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction.code} value={jurisdiction.code}>
                    {jurisdiction.code} — {jurisdiction.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                name="state_miles"
                required
                min="0.1"
                step="0.1"
                value={row.miles}
                onChange={(event) => updateRow(row.key, { miles: event.target.value })}
                placeholder="Miles"
                className="mt-0 w-full sm:w-36"
              />
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, newRow()])}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + Add state
          </button>
          <span className="text-sm text-zinc-600">Trip total: <span className="font-semibold text-zinc-950">{formatQuantity(totalMiles)} mi</span></span>
        </div>
      </fieldset>

      <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
        <Textarea name="notes" placeholder="Deadhead, detour, or anything unusual about this trip" />
      </Field>

      <SubmitButton className="sm:w-fit" pendingText="Saving...">Add trip</SubmitButton>
    </ActionForm>
  );
}
