import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

/** Routes reachable without a session. Everything else requires login. */
function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/t/") || // public guest NFC flow
    // public wallet pass view, but /w/.../v (claim validation) requires auth
    (pathname.startsWith("/w/") && !pathname.endsWith("/v")) ||
    pathname.startsWith("/api/wallet/") || // wallet provider endpoints
    pathname.startsWith("/api/webhooks/") || // provider webhooks (signed)
    pathname.startsWith("/pay/") || // public sandbox checkout + return
    pathname.startsWith("/auth")
  );
}

/**
 * Refreshes the Supabase auth session on every request, keeps the auth cookies
 * in sync, and gates the Tips Manager behind a logged-in user.
 */
export async function updateSession(request: NextRequest) {
  // Skip prefetch requests: Next.js fires these in the background for every
  // <Link> in view. They don't need session refresh or gating — the real
  // navigation that follows handles both.
  if (
    request.headers.get("next-router-prefetch") ||
    request.headers.get("next-router-segment-prefetch")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Build a redirect that preserves any auth cookies refreshed above.
  // (A bare NextResponse.redirect would drop the refreshed Supabase session
  // cookies set on supabaseResponse → session loss on the next request.)
  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => res.cookies.set(cookie));
    return res;
  };

  // Unauthenticated user hitting a protected route → send to login.
  if (!user && !isPublicPath(pathname)) {
    return redirectTo("/login");
  }

  // Logged-in user hitting the login page → send to the manager.
  if (user && pathname.startsWith("/login")) {
    return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
