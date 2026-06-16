import { ZodError } from "zod";

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
};

export function successState(message: string): ActionState {
  return { status: "success", message };
}

export function errorState(error: unknown, fallback = "Something went wrong. Try again."): ActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Check the form and try again.",
      errors: error.flatten().fieldErrors,
    };
  }

  if (error instanceof Error && error.message) {
    return { status: "error", message: error.message };
  }

  return { status: "error", message: fallback };
}
