"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { LoadFinancialFields } from "@/components/load-financial-fields";
import { LoadEquipmentFields } from "@/components/load-equipment-fields";
import { LoadStopsEditor, type EditableStop } from "@/components/load-stops-editor";
import type { ActionState } from "@/lib/actions/state";
import type { LoadDriverOption, LoadEquipmentOption } from "@/lib/data/options";
import { inputDate } from "@/lib/utils";
import { findAssignmentConflicts, type AssignmentSelection, type AssignmentWindow, type DispatchStop } from "@/lib/dispatch";
import { loadStatuses, type Database } from "@/types/database";

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type DeductionRow = Database["public"]["Tables"]["load_deductions"]["Row"];
type LoadStopRow = Database["public"]["Tables"]["load_stops"]["Row"];

type LoadFormProps = {
  action: (state: ActionState, formData: FormData) => ActionState | Promise<ActionState>;
  drivers: LoadDriverOption[];
  brokers: { id: string; company_name: string }[];
  equipment: LoadEquipmentOption[];
  load?: LoadRow;
  payment?: PaymentRow | null;
  deductions?: DeductionRow[];
  showPayments?: boolean;
  initialFleet?: string | null;
  stops?: LoadStopRow[];
  assignmentWindows?: AssignmentWindow[];
};

function editableStops(load?: LoadRow, stops: LoadStopRow[] = []): EditableStop[] {
  if (stops.length) return [...stops].sort((a, b) => a.position - b.position).map((stop) => ({
    ...stop,
    key: stop.id,
    stop_type: stop.stop_type as DispatchStop["stop_type"],
    schedule_precision: stop.schedule_precision === "date" ? "date" : "window",
  }));
  return [
    {
      key: "initial-pickup", position: 0, stop_type: "Pickup", location: load?.pickup_location ?? "",
      scheduled_start: load?.pickup_date ? `${load.pickup_date}T00:00` : null,
      scheduled_end: load?.pickup_date ? `${load.pickup_date}T23:59` : null,
      schedule_precision: load?.pickup_date ? "date" : "window", time_zone: "America/Los_Angeles",
      appointment_number: null, reference_number: null, instructions: null,
    },
    {
      key: "initial-delivery", position: 1, stop_type: "Delivery", location: load?.delivery_location ?? "",
      scheduled_start: load?.delivery_date ? `${load.delivery_date}T00:00` : null,
      scheduled_end: load?.delivery_date ? `${load.delivery_date}T23:59` : null,
      schedule_precision: load?.delivery_date ? "date" : "window", time_zone: "America/Los_Angeles",
      appointment_number: null, reference_number: null, instructions: null,
    },
  ];
}

