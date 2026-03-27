import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes require ADMIN role
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // CPD Admin routes require CPD_ADMIN or ADMIN role
    if (pathname.startsWith("/cpd-admin") && token?.role !== "CPD_ADMIN" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Protect everything except public routes
    "/((?!login|register|verify-email|pending|forgot-password|reset-password|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
