import { ActionForm } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";

type MergeRecord = { id: string };

type MergeField = {
  key: string;
  label: string;
  combine?: boolean;
};

function displayValue(value: string | null) {
  return value?.trim() || "Not set";
}

function FieldChoice({ field, first, second }: { field: MergeField; first: MergeRecord; second: MergeRecord }) {
  const firstValue = (first as unknown as Record<string, string | null>)[field.key] ?? null;
  const secondValue = (second as unknown as Record<string, string | null>)[field.key] ?? null;
  const same = firstValue?.trim() === secondValue?.trim();
  const defaultChoice = field.combine && firstValue?.trim() && secondValue?.trim() && !same ? "combine" : "first";
  if (same) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <input type="hidden" name={`${field.key}_choice`} value="first" />
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{field.label}</div>
        <div className="mt-1 text-sm text-zinc-800">{displayValue(firstValue)}</div>
      </div>
    );
  }
  return (
    <fieldset className="rounded-md border border-zinc-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Keep {field.label}</legend>
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="radio" name={`${field.key}_choice`} value="first" defaultChecked={defaultChoice === "first"} required />
          <span>{displayValue(firstValue)}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name={`${field.key}_choice`} value="second" required />
          <span>{displayValue(secondValue)}</span>
        </label>
        {field.combine ? (
          <label className="flex items-start gap-2">
            <input type="radio" name={`${field.key}_choice`} value="combine" defaultChecked={defaultChoice === "combine"} required />
            <span>Combine both values</span>
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}

export function ContactMergeForm({
  first,
  second,
  firstLabel,
  secondLabel,
  signals,
  confidence,
  fields,
  action,
}: {
  first: MergeRecord;
  second: MergeRecord;
  firstLabel: string;
  secondLabel: string;
  signals: string[];
  confidence: "exact" | "likely";
  fields: MergeField[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  return (
    <article className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-950">{firstLabel} ↔ {secondLabel}</h3>
          <p className="mt-1 text-sm text-zinc-600">{confidence === "exact" ? "Strong match" : "Review suggested"}: {signals.join(", ")}.</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">{confidence}</span>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-violet-800">Review and merge</summary>
        <ActionForm action={action} className="mt-4 space-y-4 rounded-lg border border-violet-200 bg-white p-4">
          <fieldset>
            <legend className="text-sm font-semibold text-zinc-900">Surviving record</legend>
            <p className="mb-2 text-xs text-zinc-500">All related history will be reassigned to this record.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="rounded-md border border-zinc-200 p-3 text-sm"><input className="mr-2" type="radio" name="survivor_id" value={first.id} defaultChecked required />{firstLabel}</label>
              <label className="rounded-md border border-zinc-200 p-3 text-sm"><input className="mr-2" type="radio" name="survivor_id" value={second.id} required />{secondLabel}</label>
            </div>
          </fieldset>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => <FieldChoice key={field.key} field={field} first={first} second={second} />)}
          </div>
          <ConfirmSubmitButton
            message={`Merge these records? ${secondLabel} or ${firstLabel} will be removed after related history is reassigned.`}
            variant="danger"
            pendingText="Merging..."
          >
            Confirm merge
          </ConfirmSubmitButton>
        </ActionForm>
      </details>
    </article>
  );
}
