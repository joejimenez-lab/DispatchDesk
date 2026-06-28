import Link from "next/link";
import { AlertTriangle, ArrowLeft, ClipboardList, Home, RefreshCw, Truck } from "lucide-react";
import { Button, LinkButton } from "@/components/button";

type FallbackPanelProps = {
  title: string;
  message: string;
  tone?: "not-found" | "error";
  digest?: string;
  retry?: () => void;
  showBack?: boolean;
};

export function FallbackPanel({
  title,
  message,
  tone = "error",
  digest,
  retry,
  showBack = true,
}: FallbackPanelProps) {
  const Icon = tone === "not-found" ? ClipboardList : AlertTriangle;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-zinc-950 p-3 text-white">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Truck className="h-4 w-4" aria-hidden="true" />
              DispatchDesk
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-950">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{message}</p>
          </div>
        </div>

        {digest ? (
          <p className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600">
            Reference: {digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {retry ? (
            <Button type="button" onClick={retry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          ) : null}
          <LinkButton href="/dashboard">
            <Home className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </LinkButton>
          <LinkButton href="/loads" variant="secondary">
            Loads
          </LinkButton>
          <LinkButton href="/reports" variant="secondary">
            Reports
          </LinkButton>
          {showBack ? (
            <Link href=".." className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
