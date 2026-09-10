import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET_VALUE = process.env.JWT_SECRET;

if (!JWT_SECRET_VALUE) {
  throw new Error("Missing JWT_SECRET in .env.local");
}

const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_VALUE);

export const AUTH_COOKIE_NAME = "spiderman_auth";

const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export async function createToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token) {
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

export async function setAuthCookie(token) {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthToken() {
  const cookieStore = await cookies();

  return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
}

export async function getCurrentUser() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload?.sub) {
    return null;
  }

  return {
    id: Number(payload.sub),
    username: payload.username || null,
    role: payload.role || "user",
    sessionId: payload.sessionId || null,
    deviceId: payload.deviceId || null,
  };
}