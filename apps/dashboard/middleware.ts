import { NextResponse, type NextRequest } from "next/server";

/**
 * Forces login for `/projects/...` and `/account/...`. The actual auth check
 * happens server-side via the API; here we only redirect away when the
 * session cookie is missing entirely.
 */
export function middleware(request: NextRequest) {
  const session = request.cookies.get("mahmulp_session");
  if (session?.value) return NextResponse.next();
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/projects/:path*", "/account/:path*"],
};
