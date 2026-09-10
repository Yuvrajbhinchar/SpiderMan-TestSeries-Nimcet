import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

/* =========================================================
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG = [
  {
    slug: "free",
    name: "Free",
    seriesId: 1,
    testTable: "free_tests",
    attemptTable: "free_test_attempts",
  },
  {
    slug: "asspire",
    name: "Asspire",
    seriesId: 2,
    testTable: "asspire_tests",
    attemptTable: "asspire_test_attempts",
  },
  {
    slug: "imppetus",
    name: "Imppetus",
    seriesId: 3,
    testTable: "imppetus_tests",
    attemptTable: "imppetus_test_attempts",
  },
  {
    slug: "spiderman",
    name: "SpiderMan",
    seriesId: 4,
    testTable: "spiderman_tests",
    attemptTable: "spiderman_test_attempts",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function toIsoUtc(value) {
  if (!value) {
    return null;
  }

  const text = String(value);

  /*
   * Turso / SQLite:
   * YYYY-MM-DD HH:mm:ss
   */
  if (
    text.length === 19 &&
    text[4] === "-" &&
    text[7] === "-" &&
    text[10] === " " &&
    text[13] === ":" &&
    text[16] === ":"
  ) {
    return `${text.replace(
      " ",
      "T"
    )}Z`;
  }

  const date = new Date(text);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function jsonError(
  message,
  status = 400,
  code = null
) {
  return NextResponse.json(
    {
      error: message,
      ...(code
        ? { code }
        : {}),
    },
    {
      status,
    }
  );
}

/* =========================================================
   AUTH
========================================================= */

async function getAuthenticatedUser() {
  const currentUser =
    await getCurrentUser();

  if (!currentUser?.id) {
    return {
      ok: false,
      response: jsonError(
        "Please login to continue.",
        401,
        "UNAUTHORIZED"
      ),
    };
  }

  const userId =
    Number(
      currentUser.id
    );

  if (
    !Number.isInteger(
      userId
    ) ||
    userId <= 0
  ) {
    return {
      ok: false,
      response: jsonError(
        "Invalid user session.",
        401,
        "INVALID_SESSION"
      ),
    };
  }

  const userResult =
    await db.execute({
      sql: `
        SELECT
          id,
          username,
          role,
          is_active,
          active_session_id,
          active_device_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      args: [userId],
    });

  const user =
    userResult.rows?.[0];

  if (!user) {
    return {
      ok: false,
      response: jsonError(
        "User account not found.",
        401,
        "USER_NOT_FOUND"
      ),
    };
  }

  if (
    Number(
      user.is_active
    ) !== 1
  ) {
    return {
      ok: false,
      response: jsonError(
        "Your account is inactive.",
        403,
        "ACCOUNT_INACTIVE"
      ),
    };
  }

  const jwtSessionId =
    currentUser.sessionId ??
    currentUser.session_id ??
    null;

  const jwtDeviceId =
    currentUser.deviceId ??
    currentUser.device_id ??
    null;

  if (
    jwtSessionId &&
    user.active_session_id &&
    String(
      jwtSessionId
    ) !==
      String(
        user.active_session_id
      )
  ) {
    return {
      ok: false,
      response: jsonError(
        "Your session is no longer active.",
        401,
        "SESSION_REVOKED"
      ),
    };
  }

  if (
    jwtDeviceId &&
    user.active_device_id &&
    String(
      jwtDeviceId
    ) !==
      String(
        user.active_device_id
      )
  ) {
    return {
      ok: false,
      response: jsonError(
        "This device is no longer active.",
        401,
        "DEVICE_REVOKED"
      ),
    };
  }

  return {
    ok: true,
    userId,
  };
}

/* =========================================================
   GET
   /api/dashboard/history
========================================================= */

export async function GET(
  request
) {
  try {
    /* -------------------------------------------------------
       AUTH
    ------------------------------------------------------- */

    const auth =
      await getAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
    } = auth;

    /* -------------------------------------------------------
       LIMIT

       History page is intentionally lightweight.
    ------------------------------------------------------- */

    const { searchParams } =
      new URL(
        request.url
      );

    let limit =
      Number(
        searchParams.get(
          "limit"
        ) || 50
      );

    if (
      !Number.isInteger(
        limit
      ) ||
      limit <= 0
    ) {
      limit = 50;
    }

    limit =
      Math.min(
        limit,
        100
      );

    /* -------------------------------------------------------
       BUILD UNION

       We only return completed attempts.
       No in-progress / abandoned attempts.
    ------------------------------------------------------- */

    const unionParts =
      SERIES_CONFIG.map(
        (series) => `
          SELECT
            ta.id AS attempt_id,

            ta.user_id,

            ta.test_id,

            ta.attempt_number,

            ta.status,

            ta.score,

            ta.total_marks,

            ta.time_taken_seconds,

            ta.submitted_at,

            ta.created_at,

            t.title AS test_title,

            t.slug AS test_slug,

            ${series.seriesId} AS series_id,

            '${series.slug}' AS series_slug,

            '${series.name}' AS series_name

          FROM ${series.attemptTable} ta

          INNER JOIN ${series.testTable} t
            ON t.id = ta.test_id

          WHERE
            ta.user_id = ?
            AND ta.status IN (
              'submitted',
              'auto_submitted'
            )
        `
      );

    const args = [];

    for (
      let index = 0;
      index < SERIES_CONFIG.length;
      index += 1
    ) {
      args.push(
        userId
      );
    }

    const historyResult =
      await db.execute({
        sql: `
          SELECT *
          FROM (
            ${unionParts.join(
              "\nUNION ALL\n"
            )}
          ) history

          ORDER BY
            COALESCE(
              history.submitted_at,
              history.created_at
            ) DESC,
            history.attempt_id DESC

          LIMIT ?
        `,
        args: [
          ...args,
          limit,
        ],
      });

    /* -------------------------------------------------------
       NORMALIZE
    ------------------------------------------------------- */

    const history =
      (
        historyResult.rows ||
        []
      ).map(
        (row) => ({
          attemptId:
            Number(
              row.attempt_id
            ),

          testId:
            Number(
              row.test_id
            ),

          attemptNumber:
            Number(
              row.attempt_number ||
                1
            ),

          status:
            String(
              row.status ||
                "submitted"
            ),

          score:
            toNumber(
              row.score,
              0
            ),

          totalMarks:
            toNumber(
              row.total_marks,
              0
            ),

          timeTakenSeconds:
            toNumber(
              row.time_taken_seconds,
              0
            ),

          submittedAt:
            toIsoUtc(
              row.submitted_at
            ),

          createdAt:
            toIsoUtc(
              row.created_at
            ),

          test: {
            id:
              Number(
                row.test_id
              ),

            title:
              row.test_title ||
              "Test",

            slug:
              row.test_slug ||
              null,
          },

          series: {
            id:
              Number(
                row.series_id
              ),

            slug:
              row.series_slug ||
              "",

            name:
              row.series_name ||
              "Test Series",
          },
        })
      );

    return NextResponse.json(
      {
        success: true,
        history,
        count:
          history.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          Pragma:
            "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET /api/dashboard/history] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load test history.",
      },
      {
        status: 500,
      }
    );
  }
}