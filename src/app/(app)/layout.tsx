import { AppNav } from "@/components/app-nav";
import { AuthUnavailablePanel } from "@/components/auth-unavailable-panel";
import { createClient } from "@/lib/supabase/server";
import {
  getSupabaseConfig,
  getVerifiedUser,
  logAuthUnavailable,
  missingSupabaseConfigResult,
} from "@/lib/supabase/auth-state";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseConfig()) {
    const result = missingSupabaseConfigResult();
    logAuthUnavailable(result, { route: "(app)/layout", kind: "page" });
    return <AuthUnavailablePanel />;
  }

  const supabase = await createClient();
  const auth = await getVerifiedUser(supabase);

  if (auth.status === "unauthenticated") redirect("/login");

  if (auth.status === "unavailable") {
    logAuthUnavailable(auth, { route: "(app)/layout", kind: "page" });
    return <AuthUnavailablePanel />;
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </>
  );
}
