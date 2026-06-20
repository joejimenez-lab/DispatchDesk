import { z } from "zod";
import { documentCategories, loadStatuses } from "@/types/database";

const money = z.coerce.number().min(0).default(0);
const optionalText = z.string().trim().transform((value) => (value === "" ? null : value));
const optionalUuid = z.string().transform((value) => (value === "" ? null : value)).nullable();
const optionalDate = z.string().transform((value) => (value === "" ? null : value)).nullable();

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
