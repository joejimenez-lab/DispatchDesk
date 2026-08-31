"use client";

import { useRef } from "react";
import { Button } from "@/components/button";
import { Field, Input, Select, Textarea } from "@/components/field";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { dispatchTimeZones, stopTypes, type DispatchStop } from "@/lib/dispatch";

export type EditableStop = DispatchStop & { key: string };

function zoneLabel(zone: string) {
  return zone === "UTC" ? "UTC" : zone.replace("America/", "").replace("Pacific/", "").replaceAll("_", " ");
}

export function LoadStopsEditor({ stops, onChange }: { stops: EditableStop[]; onChange: (stops: EditableStop[]) => void }) {
  const nextKey = useRef(stops.length);

  function update(index: number, values: Partial<EditableStop>) {
    onChange(stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...values } : stop));
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((stop, position) => ({ ...stop, position })));
  }

  function addStop() {
    const key = `new-stop-${nextKey.current}`;
    nextKey.current += 1;
    onChange([...stops, {
      key,
      position: stops.length,
      stop_type: "Intermediate",
      location: "",
      scheduled_start: null,
      scheduled_end: null,
      schedule_precision: "window",
      time_zone: "America/Los_Angeles",
      appointment_number: null,
      reference_number: null,
      instructions: null,
    }]);
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Stops and appointments</h2>
          <p className="text-sm text-zinc-600">Times are entered and displayed in each stop&apos;s local time zone.</p>
        </div>
        <Button type="button" variant="secondary" onClick={addStop}>+ Add stop</Button>
      </div>
      {stops.map((stop, index) => (
        <article key={stop.key} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{index + 1}</span>
              <strong className="text-sm text-zinc-900">{stop.stop_type} stop</strong>
              {stop.schedule_precision === "date" ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Date only · add appointment times</span> : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="h-8 px-2" aria-label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
              <Button type="button" variant="secondary" className="h-8 px-2" aria-label={`Move stop ${index + 1} down`} disabled={index === stops.length - 1} onClick={() => move(index, 1)}>↓</Button>
              <Button type="button" variant="secondary" className="h-8 px-2" disabled={stops.length <= 2} onClick={() => onChange(stops.filter((_, stopIndex) => stopIndex !== index).map((item, position) => ({ ...item, position })))}>Remove</Button>
            </div>
          </div>
          <input type="hidden" name="stop_schedule_precision" value={stop.schedule_precision} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Stop type">
              <Select name="stop_type" value={stop.stop_type} onChange={(event) => update(index, { stop_type: event.target.value as EditableStop["stop_type"] })}>
                {stopTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Location" className="md:col-span-1 lg:col-span-2">
              <LocationAutocomplete name="stop_location" required defaultValue={stop.location} />
            </Field>
            <Field label="Appointment start">
              <Input type="datetime-local" name="stop_scheduled_start" value={stop.scheduled_start?.slice(0, 16) ?? ""} onChange={(event) => update(index, { scheduled_start: event.target.value || null, schedule_precision: "window" })} />
            </Field>
            <Field label="Appointment end">
              <Input type="datetime-local" name="stop_scheduled_end" value={stop.scheduled_end?.slice(0, 16) ?? ""} onChange={(event) => update(index, { scheduled_end: event.target.value || null, schedule_precision: "window" })} />
            </Field>
            <Field label="Time zone">
              <Select name="stop_time_zone" value={stop.time_zone ?? "America/Los_Angeles"} onChange={(event) => update(index, { time_zone: event.target.value })}>
                {dispatchTimeZones.map((zone) => <option key={zone} value={zone}>{zoneLabel(zone)}</option>)}
              </Select>
            </Field>
            <Field label="Appointment number">
              <Input name="stop_appointment_number" defaultValue={stop.appointment_number ?? ""} />
            </Field>
            <Field label="Reference number">
              <Input name="stop_reference_number" defaultValue={stop.reference_number ?? ""} />
            </Field>
            <Field label="Stop instructions" className="md:col-span-2 lg:col-span-3">
              <Textarea name="stop_instructions" defaultValue={stop.instructions ?? ""} placeholder="Check-in procedure, dock, contact, accessorial, or handling instructions" />
            </Field>
          </div>
        </article>
      ))}
    </section>
  );
}
