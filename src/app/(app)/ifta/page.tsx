import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { DetailsCloseButton } from "@/components/details-close-button";
import { ExportMenu } from "@/components/export-menu";
import { Field, Select } from "@/components/field";
import { ConfirmSubmitButton } from "@/components/form-buttons";
import { IftaFuelForm } from "@/components/ifta-fuel-form";
import { IftaTripForm } from "@/components/ifta-trip-form";
import { addIftaFuelPurchase, addIftaTrip, deleteIftaFuelPurchase, deleteIftaTrip } from "@/lib/actions/ifta";
import { getIftaFuelPurchases, getIftaRouteTemplates, getIftaTrips, getIftaTruckNumbers } from "@/lib/data/ifta";
import {
  currentIftaQuarter,
  formatQuantity,
  iftaStateName,
  iftaTotals,
  quarterDateRange,
  quarterLabel,
  statesWithMiles,
  summarizeIftaByState,
  tripTotalMiles,
  type IftaQuarter,
} from "@/lib/ifta";
import { currency, formatDate } from "@/lib/utils";

function selectedQuarter(params: { year?: string; quarter?: string }): IftaQuarter {
  const fallback = currentIftaQuarter();
  const year = Number(params.year);
  const quarter = Number(params.quarter);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year,
    quarter: [1, 2, 3, 4].includes(quarter) ? (quarter as IftaQuarter["quarter"]) : fallback.quarter,
  };
}

