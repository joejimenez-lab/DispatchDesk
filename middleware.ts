import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseConfig,
  getVerifiedUser,
  logAuthUnavailable,
  missingSupabaseConfigResult,
} from "@/lib/supabase/auth-state";

function unavailablePageResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authentication unavailable | DispatchDesk</title>
  </head>
  <body style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;color:#09090b;">
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
      <section style="max-width:560px;border:1px solid #e4e4e7;border-radius:8px;background:white;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,.05);">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">DispatchDesk</p>
        <h1 style="margin:0;font-size:24px;line-height:1.25;">Authentication is temporarily unavailable</h1>
        <p style="margin:12px 0 24px;color:#52525b;line-height:1.5;">DispatchDesk could not verify your session. Try again once the authentication service is reachable.</p>
        <button onclick="window.location.reload()" style="height:40px;border:0;border-radius:6px;background:#09090b;color:white;padding:0 16px;font-weight:600;cursor:pointer;">Try again</button>
      </section>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isHealthCheck = request.nextUrl.pathname === "/api/health";
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const context = {
    method: request.method,
    path: request.nextUrl.pathname,
    route: "middleware",
    kind: isApi ? "api" as const : "page" as const,
  };

  if (isHealthCheck) return response;

  if (!config) {
    const result = missingSupabaseConfigResult();
    logAuthUnavailable(result, context);
    return isApi
      ? NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 })
      : unavailablePageResponse();
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const auth = await getVerifiedUser(supabase);

  if (auth.status === "unauthenticated" && !isLogin) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (auth.status === "unavailable") {
    logAuthUnavailable(auth, context);
    return isApi
      ? NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 })
      : unavailablePageResponse();
  }

  if (auth.status === "authenticated" && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
