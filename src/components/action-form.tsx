"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  children: ReactNode;
  className?: string;
  successMessage?: boolean;
  preserveValues?: boolean;
  errorTitle?: string;
  describeIssue?: (path: string) => { label: string; name?: string; index?: number };
};

const ActionFormContext = createContext({ state: initialActionState, pending: false });

export function useActionFormPending() {
  return useContext(ActionFormContext).pending;
}

export function ActionFieldError({ path }: { path: string }) {
  const { state } = useContext(ActionFormContext);
  const messages = state.status === "error" ? state.issues?.filter((issue) => issue.path === path).map((issue) => issue.message) : [];
  return messages?.length ? <span className="mt-1 block text-sm font-normal text-red-700">{messages.join(". ")}</span> : null;
}

export function ActionForm({
  action,
  children,
  className,
  successMessage = true,
  preserveValues = false,
  errorTitle,
  describeIssue,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const showMessage = state.message && (state.status === "error" || successMessage);
  const issues = state.issues ?? Object.entries(state.errors ?? {}).flatMap(([path, messages]) => (messages ?? []).map((message) => ({ path, message })));

  useEffect(() => {
    if (state.status === "error") {
      messageRef.current?.focus();
      messageRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  function focusField(name: string, index = 0) {
    const fields = Array.from(formRef.current?.elements ?? []).filter((element) => element.getAttribute("name") === name && element.getAttribute("type") !== "hidden");
    const field = fields[index] as HTMLElement | undefined;
    field?.focus();
    field?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }

  return (
    <ActionFormContext.Provider value={{ state, pending }}>
      <form ref={formRef} action={formAction} className={className} noValidate={preserveValues} aria-describedby={showMessage ? messageId : undefined}
        onSubmit={preserveValues ? (event) => {
          // Dispatch explicitly so React does not reset the user's fields after a failed action.
          event.preventDefault();
          if (pending) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        } : undefined}
      >
        {showMessage ? (
          <div
            role={state.status === "error" ? "alert" : "status"}
            ref={messageRef}
            id={messageId}
            tabIndex={-1}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700",
            )}
          >
            {state.status === "error" && errorTitle ? <p className="font-semibold">{errorTitle}</p> : null}
            <p>{issues.length && state.status === "error" ? "Fix the fields below and try again." : state.message}</p>
            {state.status === "error" && issues.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.map((issue, index) => {
                  const target = describeIssue?.(issue.path) ?? { label: issue.path.replaceAll("_", " "), name: issue.path };
                  const text = `${target.label ? `${target.label}: ` : ""}${issue.message}`;
                  return <li key={`${issue.path}-${index}`}>{target.name ? <button type="button" className="text-left underline underline-offset-2" onClick={() => focusField(target.name!, target.index)}>{text}</button> : text}</li>;
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
        {children}
      </form>
    </ActionFormContext.Provider>
  );
}
