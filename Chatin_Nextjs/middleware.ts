import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

interface TokenWithRole {
  role?: string;
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const path = req.nextUrl.pathname;

  console.log("🔍 Middleware - Path:", path, "| Auth:", !!token, "| Role:", (token as TokenWithRole)?.role);

  const isAuth = !!token;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/api/auth");

  // login değilse login sayfasına yönlendir
  if (!isAuth && !isAuthPage) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // login olmuş ama login sayfasına gidiyorsa → kendi role tabanlı default sayfasına yönlendir
  if (isAuth && path.startsWith("/login")) {
    const role = (token as TokenWithRole).role;
    let redirectUrl = "/user/chats?view=all";
    if (role === "superadmin") redirectUrl = "/superadmin";
    else if (role === "admin") redirectUrl = "/admin";
    else if (role === "manager") redirectUrl = "/manager";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  // root "/" erişimi → login olmuş kullanıcıları role tabanlı default sayfaya yönlendir
  if (isAuth && path === "/") {
    const role = (token as TokenWithRole).role;
    let redirectUrl = "/user/chats?view=all";
    if (role === "superadmin") redirectUrl = "/superadmin";
    else if (role === "admin") redirectUrl = "/admin";
    else if (role === "manager") redirectUrl = "/manager";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  // role-based erişim kontrolü
  if (isAuth) {
    const role = (token as TokenWithRole).role;

    if (path.startsWith("/superadmin") && role !== "superadmin") {
      console.log("⛔ Superadmin access denied, redirecting to root");
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (path.startsWith("/admin") && role !== "admin" && role !== "superadmin") {
      console.log("⛔ Admin access denied, redirecting to root");
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (path.startsWith("/manager") && role !== "manager") {
      console.log("⛔ Manager access denied, redirecting to root");
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (path.startsWith("/user") && role !== "user") {
      console.log("⛔ User access denied, redirecting to root");
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
