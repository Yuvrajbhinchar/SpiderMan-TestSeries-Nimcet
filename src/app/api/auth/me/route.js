import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import {
  getCurrentUser,
  clearAuthCookie,
} from "@/lib/auth";

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          access: {},
        },
        { status: 401 }
      );
    }

    const userResult = await db.execute({
      sql: `
        SELECT
          id,
          username,
          display_name,
          role,
          is_active,
          active_session_id,
          active_device_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      args: [authUser.id],
    });

    if (userResult.rows.length === 0) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          access: {},
        },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    /*
     * One-device validation.
     */
    if (
      !Number(user.is_active) ||
      user.active_session_id !==
        authUser.sessionId ||
      user.active_device_id !==
        authUser.deviceId
    ) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          access: {},
          reason: "session_invalid",
        },
        { status: 401 }
      );
    }

    /*
     * Fetch series access once during bootstrap.
     */
    const accessResult = await db.execute({
      sql: `
        SELECT
          usa.series_id,
          ts.slug,
          usa.expires_at,
          usa.is_active
        FROM user_series_access usa
        INNER JOIN test_series ts
          ON ts.id = usa.series_id
        WHERE usa.user_id = ?
          AND usa.is_active = 1
          AND (
            usa.expires_at IS NULL
            OR usa.expires_at > CURRENT_TIMESTAMP
          )
          AND ts.is_active = 1
      `,
      args: [authUser.id],
    });

    const access = {
      free: false,
      asspire: false,
      imppetus: false,
      spiderman: false,
    };

    for (const row of accessResult.rows) {
      if (row.slug in access) {
        access[row.slug] = true;
      }
    }

    /*
     * Free series is public.
     */
    access.free = true;

    return NextResponse.json({
      authenticated: true,

      user: {
        id: Number(user.id),
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },

      access,
    });
  } catch (error) {
    console.error(
      "Auth me API error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to verify account.",
      },
      { status: 500 }
    );
  }
}