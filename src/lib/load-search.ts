import { ilikeOr } from "@/lib/search";

export const LOAD_SEARCH_COLUMNS = [
  "load_number",
  "pickup_location",
  "delivery_location",
  "return_location",
  "carrier_company",
  "fleet_company",
  "truck_number",
  "trailer_number",
  "commodity",
  "special_instructions",
];

export const STOP_SEARCH_COLUMNS = ["location", "appointment_number", "reference_number", "instructions"];
export const BROKER_SEARCH_COLUMNS = ["company_name", "contact_name", "email", "phone"];
export const DRIVER_SEARCH_COLUMNS = ["name", "phone", "email", "truck_number", "trailer_number"];

export function loadSearchExpression(
  token: string,
  matches: { stopLoadIds?: string[]; brokerIds?: string[]; driverIds?: string[] } = {},
) {
  return [
    ilikeOr(LOAD_SEARCH_COLUMNS, token),
    matches.stopLoadIds?.length ? `id.in.(${matches.stopLoadIds.join(",")})` : null,
    matches.brokerIds?.length ? `broker_id.in.(${matches.brokerIds.join(",")})` : null,
    matches.driverIds?.length ? `driver_id.in.(${matches.driverIds.join(",")})` : null,
  ].filter(Boolean).join(",");
}
