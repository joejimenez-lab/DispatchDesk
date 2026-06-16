"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  children: ReactNode;
  className?: string;
  successMessage?: boolean;
};

export function ActionForm({
  action,
  children,
  className,
  successMessage = true,
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const showMessage = state.message && (state.status === "error" || successMessage);

  return (
    <form action={formAction} className={className}>
      {showMessage ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700",
          )}
        >
          {state.message}
        </div>
      ) : null}
      {children}
    </form>
  );
}