export function LoadForm({ action, drivers, brokers, equipment, load, payment, deductions = [], showPayments = false, initialFleet, stops: savedStops = [], assignmentWindows = [] }: LoadFormProps) {
  const [stops, setStops] = useState<EditableStop[]>(() => editableStops(load, savedStops));
  const [assignment, setAssignment] = useState<AssignmentSelection>({ driverId: load?.driver_id ?? null, truckUnitId: load?.truck_unit_id ?? null, trailerUnitId: load?.trailer_unit_id ?? null });
  const conflicts = useMemo(() => findAssignmentConflicts(assignment, stops, assignmentWindows, load?.id), [assignment, assignmentWindows, load?.id, stops]);
  return (
    <ActionForm action={action} className="space-y-8" successMessage={false}>
      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-2">
        <Field label="Load Number">
          <Input name="load_number" required defaultValue={load?.load_number ?? ""} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={load?.status ?? "Booked"}>
            {loadStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </Field>
        <Field label="Broker / Customer">
          <Select name="broker_id" defaultValue={load?.broker_id ?? ""}>
            <option value="">Unassigned</option>
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id}>{broker.company_name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Carrier Company">
          <Input name="carrier_company" defaultValue={load?.carrier_company ?? ""} />
        </Field>
        <LoadEquipmentFields
          drivers={drivers}
          equipment={equipment}
          defaultDriverId={load?.driver_id}
          defaultFleet={load?.fleet_company ?? initialFleet}
          defaultTruckUnitId={load?.truck_unit_id}
          defaultTrailerUnitId={load?.trailer_unit_id}
          onAssignmentChange={setAssignment}
        />
        {conflicts.length ? (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 md:col-span-2">
            <div className="font-semibold text-amber-950">Assignment conflict warning</div>
            <p className="mt-1 text-sm text-amber-900">This is advisory. Review the overlap before saving or continue if the assignment is intentional.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {conflicts.map((conflict) => <li key={conflict.loadId}><Link className="font-semibold underline" href={`/loads/${conflict.loadId}`}>Load {conflict.loadNumber}</Link> overlaps for {conflict.resources.join(" and ")}.</li>)}
            </ul>
          </div>
        ) : null}
        <Field label="Commodity">
          <Input name="commodity" defaultValue={load?.commodity ?? ""} placeholder="General freight, produce, machinery..." />
        </Field>
        <Field label="Weight (lb)">
          <Input type="number" min="0" step="0.01" name="weight_lbs" defaultValue={load?.weight_lbs ?? ""} />
        </Field>
        <Field label="Pallets">
          <Input type="number" min="0" step="1" name="pallet_count" defaultValue={load?.pallet_count ?? ""} />
        </Field>
        <Field label="Special instructions" className="md:col-span-2">
          <Textarea name="special_instructions" defaultValue={load?.special_instructions ?? ""} placeholder="Temperature, handling, accessorial, or shipment-wide instructions" />
        </Field>
        <LoadFinancialFields
          loadRate={load?.load_rate}
          driverPay={load?.driver_pay}
          dispatcherFee={load?.dispatcher_fee}
          fuelCost={load?.fuel_cost}
          factoringMode={load?.factoring_mode === "amount" ? "amount" : "percentage"}
          factoringPercent={load?.factoring_percent}
          factoringFixedAmount={load?.factoring_fixed_amount}
          deductions={deductions}
        />
        <Field label="Notes" className="md:col-span-2">
          <Textarea name="notes" defaultValue={load?.notes ?? ""} />
        </Field>
      </section>

      <LoadStopsEditor stops={stops} onChange={setStops} />

      {showPayments ? (
        <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="space-y-3">
            <Checkbox name="invoice_sent" label="Invoice sent" defaultChecked={payment?.invoice_sent} />
            <Field label="Invoice Sent Date">
              <Input type="date" name="invoice_sent_date" defaultValue={inputDate(payment?.invoice_sent_date)} />
            </Field>
          </div>
        </section>
      ) : null}

      {showPayments ? (
        <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-3">
          <div className="space-y-3">
            <Checkbox name="client_paid" label="Client paid" defaultChecked={payment?.client_paid} />
            <Field label="Amount Received">
              <Input type="number" step="0.01" min="0" name="client_amount_received" defaultValue={payment?.client_amount_received ?? 0} />
            </Field>
            <Field label="Date Received">
              <Input type="date" name="client_date_received" defaultValue={inputDate(payment?.client_date_received)} />
            </Field>
          </div>
          <div className="space-y-3">
            <Checkbox name="driver_paid" label="Driver paid" defaultChecked={payment?.driver_paid} />
            <Field label="Amount Paid">
              <Input type="number" step="0.01" min="0" name="driver_amount_paid" defaultValue={payment?.driver_amount_paid ?? 0} />
            </Field>
            <Field label="Date Paid">
              <Input type="date" name="driver_date_paid" defaultValue={inputDate(payment?.driver_date_paid)} />
            </Field>
          </div>
          <div className="space-y-3">
            <Checkbox name="dispatcher_paid" label="Dispatcher paid" defaultChecked={payment?.dispatcher_paid} />
            <Field label="Dispatcher Fee Amount">
              <Input type="number" step="0.01" min="0" name="dispatcher_fee_amount" defaultValue={payment?.dispatcher_fee_amount ?? load?.dispatcher_fee ?? 0} />
            </Field>
            <Field label="Date Paid">
              <Input type="date" name="dispatcher_date_paid" defaultValue={inputDate(payment?.dispatcher_date_paid)} />
            </Field>
          </div>
        </section>
      ) : null}

      <div className="flex gap-3">
        <SubmitButton>Save load</SubmitButton>
        <LinkButton href="/loads" variant="secondary">Cancel</LinkButton>
      </div>
    </ActionForm>
  );
}
