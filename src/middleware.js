import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE_NAME = "spiderman_auth";

const JWT_SECRET_VALUE = process.env.JWT_SECRET;

if (!JWT_SECRET_VALUE) {
  throw new Error("Missing JWT_SECRET in .env.local");
}

const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_VALUE
);

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(
      token,
      JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(
    AUTH_COOKIE_NAME
  )?.value;

  const isAuthPage =
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/register");

  const isPublicApi =
  pathname === "/api/auth/login" ||
  pathname === "/api/auth/register";

  // No authentication cookie
  if (!token) {
    if (isAuthPage || isPublicApi) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    return NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
  }

  // Verify JWT locally.
  // No Turso request here.
  const payload = await verifyToken(token);

  // Invalid or expired JWT
  if (!payload?.sub) {
    const response = isAuthPage
      ? NextResponse.next()
      : pathname.startsWith("/api/")
        ? NextResponse.json(
            {
              error: "Session expired.",
            },
            { status: 401 }
          )
        : NextResponse.redirect(
            new URL("/auth/login", request.url)
          );

    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  }

  // Logged-in user should not see login/register
  if (isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};