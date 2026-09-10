import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { db } from "@/lib/turso";
import {
  createToken,
  setAuthCookie,
} from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();

    const identifier = String(
      body.identifier || ""
    )
      .trim()
      .toLowerCase();

    /*
     * Password ko trim mat karna.
     */
    const password = String(
      body.password || ""
    );

    const deviceId = String(
      body.deviceId || ""
    ).trim();

    if (!identifier || !password) {
      return NextResponse.json(
        {
          error:
            "Username/email and password are required.",
        },
        { status: 400 }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        {
          error:
            "Device information is missing.",
        },
        { status: 400 }
      );
    }

    /*
     * Login using either username OR email.
     */
    const result = await db.execute({
      sql: `
        SELECT
          id,
          username,
          email,
          password,
          display_name,
          role,
          is_active
        FROM users
        WHERE username = ?
           OR email = ?
        LIMIT 1
      `,
      args: [identifier, identifier],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password.",
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    if (!Number(user.is_active)) {
      return NextResponse.json(
        {
          error:
            "This account has been disabled.",
        },
        { status: 403 }
      );
    }

    /*
     * Normalize DB value to string before comparison.
     *
     * We intentionally do exact comparison because
     * password spaces must remain meaningful.
     */
    const storedPassword = String(
      user.password ?? ""
    );

    const suppliedPassword = String(
      password
    );

    if (storedPassword !== suppliedPassword) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password.",
        },
        { status: 401 }
      );
    }

    /*
     * New login invalidates previous active session.
     */
    const sessionId = randomUUID();

    await db.execute({
      sql: `
        UPDATE users
        SET
          active_session_id = ?,
          active_device_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        sessionId,
        deviceId,
        Number(user.id),
      ],
    });

    /*
     * Create JWT.
     */
    const token = await createToken({
      sub: String(user.id),
      username: String(user.username),
      role: String(user.role || "user"),
      sessionId,
      deviceId,
    });

    /*
     * Store JWT in HttpOnly cookie.
     */
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,

      user: {
        id: Number(user.id),
        username: String(user.username),
        email: String(user.email || ""),
        displayName:
          user.display_name || "",
        role: String(
          user.role || "user"
        ),
      },
    });
  } catch (error) {
    console.error(
      "Login API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to sign in. Please try again.",
      },
      { status: 500 }
    );
  }
}