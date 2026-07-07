// Quarter math and per-state aggregation for IFTA fuel tax reporting.

export const iftaJurisdictions = [
  { code: "AL", name: "Alabama" },
  { code: "AR", name: "Arkansas" },
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "IA", name: "Iowa" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "MA", name: "Massachusetts" },
  { code: "MD", name: "Maryland" },
  { code: "ME", name: "Maine" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MO", name: "Missouri" },
  { code: "MS", name: "Mississippi" },
  { code: "MT", name: "Montana" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "NE", name: "Nebraska" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NV", name: "Nevada" },
  { code: "NY", name: "New York" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VA", name: "Virginia" },
  { code: "VT", name: "Vermont" },
  { code: "WA", name: "Washington" },
  { code: "WI", name: "Wisconsin" },
  { code: "WV", name: "West Virginia" },
  { code: "WY", name: "Wyoming" },
] as const;

export const iftaStateCodes = iftaJurisdictions.map((jurisdiction) => jurisdiction.code);

export function iftaStateName(code: string) {
  return iftaJurisdictions.find((jurisdiction) => jurisdiction.code === code)?.name ?? code;
}

export type IftaQuarter = { year: number; quarter: 1 | 2 | 3 | 4 };

export function quarterOfDate(date: string): IftaQuarter {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return { year, quarter: (Math.floor((month - 1) / 3) + 1) as IftaQuarter["quarter"] };
}

export function currentIftaQuarter(today = new Date()): IftaQuarter {
  return {
    year: today.getFullYear(),
    quarter: (Math.floor(today.getMonth() / 3) + 1) as IftaQuarter["quarter"],
  };
}

const QUARTER_END_DAY = ["03-31", "06-30", "09-30", "12-31"];

export function quarterDateRange({ year, quarter }: IftaQuarter) {
  const startMonth = String((quarter - 1) * 3 + 1).padStart(2, "0");
  return {
    start: `${year}-${startMonth}-01`,
    end: `${year}-${QUARTER_END_DAY[quarter - 1]}`,
  };
}

export function quarterLabel({ year, quarter }: IftaQuarter) {
  return `${year} Q${quarter}`;
}

export type IftaStateMilesEntry = { state: string; miles: number };
export type IftaFuelEntry = { state: string; gallons: number; amount_paid: number };
export type IftaStateSummary = { state: string; miles: number; gallons: number; paid: number };

function stateOrder(a: string, b: string) {
  return a.localeCompare(b);
}

export function summarizeIftaByState(
  trips: { ifta_trip_miles: IftaStateMilesEntry[] }[],
  purchases: IftaFuelEntry[],
): IftaStateSummary[] {
  const byState = new Map<string, IftaStateSummary>();
  const entry = (state: string) => {
    const existing = byState.get(state);
    if (existing) return existing;
    const created = { state, miles: 0, gallons: 0, paid: 0 };
    byState.set(state, created);
    return created;
  };

  for (const trip of trips) {
    for (const leg of trip.ifta_trip_miles) {
      entry(leg.state).miles += Number(leg.miles);
    }
  }
  for (const purchase of purchases) {
    const summary = entry(purchase.state);
    summary.gallons += Number(purchase.gallons);
    summary.paid += Number(purchase.amount_paid);
  }

  return [...byState.values()].sort((a, b) => stateOrder(a.state, b.state));
}

export function iftaTotals(summary: IftaStateSummary[]) {
  const totals = summary.reduce(
    (result, state) => ({
      miles: result.miles + state.miles,
      gallons: result.gallons + state.gallons,
      paid: result.paid + state.paid,
    }),
    { miles: 0, gallons: 0, paid: 0 },
  );
  return { ...totals, mpg: totals.gallons > 0 ? totals.miles / totals.gallons : null };
}

export function tripTotalMiles(miles: IftaStateMilesEntry[]) {
  return miles.reduce((total, leg) => total + Number(leg.miles), 0);
}

export function statesWithMiles(trips: { ifta_trip_miles: IftaStateMilesEntry[] }[]) {
  const states = new Set(trips.flatMap((trip) => trip.ifta_trip_miles.map((leg) => leg.state)));
  return [...states].sort(stateOrder);
}

export type IftaRouteTemplate = {
  pickup_city: string;
  dropoff_city: string;
  miles: IftaStateMilesEntry[];
};

// Most lanes cross the same states for the same distance on every trip, so the
// newest trip per pickup/drop-off pair doubles as a reusable miles template.
export function buildRouteTemplates(
  trips: { pickup_city: string; dropoff_city: string; ifta_trip_miles: IftaStateMilesEntry[] }[],
): IftaRouteTemplate[] {
  const routes = new Map<string, IftaRouteTemplate>();
  for (const trip of trips) {
    if (!trip.ifta_trip_miles.length) continue;
    const key = `${trip.pickup_city.trim().toLocaleLowerCase()}|${trip.dropoff_city.trim().toLocaleLowerCase()}`;
    if (routes.has(key)) continue;
    routes.set(key, {
      pickup_city: trip.pickup_city.trim(),
      dropoff_city: trip.dropoff_city.trim(),
      miles: [...trip.ifta_trip_miles]
        .map((leg) => ({ state: leg.state, miles: Number(leg.miles) }))
        .sort((a, b) => stateOrder(a.state, b.state)),
    });
  }
  return [...routes.values()].sort((a, b) =>
    `${a.pickup_city} → ${a.dropoff_city}`.localeCompare(`${b.pickup_city} → ${b.dropoff_city}`));
}

const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatQuantity(value: number) {
  return quantityFormat.format(value);
}
