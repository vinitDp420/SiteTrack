import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const secret = process.env.NEXTAUTH_SECRET || 'sitetrack-secret-key-321-654-987';

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const token = await getToken({
    req,
    secret,
  });

  // If not authenticated, redirect to /login with callbackUrl
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token.role as string) || 'WORKER';

  // Admin/Supervisor protection
  if (path.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUPERVISOR') {
    return NextResponse.redirect(new URL('/worker/home', req.url));
  }

  // Supervisor restrictions for financial/sensitive admin paths
  if (role === 'SUPERVISOR') {
    const restrictedPaths = ['/admin/payments', '/admin/payroll', '/admin/boq', '/admin/fraud-alerts'];
    if (restrictedPaths.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
  }

  // Worker protection
  if (path.startsWith('/worker') && role !== 'WORKER') {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  return NextResponse.next();
}

// Protect all admin and worker routes, but let login, public assets, and api routes remain public
export const config = {
  matcher: ['/admin/:path*', '/worker/:path*'],
};
