"use client";

import Link, { useLinkStatus } from "next/link";
import {
  BarChart3,
  BookOpenText,
  Building2,
  ClipboardList,
  Fuel,
  Gauge,
  LogOut,
  Plus,
  Truck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

type NavItem = { label: string; href: string; icon: LucideIcon };

const links: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Loads", href: "/loads", icon: ClipboardList },
  { label: "Fleet", href: "/fleet", icon: Truck },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Drivers", href: "/drivers", icon: UsersRound },
  { label: "Brokers", href: "/brokers", icon: Building2 },
  { label: "Bookkeeping", href: "/bookkeeping", icon: BookOpenText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "IFTA", href: "/ifta", icon: Fuel },
];

function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return <span className={pending ? "nav-link-pending nav-link-pending-active" : "nav-link-pending"} aria-hidden="true" />;
}

export function AppNav() {
  const pathname = usePathname();
  const currentPage = links.find(({ href }) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/")),
  )?.label ?? "Dashboard";

  return (
    <>
      <aside className="command-header">
      <div className="command-masthead">
        <Link href="/dashboard" className="command-brand" aria-label="DispatchDesk dashboard">
          <span className="command-brand-mark" aria-hidden="true">DD</span>
          <span className="command-brand-copy">
            <span className="command-brand-name">DispatchDesk</span>
            <span className="command-brand-subtitle">Fleet management</span>
          </span>
        </Link>

        <nav className="module-rail" aria-label="Primary navigation">
          <div className="module-rail-inner">
            {links.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "module-link module-link-active" : "module-link"}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span>{label}</span>
                  <LinkPendingIndicator />
                </Link>
              );
            })}
          </div>
        </nav>

        <form action={signOut}>
          <button className="command-signout" type="submit">
            <LogOut className="size-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
      </aside>
      <header className="workspace-bar">
      <div className="workspace-current">
        <span>DispatchDesk</span>
        <strong>{currentPage}</strong>
      </div>
      <Link href="/loads/new" className="workspace-create">
        <Plus aria-hidden="true" />
        <span>New load</span>
        <LinkPendingIndicator />
      </Link>
      </header>
    </>
  );
}
