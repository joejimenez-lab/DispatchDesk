import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { LoadFinancialFields } from "@/components/load-financial-fields";
import { LoadEquipmentFields } from "@/components/load-equipment-fields";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import type { ActionState } from "@/lib/actions/state";
import type { LoadDriverOption, LoadEquipmentOption } from "@/lib/data/options";
import { inputDate } from "@/lib/utils";
import { loadStatuses, type Database } from "@/types/database";

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type DeductionRow = Database["public"]["Tables"]["load_deductions"]["Row"];

type LoadFormProps = {
  action: (state: ActionState, formData: FormData) => ActionState | Promise<ActionState>;
  drivers: LoadDriverOption[];
  brokers: { id: string; company_name: string }[];
  equipment: LoadEquipmentOption[];
  load?: LoadRow;
  payment?: PaymentRow | null;
  deductions?: DeductionRow[];
  showPayments?: boolean;
};

export function LoadForm({ action, drivers, brokers, equipment, load, payment, deductions = [], showPayments = false }: LoadFormProps) {
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
          defaultFleet={load?.fleet_company}
          defaultTruckUnitId={load?.truck_unit_id}
          defaultTrailerUnitId={load?.trailer_unit_id}
        />
        <Field label="Pickup Location">
          <LocationAutocomplete name="pickup_location" required defaultValue={load?.pickup_location} />
        </Field>
        <Field label="Pickup Date">
          <Input type="date" name="pickup_date" defaultValue={inputDate(load?.pickup_date)} />
        </Field>
        <Field label="Delivery Location">
          <LocationAutocomplete name="delivery_location" required defaultValue={load?.delivery_location} />
        </Field>
        <Field label="Delivery Date">
          <Input type="date" name="delivery_date" defaultValue={inputDate(load?.delivery_date)} />
        </Field>
        <div className="space-y-1 pb-2 md:col-span-2">
          <Checkbox name="is_round_trip" label="Round trip" defaultChecked={load?.is_round_trip} />
          <p className="text-xs text-zinc-500">Marks this as needing a return destination after delivery.</p>
        </div>
        <Field label="Return Location" className="md:col-span-2">
          <LocationAutocomplete name="return_location" defaultValue={load?.return_location ?? ""} />
        </Field>
        <Field label="Round Trip Return Details" className="md:col-span-2">
          <Textarea
            name="round_trip_details"
            defaultValue={load?.round_trip_details ?? ""}
            placeholder="Return appointment, backhaul notes, deadhead instructions, or other return details"
          />
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
