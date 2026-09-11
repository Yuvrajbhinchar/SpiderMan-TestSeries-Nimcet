import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  getCurrentUser,
  clearAuthCookie,
} from "@/lib/auth";

export async function GET() {
  try {
    /*
    |--------------------------------------------------------------------------
    | JWT
    |--------------------------------------------------------------------------
    */

    const authUser =
      await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        {
          authenticated:
            false,

          user: null,

          access: {},
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | USER + SESSION
    |--------------------------------------------------------------------------
    |
    | ONE DB query.
    |
    | We do NOT query user_series_access here.
    |--------------------------------------------------------------------------
    */

    const userResult =
      await db.execute({
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
          WHERE
            id = ?
          LIMIT 1
        `,

        args: [
          authUser.id,
        ],
      });

    const user =
      userResult.rows?.[0];

    if (!user) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated:
            false,

          user: null,

          access: {},
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ACCOUNT
    |--------------------------------------------------------------------------
    */

    if (
      Number(
        user.is_active
      ) !== 1
    ) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated:
            false,

          user: null,

          access: {},

          reason:
            "account_inactive",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SESSION
    |--------------------------------------------------------------------------
    */

    if (
      String(
        user.active_session_id ||
          ""
      ) !==
        String(
          authUser.sessionId ||
            ""
        )
    ) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated:
            false,

          user: null,

          access: {},

          reason:
            "session_invalid",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DEVICE
    |--------------------------------------------------------------------------
    */

    if (
      String(
        user.active_device_id ||
          ""
      ) !==
        String(
          authUser.deviceId ||
            ""
        )
    ) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated:
            false,

          user: null,

          access: {},

          reason:
            "session_invalid",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ACCESS
    |--------------------------------------------------------------------------
    |
    | ONLY PAID SERIES.
    |
    | Free is intentionally absent because free is public
    | to every authenticated user.
    |--------------------------------------------------------------------------
    */

    const access =
      authUser.seriesAccess ||
      {};

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json(
      {
        authenticated:
          true,

        user: {
          id: Number(
            user.id
          ),

          username:
            String(
              user.username
            ),

          displayName:
            user.display_name ||
            null,

          role:
            String(
              user.role ||
                "user"
            ),
        },

        access,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Auth me API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to verify account.",
      },
      {
        status: 500,
      }
    );
  }
}