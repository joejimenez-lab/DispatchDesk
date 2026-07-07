import { z } from "zod";
import { iftaStateCodes } from "@/lib/ifta";
import { documentCategories, loadStatuses, maintenanceReminderTypes, repairLogTypes, unitTypes } from "@/types/database";

const money = z.coerce.number().min(0).default(0);
const optionalText = z.string().trim().transform((value) => (value === "" ? null : value));
const optionalUuid = z.string().transform((value) => (value === "" ? null : value)).nullable();
const optionalDate = z.string().transform((value) => (value === "" ? null : value)).nullable();
const requiredDate = z.string().date("Enter a valid date");
const optionalOdometer = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Math.trunc(Number(value))))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Odometer must be a positive number");
const optionalPositiveInteger = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Math.trunc(Number(value))))
  .refine((value) => value === null || (Number.isFinite(value) && value > 0), "Enter a number greater than zero");
const optionalNonNegativeInteger = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Math.trunc(Number(value))))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Enter zero or a positive number");

export const loadSchema = z.object({
  load_number: z.string().trim().min(1, "Load number is required"),
  broker_id: optionalUuid,
  carrier_company: optionalText,
  driver_id: optionalUuid,
  pickup_location: z.string().trim().min(1, "Pickup location is required"),
  pickup_date: optionalDate,
  delivery_location: z.string().trim().min(1, "Delivery location is required"),
  delivery_date: optionalDate,
  is_round_trip: z.boolean().default(false),
  return_location: optionalText,
  round_trip_details: optionalText,
  load_rate: money,
  driver_pay: money,
  dispatcher_fee: money,
  fuel_cost: money,
  notes: optionalText,
  status: z.enum(loadStatuses),
});

export const paymentSchema = z.object({
  invoice_sent: z.coerce.boolean().default(false),
  invoice_sent_date: optionalDate,
  client_paid: z.coerce.boolean().default(false),
  client_amount_received: money,
  client_date_received: optionalDate,
  driver_paid: z.coerce.boolean().default(false),
  driver_amount_paid: money,
  driver_date_paid: optionalDate,
  dispatcher_fee_amount: money,
  dispatcher_paid: z.coerce.boolean().default(false),
  dispatcher_date_paid: optionalDate,
});

export const driverSchema = z.object({
  name: z.string().trim().min(1, "Driver name is required"),
  phone: optionalText,
  email: optionalText,
  truck_number: optionalText,
  trailer_number: optionalText,
  notes: optionalText,
});

export const brokerSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required"),
  contact_name: optionalText,
  phone: optionalText,
  email: optionalText,
  notes: optionalText,
});

export const noteSchema = z.object({
  load_id: z.string().uuid(),
  note_text: z.string().trim().min(1, "Note is required"),
});

export const documentSchema = z.object({
  load_id: z.string().uuid(),
  category: z.enum(documentCategories),
  notes: optionalText,
});

export const fleetUnitSchema = z.object({
  unit_number: z.string().trim().min(1, "Unit number is required"),
  unit_type: z.enum(unitTypes),
  company: optionalText,
  odometer: optionalOdometer,
  notes: optionalText,
});

export const serviceRecordSchema = z.object({
  unit_id: z.string().uuid(),
  service_date: optionalDate,
  odometer: optionalOdometer,
  description: z.string().trim().min(1, "Description is required"),
  cost: money,
  notes: optionalText,
});

export const inspectionRecordSchema = z.object({
  unit_id: z.string().uuid(),
  inspection_date: optionalDate,
  odometer: optionalOdometer,
  inspector: optionalText,
  result: z.string().trim().min(1, "Inspection result is required"),
  notes: optionalText,
});

export const repairLogSchema = z.object({
  unit_id: z.string().uuid(),
  log_type: z.enum(repairLogTypes),
  repair_date: optionalDate,
  odometer: optionalOdometer,
  description: z.string().trim().min(1, "Description is required"),
  cost: money,
  notes: optionalText,
});

export const maintenanceReminderSchema = z.object({
  unit_id: z.string().uuid(),
  reminder_type: z.enum(maintenanceReminderTypes),
  due_date: optionalDate,
  due_odometer: optionalOdometer,
  interval_days: optionalPositiveInteger,
  interval_miles: optionalPositiveInteger,
  warning_days: optionalNonNegativeInteger,
  warning_miles: optionalNonNegativeInteger,
  notes: optionalText,
});

export const maintenanceCompletionSchema = z.object({
  completed_date: requiredDate,
  odometer: optionalOdometer,
  cost: money,
  notes: optionalText,
});

export const maintenanceSnoozeSchema = z.object({
  snoozed_until: requiredDate,
});

const iftaState = z.enum(iftaStateCodes, "Choose a state");

export const iftaTripSchema = z.object({
  truck_number: z.string().trim().min(1, "Truck number is required"),
  start_date: requiredDate,
  end_date: optionalDate,
  pickup_city: z.string().trim().min(1, "Pickup city is required"),
  dropoff_city: z.string().trim().min(1, "Drop-off city is required"),
  notes: optionalText,
});

export const iftaStateMilesSchema = z
  .array(z.object({
    state: iftaState,
    miles: z.coerce.number().positive("Miles must be greater than zero"),
  }))
  .min(1, "Add miles for at least one state")
  .refine(
    (entries) => new Set(entries.map((entry) => entry.state)).size === entries.length,
    "Each state can only be listed once per trip",
  );

export const iftaFuelPurchaseSchema = z.object({
  truck_number: z.string().trim().min(1, "Truck number is required"),
  purchase_date: requiredDate,
  city: optionalText,
  state: iftaState,
  gallons: z.coerce.number().positive("Gallons must be greater than zero"),
  amount_paid: money,
  notes: optionalText,
});
