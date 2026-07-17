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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppNav />
      <main id="main-content" className="app-content">{children}</main>
    </div>
  );
}
