import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

import {
  rateLimit,
  getClientIp,
} from "@/lib/rateLimit";

const AUTH_COOKIE_NAME =
  "spiderman_auth";

const JWT_SECRET_VALUE =
  process.env.JWT_SECRET;

if (!JWT_SECRET_VALUE) {
  throw new Error(
    "Missing JWT_SECRET in .env.local"
  );
}

const JWT_SECRET =
  new TextEncoder().encode(
    JWT_SECRET_VALUE
  );

/*
|--------------------------------------------------------------------------
| JWT VERIFY
|--------------------------------------------------------------------------
*/

async function verifyToken(
  token
) {
  try {
    const {
      payload,
    } = await jwtVerify(
      token,
      JWT_SECRET,
      {
        algorithms: [
          "HS256",
        ],

        issuer:
          "spiderman-test-series",

        audience:
          "spiderman-web",
      }
    );

    if (
      !payload?.sub ||
      !/^\d+$/.test(
        String(
          payload.sub
        )
      )
    ) {
      return null;
    }

    if (
      typeof payload.sessionId !==
        "string" ||
      !payload.sessionId
    ) {
      return null;
    }

    if (
      typeof payload.deviceId !==
        "string" ||
      !payload.deviceId
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| RATE LIMIT CONFIG
|--------------------------------------------------------------------------
*/

const LOGIN_LIMIT =
  10;

const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

const REGISTER_LIMIT =
  5;

const REGISTER_WINDOW_MS =
  60 * 60 * 1000;

/*
|--------------------------------------------------------------------------
| RATE LIMIT RESPONSE
|--------------------------------------------------------------------------
*/

function rateLimitedResponse(
  retryAfterSeconds,
  message
) {
  const response =
    NextResponse.json(
      {
        error:
          message,

        code:
          "RATE_LIMITED",

        retryAfterSeconds,
      },
      {
        status: 429,
      }
    );

  response.headers.set(
    "Retry-After",
    String(
      retryAfterSeconds
    )
  );

  response.headers.set(
    "Cache-Control",
    "no-store"
  );

  return response;
}

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

export async function middleware(
  request
) {
  const {
    pathname,
  } =
    request.nextUrl;

  /*
   * ----------------------------------------------------------
   * AUTH PAGE CHECK
   * ----------------------------------------------------------
   */

  const isAuthPage =
    pathname.startsWith(
      "/auth/login"
    ) ||
    pathname.startsWith(
      "/auth/register"
    );

  /*
   * ----------------------------------------------------------
   * AUTH API CHECK
   * ----------------------------------------------------------
   */

  const isLoginApi =
    pathname ===
    "/api/auth/login";

  const isRegisterApi =
    pathname ===
    "/api/auth/register";

  /*
   * ----------------------------------------------------------
   * LOGIN RATE LIMIT
   * ----------------------------------------------------------
   *
   * Happens before login route reaches Turso.
   */

  if (
    isLoginApi
  ) {
    const ip =
      getClientIp(
        request
      );

    const result =
      rateLimit({
        key:
          `login:${ip}`,

        limit:
          LOGIN_LIMIT,

        windowMs:
          LOGIN_WINDOW_MS,
      });

    if (
      !result.allowed
    ) {
      return rateLimitedResponse(
        result.retryAfterSeconds,
        "Too many login attempts. Please try again later."
      );
    }

    return NextResponse.next();
  }

  /*
   * ----------------------------------------------------------
   * REGISTER RATE LIMIT
   * ----------------------------------------------------------
   */

  if (
    isRegisterApi
  ) {
    const ip =
      getClientIp(
        request
      );

    const result =
      rateLimit({
        key:
          `register:${ip}`,

        limit:
          REGISTER_LIMIT,

        windowMs:
          REGISTER_WINDOW_MS,
      });

    if (
      !result.allowed
    ) {
      return rateLimitedResponse(
        result.retryAfterSeconds,
        "Too many registration attempts. Please try again later."
      );
    }

    return NextResponse.next();
  }

  /*
   * ----------------------------------------------------------
   * AUTH COOKIE
   * ----------------------------------------------------------
   */

  const token =
    request.cookies.get(
      AUTH_COOKIE_NAME
    )?.value;

  /*
   * ----------------------------------------------------------
   * NO TOKEN
   * ----------------------------------------------------------
   */

  if (!token) {
    /*
     * Public auth pages.
     */

    if (
      isAuthPage
    ) {
      return NextResponse.next();
    }

    /*
     * APIs are protected except login/register,
     * which were already handled above.
     */

    if (
      pathname.startsWith(
        "/api/"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Protected page.
     */

    return NextResponse.redirect(
      new URL(
        "/auth/login",
        request.url
      )
    );
  }

  /*
   * ----------------------------------------------------------
   * LOCAL JWT VERIFY
   * ----------------------------------------------------------
   *
   * NO TURSO QUERY.
   */

  const payload =
    await verifyToken(
      token
    );

  /*
   * ----------------------------------------------------------
   * INVALID / EXPIRED TOKEN
   * ----------------------------------------------------------
   */

  if (
    !payload?.sub
  ) {
    const response =
      isAuthPage
        ? NextResponse.next()
        : pathname.startsWith(
              "/api/"
            )
        ? NextResponse.json(
            {
              error:
                "Session expired.",
            },
            {
              status: 401,
            }
          )
        : NextResponse.redirect(
            new URL(
              "/auth/login",
              request.url
            )
          );

    response.cookies.delete(
      AUTH_COOKIE_NAME
    );

    return response;
  }

  /*
   * ----------------------------------------------------------
   * AUTH USER ON LOGIN/REGISTER PAGE
   * ----------------------------------------------------------
   */

  if (
    isAuthPage
  ) {
    return NextResponse.redirect(
      new URL(
        "/",
        request.url
      )
    );
  }

  /*
   * ----------------------------------------------------------
   * ALLOW
   * ----------------------------------------------------------
   */

  return NextResponse.next();
}

/*
|--------------------------------------------------------------------------
| MATCHER
|--------------------------------------------------------------------------
*/

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};