import Link from "next/link";
import { Truck } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/button";

const links = [
  ["Dashboard", "/dashboard"],
  ["Loads", "/loads"],
  ["Reports", "/reports"],
  ["Drivers", "/drivers"],
  ["Brokers", "/brokers"],
  ["Fleet", "/fleet"],
  ["Maintenance", "/maintenance"],
  ["IFTA", "/ifta"],
];

export function AppNav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-zinc-950">
          <Truck className="h-5 w-5" />
          DispatchDesk
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
              {label}
            </Link>
          ))}
          <form action={signOut}>
            <Button type="submit" variant="secondary">Sign out</Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
