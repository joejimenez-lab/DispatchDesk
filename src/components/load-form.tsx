import { Button, LinkButton } from "@/components/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/field";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { inputDate } from "@/lib/utils";
import { loadStatuses, type Database } from "@/types/database";

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type LoadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  drivers: { id: string; name: string }[];
  brokers: { id: string; company_name: string }[];
  load?: LoadRow;
  payment?: PaymentRow | null;
  showPayments?: boolean;
};

export function LoadForm({ action, drivers, brokers, load, payment, showPayments = false }: LoadFormProps) {
  return (
    <form action={action} className="space-y-8">
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
        <Field label="Driver">
          <Select name="driver_id" defaultValue={load?.driver_id ?? ""}>
            <option value="">Unassigned</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </Select>
        </Field>
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
        <Field label="Load Rate">
          <Input type="number" step="0.01" min="0" name="load_rate" defaultValue={load?.load_rate ?? 0} />
        </Field>
        <Field label="Driver Pay">
          <Input type="number" step="0.01" min="0" name="driver_pay" defaultValue={load?.driver_pay ?? 0} />
        </Field>
        <Field label="Dispatcher Fee">
          <Input type="number" step="0.01" min="0" name="dispatcher_fee" defaultValue={load?.dispatcher_fee ?? 0} />
        </Field>
        <Field label="Fuel Cost">
          <Input type="number" step="0.01" min="0" name="fuel_cost" defaultValue={load?.fuel_cost ?? 0} />
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <Textarea name="notes" defaultValue={load?.notes ?? ""} />
        </Field>
      </section>

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
        <Button type="submit">Save load</Button>
        <LinkButton href="/loads" variant="secondary">Cancel</LinkButton>
      </div>
    </form>
  );
}
