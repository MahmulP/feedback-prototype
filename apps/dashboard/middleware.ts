import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: forces login for `/projects/...` once auth is configured.
 *
 * We do *not* call `getSession()` here (it imports `next/headers` and Node
 * crypto, which aren't available on the Edge runtime). Instead we do a cheap
 * "is the cookie present?" check and let the page itself verify the HMAC.
 *
 * The signed-cookie verify on the page is the real authn gate — middleware
 * only handles the redirect when no cookie at all is present.
 */
export function middleware(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) return NextResponse.next();

  const session = request.cookies.get("iwk_dash_session");
  if (session?.value) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/projects/:path*"],
};
