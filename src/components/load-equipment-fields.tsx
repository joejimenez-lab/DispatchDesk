"use client";

import { useRef, useState } from "react";
import { Field, Select } from "@/components/field";
import type { LoadDriverOption, LoadEquipmentOption } from "@/lib/data/options";

type Props = {
  drivers: LoadDriverOption[];
  equipment: LoadEquipmentOption[];
  defaultDriverId?: string | null;
  defaultFleet?: string | null;
  defaultTruckUnitId?: string | null;
  defaultTrailerUnitId?: string | null;
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function uniqueUnit(
  equipment: LoadEquipmentOption[],
  type: LoadEquipmentOption["unit_type"],
  unitNumber: string | null,
) {
  const target = normalized(unitNumber);
  if (!target) return null;
  const matches = equipment.filter((unit) => unit.unit_type === type && normalized(unit.unit_number) === target);
  return matches.length === 1 ? matches[0] : null;
}

function withCurrentSelection(
  options: LoadEquipmentOption[],
  equipment: LoadEquipmentOption[],
  selectedId: string,
) {
  if (!selectedId || options.some((unit) => unit.id === selectedId)) return options;
  const selected = equipment.find((unit) => unit.id === selectedId);
  return selected ? [selected, ...options] : options;
}

export function LoadEquipmentFields({
  drivers,
  equipment,
  defaultDriverId = null,
  defaultFleet = null,
  defaultTruckUnitId = null,
  defaultTrailerUnitId = null,
}: Props) {
  const [driverId, setDriverId] = useState(defaultDriverId ?? "");
  const [fleet, setFleet] = useState(defaultFleet ?? "");
  const [truckUnitId, setTruckUnitId] = useState(defaultTruckUnitId ?? "");
  const [trailerUnitId, setTrailerUnitId] = useState(defaultTrailerUnitId ?? "");
  const equipmentTouched = useRef(Boolean(defaultFleet || defaultTruckUnitId || defaultTrailerUnitId));

  const companies = [...new Map(
    equipment
      .map((unit) => unit.company?.trim())
      .filter((company): company is string => Boolean(company))
      .map((company) => [normalized(company), company] as const),
  ).values()].sort((a, b) => a.localeCompare(b));
  if (fleet && !companies.some((company) => normalized(company) === normalized(fleet))) {
    companies.unshift(fleet);
  }

  const trucks = withCurrentSelection(
    equipment.filter((unit) => unit.unit_type === "Truck" && normalized(unit.company) === normalized(fleet)),
    equipment,
    truckUnitId,
  );
  const trailers = withCurrentSelection(
    equipment.filter((unit) => unit.unit_type === "Trailer" && normalized(unit.company) === normalized(fleet)),
    equipment,
    trailerUnitId,
  );

  function suggestDriverEquipment(nextDriverId: string) {
    setDriverId(nextDriverId);
    if (equipmentTouched.current) return;

    const driver = drivers.find((option) => option.id === nextDriverId);
    const suggestedTruck = uniqueUnit(equipment, "Truck", driver?.truck_number ?? null);
    const suggestedTrailer = uniqueUnit(equipment, "Trailer", driver?.trailer_number ?? null);
    const truckFleet = suggestedTruck?.company?.trim() ?? "";
    const trailerFleet = suggestedTrailer?.company?.trim() ?? "";

    if (suggestedTruck && truckFleet) {
      setFleet(truckFleet);
      setTruckUnitId(suggestedTruck.id);
      setTrailerUnitId(
        suggestedTrailer && normalized(trailerFleet) === normalized(truckFleet)
          ? suggestedTrailer.id
          : "",
      );
      return;
    }

    if (suggestedTrailer && trailerFleet) {
      setFleet(trailerFleet);
      setTruckUnitId("");
      setTrailerUnitId(suggestedTrailer.id);
      return;
    }

    setFleet("");
    setTruckUnitId("");
    setTrailerUnitId("");
  }

  function changeFleet(nextFleet: string) {
    equipmentTouched.current = true;
    setFleet(nextFleet);
    setTruckUnitId("");
    setTrailerUnitId("");
  }

  return (
    <>
      <Field label="Driver">
        <Select name="driver_id" value={driverId} onChange={(event) => suggestDriverEquipment(event.target.value)}>
          <option value="">Unassigned</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>{driver.name}</option>
          ))}
        </Select>
        <span className="mt-1 block text-xs font-normal text-zinc-500">
          Driver equipment is only a suggestion; this load keeps its own assignment.
        </span>
      </Field>
      <Field label="Fleet">
        <Select name="fleet_company" value={fleet} onChange={(event) => changeFleet(event.target.value)}>
          <option value="">No fleet assigned</option>
          {companies.map((company) => <option key={company} value={company}>{company}</option>)}
        </Select>
      </Field>
      <Field label="Truck">
        <Select
          name="truck_unit_id"
          value={truckUnitId}
          disabled={!fleet && !truckUnitId}
          onChange={(event) => {
            equipmentTouched.current = true;
            setTruckUnitId(event.target.value);
          }}
        >
          <option value="">Unassigned</option>
          {trucks.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_number}{normalized(unit.company) !== normalized(fleet) ? " (historical assignment)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Trailer">
        <Select
          name="trailer_unit_id"
          value={trailerUnitId}
          disabled={!fleet && !trailerUnitId}
          onChange={(event) => {
            equipmentTouched.current = true;
            setTrailerUnitId(event.target.value);
          }}
        >
          <option value="">Unassigned</option>
          {trailers.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_number}{normalized(unit.company) !== normalized(fleet) ? " (historical assignment)" : ""}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
