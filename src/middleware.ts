import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If not authenticated, let next-auth handle redirection to signIn page
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const role = token.role as string;

    // Admin/Supervisor protection
    if (path.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUPERVISOR') {
      // Redirect unauthorized workers to the mobile home page
      return NextResponse.redirect(new URL('/worker/home', req.url));
    }

    // Supervisor restrictions for financial/sensitive admin paths
    if (role === 'SUPERVISOR') {
      const restrictedPaths = ['/admin/payments', '/admin/payroll', '/admin/boq', '/admin/fraud-alerts'];
      if (restrictedPaths.some(p => path.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
      }
    }


    // Worker protection
    if (path.startsWith('/worker') && role !== 'WORKER') {
      // Redirect admins/supervisors to the admin dashboard
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect all admin and worker routes, but let login and api routes remain public
export const config = {
  matcher: ['/admin/:path*', '/worker/:path*'],
};
