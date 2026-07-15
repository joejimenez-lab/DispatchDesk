import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/button";
import { Field, Input } from "@/components/field";
import { BarChart3, LockKeyhole, Route, ShieldCheck, Truck, Wrench } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="DispatchDesk product overview">
        <div className="login-brand">
          <span className="sidebar-logo" aria-hidden="true"><Truck className="size-5" /></span>
          DispatchDesk
        </div>

        <div className="login-copy">
          <div className="login-eyebrow"><Route className="size-3.5" /> Fleet management software</div>
          <h1>Run your fleet from one place.</h1>
          <p>
            Manage loads, drivers, maintenance, expenses, and reports without jumping between systems.
          </p>
          <div className="login-feature-grid">
            <div className="login-feature"><Route className="size-5" />Loads and dispatch</div>
            <div className="login-feature"><BarChart3 className="size-5" />Revenue and expenses</div>
            <div className="login-feature"><Wrench className="size-5" />Maintenance records</div>
          </div>
        </div>

        <div className="login-showcase-foot">
          <ShieldCheck className="size-4" /> Secure access for your team
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand">
            <span className="sidebar-logo" aria-hidden="true"><Truck className="size-5" /></span>
            DispatchDesk
          </div>
          <div className="login-card-kicker">Account sign in</div>
          <h2>Welcome back</h2>
          <p className="login-card-copy">Enter your email and password to continue.</p>
        {params.error ? (
          <div className="login-error" role="alert">
            {params.error}
          </div>
        ) : null}

        <form action={signIn} className="login-form space-y-5">
          <Field label="Email">
            <Input type="email" name="email" required autoComplete="email" placeholder="admin@company.com" />
          </Field>
          <Field label="Password">
            <Input type="password" name="password" required autoComplete="current-password" placeholder="Enter your password" />
          </Field>
          <Button type="submit" className="login-submit w-full">Sign in</Button>
        </form>

          <div className="login-security-note">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Only authorized users can access this workspace.
          </div>
        </div>
      </section>
    </main>
  );
}
