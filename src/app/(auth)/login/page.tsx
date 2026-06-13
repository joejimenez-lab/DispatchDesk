import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/button";
import { Field, Input } from "@/components/field";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-950">DispatchDesk</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in with the admin email and password.</p>
        </div>
        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </div>
        ) : null}
        <form action={signIn} className="space-y-4">
          <Field label="Email">
            <Input type="email" name="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input type="password" name="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
      </section>
    </main>
  );
}
