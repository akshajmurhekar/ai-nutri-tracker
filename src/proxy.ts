import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js 16 "Proxy" (formerly Middleware). Runs on every / and /login request:
 *   * refreshes the Supabase auth cookies (keeps the user signed in),
 *   * protects / from unauthenticated users,
 *   * sends already-signed-in users away from /login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Move new cookie values onto the outgoing request and the response.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates the session and refreshes the access token if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname === '/' && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/login'],
};
