import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { db } from "@/lib/turso";

import {
  createToken,
  setAuthCookie,
  normalizeSeriesAccess,
} from "@/lib/auth";

export async function POST(
  request
) {
  try {
    /*
    |--------------------------------------------------------------------------
    | BODY
    |--------------------------------------------------------------------------
    */

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const identifier =
      String(
        body?.identifier || ""
      )
        .trim()
        .toLowerCase();

    /*
     * Password intentionally remains
     * plain text in the current project.
     *
     * Do NOT trim it.
     */

    const password =
      String(
        body?.password || ""
      );

    const deviceId =
      String(
        body?.deviceId || ""
      ).trim();

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !identifier ||
      !password
    ) {
      return NextResponse.json(
        {
          error:
            "Username/email and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      identifier.length >
      254
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid username/email or password.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      password.length >
      128
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid username/email or password.",
        },
        {
          status: 401,
        }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        {
          error:
            "Device information is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      deviceId.length >
      200
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid device information.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | USER LOOKUP
    |--------------------------------------------------------------------------
    */

    const userResult =
      await db.execute({
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
          WHERE
            username = ?
            OR email = ?
          LIMIT 1
        `,
        args: [
          identifier,
          identifier,
        ],
      });

    if (
      !userResult.rows?.length
    ) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password.",
        },
        {
          status: 401,
        }
      );
    }

    const user =
      userResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    if (
      Number(
        user.is_active
      ) !== 1
    ) {
      return NextResponse.json(
        {
          error:
            "This account has been disabled.",
        },
        {
          status: 403,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | PASSWORD
    |--------------------------------------------------------------------------
    */

    const storedPassword =
      String(
        user.password ?? ""
      );

    if (
      storedPassword !==
      password
    ) {
      return NextResponse.json(
        {
          error:
            "Incorrect username/email or password.",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SERIES ACCESS
    |--------------------------------------------------------------------------
    |
    | This is the ONE access lookup during login.
    |
    | After this:
    | JWT contains the access snapshot.
    |--------------------------------------------------------------------------
    */

    const accessResult =
      await db.execute({
        sql: `
          SELECT
            ts.slug
          FROM user_series_access usa

          INNER JOIN test_series ts
            ON ts.id =
              usa.series_id

          WHERE
            usa.user_id = ?
            AND usa.is_active = 1
            AND ts.is_active = 1

            AND (
              usa.expires_at IS NULL
              OR usa.expires_at >
                CURRENT_TIMESTAMP
            )
        `,
        args: [
          Number(
            user.id
          ),
        ],
      });

    const seriesAccess =
      normalizeSeriesAccess(
        accessResult.rows?.map(
          (row) =>
            String(
              row.slug || ""
            )
              .trim()
              .toLowerCase()
        ) || []
      );

    /*
    |--------------------------------------------------------------------------
    | CREATE NEW SESSION
    |--------------------------------------------------------------------------
    */

    const sessionId =
      randomUUID();

    /*
     * Login invalidates the old session.
     */

    await db.execute({
      sql: `
        UPDATE users
        SET
          active_session_id = ?,
          active_device_id = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        sessionId,
        deviceId,
        Number(
          user.id
        ),
      ],
    });

    /*
    |--------------------------------------------------------------------------
    | CREATE JWT
    |--------------------------------------------------------------------------
    */

    const token =
      await createToken({
        sub:
          String(
            user.id
          ),

        username:
          String(
            user.username
          ),

        role:
          String(
            user.role ||
              "user"
          ),

        sessionId,

        deviceId,

        seriesAccess,
      });

    /*
    |--------------------------------------------------------------------------
    | COOKIE
    |--------------------------------------------------------------------------
    */

    await setAuthCookie(
      token
    );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json(
      {
        success: true,

        user: {
          id: Number(
            user.id
          ),

          username:
            String(
              user.username
            ),

          email:
            String(
              user.email ||
                ""
            ),

          displayName:
            user.display_name ||
            "",

          role:
            String(
              user.role ||
                "user"
            ),
        },

        /*
         * Client can use this for UI/access state.
         *
         * Server authorization still comes from
         * the verified JWT.
         */

        access:
          seriesAccess,
      },
      {
        status: 200,
      }
    );
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
      {
        status: 500,
      }
    );
  }
}