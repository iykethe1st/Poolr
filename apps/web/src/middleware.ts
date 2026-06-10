import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const TOKEN_COOKIE = 'poolr_access_token';

// Routes that anyone can access
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/verify-otp']);

// Routes only accessible when NOT authenticated
const AUTH_ONLY_PATHS = new Set(['/login', '/register', '/verify-otp']);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function isAuthOnly(pathname: string): boolean {
  return AUTH_ONLY_PATHS.has(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const isAuthenticated = Boolean(token);

  // Already logged in → redirect away from auth pages
  if (isAuthenticated && isAuthOnly(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Not logged in → redirect to login for all protected routes
  if (!isAuthenticated && !isPublic(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico and static assets
     * - api routes (handled by the NestJS backend)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
