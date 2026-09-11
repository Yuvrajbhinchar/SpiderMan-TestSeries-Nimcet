import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/*
|--------------------------------------------------------------------------
| JWT CONFIG
|--------------------------------------------------------------------------
*/

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

export const AUTH_COOKIE_NAME =
  "spiderman_auth";

const TOKEN_MAX_AGE =
  60 * 60 * 24 * 7;

/*
|--------------------------------------------------------------------------
| PAID SERIES ONLY
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| "free" is NOT stored in JWT.
|
| Free series is globally accessible by rule.
|
*/

const PAID_SERIES = [
  "asspire",
  "imppetus",
  "spiderman",
];

/*
|--------------------------------------------------------------------------
| NORMALIZE SERIES ACCESS
|--------------------------------------------------------------------------
|
| Accepted:
|
| ["asspire", "imppetus"]
|
| or:
|
| {
|   asspire: true,
|   imppetus: true
| }
|
| "free" is deliberately ignored.
|--------------------------------------------------------------------------
*/

export function normalizeSeriesAccess(
  input
) {
  const access = {};

  /*
   * Array form
   */

  if (
    Array.isArray(input)
  ) {
    for (
      const value of input
    ) {
      const slug =
        String(
          value || ""
        )
          .trim()
          .toLowerCase();

      if (
        PAID_SERIES.includes(
          slug
        )
      ) {
        access[slug] = true;
      }
    }
  }

  /*
   * Object form
   */

  else if (
    input &&
    typeof input ===
      "object"
  ) {
    for (
      const slug of PAID_SERIES
    ) {
      if (
        input[slug] ===
          true ||
        input[slug] === 1 ||
        input[slug] ===
          "1"
      ) {
        access[slug] = true;
      }
    }
  }

  return access;
}

/*
|--------------------------------------------------------------------------
| ACCESS OBJECT -> ARRAY
|--------------------------------------------------------------------------
*/

export function accessObjectToArray(
  access
) {
  const normalized =
    normalizeSeriesAccess(
      access
    );

  return Object.entries(
    normalized
  )
    .filter(
      ([, value]) =>
        value === true
    )
    .map(
      ([slug]) =>
        slug
    );
}

/*
|--------------------------------------------------------------------------
| CREATE TOKEN
|--------------------------------------------------------------------------
*/

export async function createToken(
  payload
) {
  const sub =
    String(
      payload?.sub ?? ""
    ).trim();

  if (
    !/^\d+$/.test(sub)
  ) {
    throw new Error(
      "Invalid token subject."
    );
  }

  const username =
    String(
      payload?.username ??
        ""
    ).trim();

  const role =
    payload?.role ===
    "admin"
      ? "admin"
      : "user";

  const sessionId =
    String(
      payload?.sessionId ??
        ""
    ).trim();

  const deviceId =
    String(
      payload?.deviceId ??
        ""
    ).trim();

  if (!sessionId) {
    throw new Error(
      "Invalid session id."
    );
  }

  if (!deviceId) {
    throw new Error(
      "Invalid device id."
    );
  }

  /*
   * Only paid series go into JWT.
   */

  const seriesAccess =
    normalizeSeriesAccess(
      payload?.seriesAccess
    );

  return await new SignJWT({
    sub,

    username:
      username.slice(
        0,
        100
      ),

    role,

    sessionId:
      sessionId.slice(
        0,
        200
      ),

    deviceId:
      deviceId.slice(
        0,
        200
      ),

    /*
     * Example:
     *
     * ["asspire", "imppetus"]
     *
     * Free is never stored.
     */

    seriesAccess:
      accessObjectToArray(
        seriesAccess
      ),
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })

    .setIssuer(
      "spiderman-test-series"
    )

    .setAudience(
      "spiderman-web"
    )

    .setIssuedAt()

    .setExpirationTime(
      "7d"
    )

    .sign(
      JWT_SECRET
    );
}

/*
|--------------------------------------------------------------------------
| VERIFY TOKEN
|--------------------------------------------------------------------------
*/

export async function verifyToken(
  token
) {
  if (
    typeof token !==
      "string" ||
    !token ||
    token.length < 20 ||
    token.length > 10000
  ) {
    return null;
  }

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

    /*
     * User ID
     */

    if (
      typeof payload.sub !==
        "string" ||
      !/^\d+$/.test(
        payload.sub
      )
    ) {
      return null;
    }

    /*
     * Session
     */

    if (
      typeof payload.sessionId !==
        "string" ||
      !payload.sessionId
    ) {
      return null;
    }

    /*
     * Device
     */

    if (
      typeof payload.deviceId !==
        "string" ||
      !payload.deviceId
    ) {
      return null;
    }

    /*
     * Role
     */

    if (
      payload.role !==
        "user" &&
      payload.role !==
        "admin"
    ) {
      return null;
    }

    /*
     * Normalize series access.
     *
     * This also strips "free" from old JWTs
     * if one somehow contains it.
     */

    payload.seriesAccess =
      accessObjectToArray(
        payload.seriesAccess
      );

    return payload;
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| SET AUTH COOKIE
|--------------------------------------------------------------------------
*/

export async function setAuthCookie(
  token
) {
  if (
    typeof token !==
      "string" ||
    token.length < 20
  ) {
    throw new Error(
      "Invalid authentication token."
    );
  }

  const cookieStore =
    await cookies();

  cookieStore.set(
    AUTH_COOKIE_NAME,
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path: "/",

      maxAge:
        TOKEN_MAX_AGE,

      priority:
        "high",
    }
  );
}

/*
|--------------------------------------------------------------------------
| CLEAR AUTH COOKIE
|--------------------------------------------------------------------------
*/

export async function clearAuthCookie() {
  const cookieStore =
    await cookies();

  cookieStore.set(
    AUTH_COOKIE_NAME,
    "",
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path: "/",

      maxAge: 0,

      priority:
        "high",
    }
  );
}

/*
|--------------------------------------------------------------------------
| GET AUTH TOKEN
|--------------------------------------------------------------------------
*/

export async function getAuthToken() {
  const cookieStore =
    await cookies();

  return (
    cookieStore.get(
      AUTH_COOKIE_NAME
    )?.value ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| GET CURRENT USER
|--------------------------------------------------------------------------
*/

export async function getCurrentUser() {
  const token =
    await getAuthToken();

  if (!token) {
    return null;
  }

  const payload =
    await verifyToken(
      token
    );

  if (
    !payload?.sub
  ) {
    return null;
  }

  const seriesAccess =
    normalizeSeriesAccess(
      payload.seriesAccess
    );

  return {
    id: Number(
      payload.sub
    ),

    username:
      payload.username
        ? String(
            payload.username
          )
        : null,

    role:
      payload.role ===
      "admin"
        ? "admin"
        : "user",

    sessionId:
      payload.sessionId
        ? String(
            payload.sessionId
          )
        : null,

    deviceId:
      payload.deviceId
        ? String(
            payload.deviceId
          )
        : null,

    /*
     * Paid series only.
     */

    seriesAccess,

    seriesAccessList:
      accessObjectToArray(
        seriesAccess
      ),
  };
}