export default async function IftaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; truck?: string }>;
}) {
  const params = await searchParams;
  const period = selectedQuarter(params);
  const range = quarterDateRange(period);
  const truck = params.truck || undefined;

  const [trips, purchases, truckNumbers, routes] = await Promise.all([
    getIftaTrips({ ...range, truck }),
    getIftaFuelPurchases({ ...range, truck }),
    getIftaTruckNumbers(),
    getIftaRouteTemplates(),
  ]);

  const summary = summarizeIftaByState(trips, purchases);
  const totals = iftaTotals(summary);
  const tripStates = statesWithMiles(trips);
  const tripStateTotals = new Map(
    tripStates.map((state) => [
      state,
      trips.reduce((total, trip) => total + Number(trip.ifta_trip_miles.find((leg) => leg.state === state)?.miles ?? 0), 0),
    ]),
  );
  const fuelTotals = purchases.reduce(
    (result, purchase) => ({
      gallons: result.gallons + Number(purchase.gallons),
      paid: result.paid + Number(purchase.amount_paid),
    }),
    { gallons: 0, paid: 0 },
  );

  const exportParams = new URLSearchParams({ year: String(period.year), quarter: String(period.quarter) });
  if (truck) exportParams.set("truck", truck);
  const exportHref = (report: string) => `/api/ifta/export?report=${report}&${exportParams.toString()}`;
  const currentYear = currentIftaQuarter().year;
  const years = [...new Set([period.year, ...Array.from({ length: 5 }, (_, index) => currentYear - index)])]
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">IFTA Fuel Tax</h1>
          <p className="text-sm text-zinc-600">Miles per state and fuel purchases per state, totaled by quarter for IFTA filing.</p>
        </div>
        <ExportMenu
          heading={`IFTA exports · ${quarterLabel(period)}`}
          description="Exports use the quarter and truck filters on this page."
          items={[
            {
              title: "State summary",
              description: "Miles, gallons, and fuel paid per state — the numbers the quarterly IFTA return needs.",
              formats: [{ label: "CSV", href: exportHref("summary"), type: "csv" }],
            },
            {
              title: "Trips",
              description: "Every trip with its state-by-state miles breakdown.",
              formats: [{ label: "CSV", href: exportHref("trips"), type: "csv" }],
            },
            {
              title: "Fuel purchases",
              description: "Every fuel stop with gallons and amount paid.",
              formats: [{ label: "CSV", href: exportHref("fuel"), type: "csv" }],
            },
          ]}
        />
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <Field label="Year">
          <Select name="year" defaultValue={String(period.year)}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
        </Field>
        <Field label="Quarter">
          <Select name="quarter" defaultValue={String(period.quarter)}>
            <option value="1">Q1 (Jan – Mar)</option>
            <option value="2">Q2 (Apr – Jun)</option>
            <option value="3">Q3 (Jul – Sep)</option>
            <option value="4">Q4 (Oct – Dec)</option>
          </Select>
        </Field>
        <Field label="Truck">
          <Select name="truck" defaultValue={truck ?? ""}>
            <option value="">All trucks</option>
            {truckNumbers.map((number) => <option key={number} value={number}>{number}</option>)}
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Filter</button>
          <Link href="/ifta" className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4"><div className="text-sm font-medium text-zinc-600">Total miles</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{formatQuantity(totals.miles)}</div></div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4"><div className="text-sm font-medium text-zinc-600">Gallons purchased</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{formatQuantity(totals.gallons)}</div></div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4"><div className="text-sm font-medium text-zinc-600">Fuel paid</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{currency(totals.paid)}</div></div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4"><div className="text-sm font-medium text-zinc-600">Fleet MPG</div><div className="mt-1 text-2xl font-semibold text-zinc-950">{totals.mpg == null ? "—" : totals.mpg.toFixed(2)}</div></div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Miles &amp; fuel by state</h2>
          <p className="text-sm text-zinc-600">Quarterly totals per state for {quarterLabel(period)}{truck ? ` · truck ${truck}` : ""}.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Miles</th>
                <th className="px-4 py-3 text-right">Gallons</th>
                <th className="px-4 py-3 text-right">Fuel paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summary.map((state) => (
                <tr key={state.state}>
                  <td className="px-4 py-3 font-medium text-zinc-950">{state.state} · {iftaStateName(state.state)}</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(state.miles)}</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(state.gallons)}</td>
                  <td className="px-4 py-3 text-right">{currency(state.paid)}</td>
                </tr>
              ))}
              {summary.length ? (
                <tr className="bg-zinc-50 font-semibold text-zinc-950">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(totals.miles)}</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(totals.gallons)}</td>
                  <td className="px-4 py-3 text-right">{currency(totals.paid)}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No trips or fuel purchases recorded for {quarterLabel(period)} yet. Add them below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Trips (miles per state)</h2>
            <p className="text-sm text-zinc-600">One row per trip with the miles driven in each state.</p>
          </div>
          <details className="group w-full sm:w-auto">
            <summary className="cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800">+ Add trip</summary>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(68rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
              <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
              <IftaTripForm action={addIftaTrip} truckNumbers={truckNumbers} routes={routes} />
            </div>
          </details>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">T#</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Drop-off</th>
                {tripStates.map((state) => <th key={state} className="px-4 py-3 text-right">{state}</th>)}
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-semibold text-zinc-950">{trip.truck_number}</td>
                  <td className="px-4 py-3">
                    <div className="min-w-28 font-medium text-zinc-900">{formatDate(trip.start_date)}</div>
                    {trip.end_date ? <div className="mt-1 text-xs text-zinc-500">to {formatDate(trip.end_date)}</div> : null}
                  </td>
                  <td className="px-4 py-3">{trip.pickup_city}</td>
                  <td className="px-4 py-3">{trip.dropoff_city}</td>
                  {tripStates.map((state) => {
                    const miles = trip.ifta_trip_miles.find((leg) => leg.state === state)?.miles;
                    return <td key={state} className="px-4 py-3 text-right">{miles == null ? "" : formatQuantity(Number(miles))}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-semibold text-zinc-950">{formatQuantity(tripTotalMiles(trip.ifta_trip_miles))}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionForm action={deleteIftaTrip.bind(null, trip.id)} successMessage={false}>
                      <ConfirmSubmitButton message="Delete this trip and its state miles?" variant="secondary">Delete</ConfirmSubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {trips.length ? (
                <tr className="bg-zinc-50 font-semibold text-zinc-950">
                  <td className="px-4 py-3" colSpan={4}>Total miles</td>
                  {tripStates.map((state) => <td key={state} className="px-4 py-3 text-right">{formatQuantity(tripStateTotals.get(state) ?? 0)}</td>)}
                  <td className="px-4 py-3 text-right">{formatQuantity(totals.miles)}</td>
                  <td className="px-4 py-3" />
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">No trips recorded for this quarter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Fuel purchases</h2>
            <p className="text-sm text-zinc-600">One row per fuel stop: gallons pumped and amount paid, by state.</p>
          </div>
          <details className="group w-full sm:w-auto">
            <summary className="cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800">+ Add fuel purchase</summary>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(68rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
              <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
              <IftaFuelForm action={addIftaFuelPurchase} truckNumbers={truckNumbers} />
            </div>
          </details>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">T#</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Gallons</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-semibold text-zinc-950">{purchase.truck_number}</td>
                  <td className="px-4 py-3">{formatDate(purchase.purchase_date)}</td>
                  <td className="px-4 py-3">{purchase.city ?? ""}</td>
                  <td className="px-4 py-3">{purchase.state}</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(Number(purchase.gallons))}</td>
                  <td className="px-4 py-3 text-right">{currency(purchase.amount_paid)}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionForm action={deleteIftaFuelPurchase.bind(null, purchase.id)} successMessage={false}>
                      <ConfirmSubmitButton message="Delete this fuel purchase?" variant="secondary">Delete</ConfirmSubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {purchases.length ? (
                <tr className="bg-zinc-50 font-semibold text-zinc-950">
                  <td className="px-4 py-3" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(fuelTotals.gallons)}</td>
                  <td className="px-4 py-3 text-right">{currency(fuelTotals.paid)}</td>
                  <td className="px-4 py-3" />
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">No fuel purchases recorded for this quarter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
