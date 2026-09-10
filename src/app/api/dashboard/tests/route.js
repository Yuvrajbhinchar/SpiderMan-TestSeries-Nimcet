import { NextResponse } from "next/server";
import { db } from "@/lib/turso";
import {
  getCurrentUser,
  clearAuthCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/*
|--------------------------------------------------------------------------
| SERIES CONFIG
|--------------------------------------------------------------------------
*/

const SERIES_CONFIG = {
  free: {
    id: 1,
    name: "Free",
    testsTable: "free_tests",
    subjectsTable: "free_test_subjects",
    attemptsTable: "free_test_attempts",
  },

  asspire: {
    id: 2,
    name: "Asspire",
    testsTable: "asspire_tests",
    subjectsTable: "asspire_test_subjects",
    attemptsTable: "asspire_test_attempts",
  },

  imppetus: {
    id: 3,
    name: "Imppetus",
    testsTable: "imppetus_tests",
    subjectsTable: "imppetus_test_subjects",
    attemptsTable: "imppetus_test_attempts",
  },

  spiderman: {
    id: 4,
    name: "SpiderMan",
    testsTable: "spiderman_tests",
    subjectsTable: "spiderman_test_subjects",
    attemptsTable: "spiderman_test_attempts",
  },
};

/*
|--------------------------------------------------------------------------
| ALLOWED MODES
|--------------------------------------------------------------------------
*/

const ALLOWED_MODES = new Set([
  "dpp",
  "mini",
  "mock",
  "live",
]);

/*
|--------------------------------------------------------------------------
| FIXED SUBJECTS
|--------------------------------------------------------------------------
*/

const SUBJECT_IDS = {
  maths: 1,
  reasoning: 2,
  cs: 3,
  english: 4,
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getLimit(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 12;
  }

  return Math.min(
    Math.max(Math.floor(number), 1),
    30
  );
}

function getSubjectFilter({
  subject,
  subjectsTable,
}) {
  if (!subject) {
    return {
      sql: "",
      args: [],
    };
  }

  const subjectId =
    SUBJECT_IDS[subject];

  if (!subjectId) {
    return {
      sql: "AND 1 = 0",
      args: [],
    };
  }

  return {
    sql: `
      AND EXISTS (
        SELECT 1
        FROM ${subjectsTable} tst_filter
        WHERE tst_filter.test_id = t.id
          AND tst_filter.subject_id = ?
      )
    `,
    args: [subjectId],
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/dashboard/tests
|--------------------------------------------------------------------------
*/

export async function GET(request) {
  try {
    /*
    |--------------------------------------------------------------------------
    | AUTH
    |--------------------------------------------------------------------------
    */

    const currentUser =
      await getCurrentUser();

    if (!currentUser?.id) {
      return NextResponse.json(
        {
          authenticated: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | QUERY PARAMS
    |--------------------------------------------------------------------------
    */

    const { searchParams } =
      new URL(request.url);

    const series = normalize(
      searchParams.get("series") ||
        "free"
    );

    const mode = normalize(
      searchParams.get("mode") ||
        "dpp"
    );

    const subject = normalize(
      searchParams.get("subject") || ""
    );

    const cursor =
      searchParams.get("cursor");

    const limit = getLimit(
      searchParams.get("limit")
    );

    /*
    |--------------------------------------------------------------------------
    | VALIDATE SERIES
    |--------------------------------------------------------------------------
    */

    const seriesConfig =
      SERIES_CONFIG[series];

    if (!seriesConfig) {
      return NextResponse.json(
        {
          error:
            "Invalid series.",
        },
        { status: 400 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE MODE
    |--------------------------------------------------------------------------
    */

    if (!ALLOWED_MODES.has(mode)) {
      return NextResponse.json(
        {
          error:
            "Invalid test mode.",
        },
        { status: 400 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SESSION VALIDATION
    |
    | Middleware validates JWT signature.
    | Here we verify current session/device.
    |--------------------------------------------------------------------------
    */

    const userResult =
      await db.execute({
        sql: `
          SELECT
            id,
            username,
            email,
            display_name,
            role,
            is_active,
            active_session_id,
            active_device_id
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        args: [currentUser.id],
      });

    if (!userResult.rows.length) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated: false,
          error:
            "User account not found.",
        },
        { status: 401 }
      );
    }

    const user =
      userResult.rows[0];

    const sessionMatches =
      String(
        user.active_session_id || ""
      ) ===
      String(
        currentUser.sessionId || ""
      );

    const deviceMatches =
      String(
        user.active_device_id || ""
      ) ===
      String(
        currentUser.deviceId || ""
      );

    if (
      Number(user.is_active) !== 1 ||
      !sessionMatches ||
      !deviceMatches
    ) {
      await clearAuthCookie();

      return NextResponse.json(
        {
          authenticated: false,
          error:
            "Session is no longer active.",
        },
        { status: 401 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SERIES ACCESS
    |--------------------------------------------------------------------------
    |
    | Free = always accessible
    | Paid = active access + not expired
    |--------------------------------------------------------------------------
    */

    let hasAccess =
      series === "free";

    if (!hasAccess) {
      const accessResult =
        await db.execute({
          sql: `
            SELECT 1
            FROM user_series_access
            WHERE user_id = ?
              AND series_id = ?
              AND is_active = 1
              AND (
                expires_at IS NULL
                OR datetime(expires_at)
                  > CURRENT_TIMESTAMP
              )
            LIMIT 1
          `,
          args: [
            currentUser.id,
            seriesConfig.id,
          ],
        });

      hasAccess =
        accessResult.rows.length > 0;
    }

    /*
    |--------------------------------------------------------------------------
    | NO ACCESS
    |--------------------------------------------------------------------------
    */

    if (!hasAccess) {
      return NextResponse.json({
        success: true,

        series: {
          id: seriesConfig.id,
          slug: series,
          name: seriesConfig.name,
        },

        mode,

        subject:
          mode === "dpp"
            ? subject || null
            : null,

        hasAccess: false,

        tests: [],

        nextCursor: null,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | SUBJECT FILTER
    |--------------------------------------------------------------------------
    |
    | Subject filter is used ONLY for DPP.
    | No "all" subject.
    |--------------------------------------------------------------------------
    */

    const subjectFilter =
      mode === "dpp"
        ? getSubjectFilter({
            subject,
            subjectsTable:
              seriesConfig.subjectsTable,
          })
        : {
            sql: "",
            args: [],
          };

    /*
    |--------------------------------------------------------------------------
    | CURSOR FILTER
    |--------------------------------------------------------------------------
    */

    let cursorSql = "";
    let cursorArgs = [];

    if (cursor) {
      const cursorId =
        Number(cursor);

      if (
        Number.isInteger(cursorId) &&
        cursorId > 0
      ) {
        cursorSql = `
          AND t.id < ?
        `;

        cursorArgs = [cursorId];
      }
    }

    /*
    |--------------------------------------------------------------------------
    | TEST QUERY
    |--------------------------------------------------------------------------
    |
    | Dashboard receives:
    | - test metadata
    | - category
    | - subjects
    | - attempts
    | - in-progress attempt
    |
    | Dashboard DOES NOT receive:
    | - questions
    | - options
    | - correct answers
    | - explanations
    |--------------------------------------------------------------------------
    */

    const result =
      await db.execute({
        sql: `
          SELECT
            t.id,
            t.title,
            t.slug,
            t.description,
            t.duration_minutes,
            t.total_questions,
            t.total_marks,
            t.is_published,
            t.created_at,

            c.id AS category_id,
            c.name AS category_name,
            c.slug AS category_slug,

            /*
            --------------------------------------------------------------
            | SUBJECTS
            --------------------------------------------------------------
            */

            (
              SELECT GROUP_CONCAT(
                DISTINCT s.name
              )
              FROM ${seriesConfig.subjectsTable} tst_subject
              INNER JOIN subjects s
                ON s.id =
                  tst_subject.subject_id
              WHERE
                tst_subject.test_id = t.id
            ) AS subjects_csv,

            /*
            --------------------------------------------------------------
            | COMPLETED ATTEMPTS
            --------------------------------------------------------------
            */

            (
              SELECT COUNT(*)
              FROM ${seriesConfig.attemptsTable} ta
              WHERE ta.user_id = ?
                AND ta.test_id = t.id
                AND ta.status = 'submitted'
            ) AS attempts_used,

            /*
            --------------------------------------------------------------
            | IN-PROGRESS ATTEMPT ID
            --------------------------------------------------------------
            */

            (
              SELECT ta2.id
              FROM ${seriesConfig.attemptsTable} ta2
              WHERE ta2.user_id = ?
                AND ta2.test_id = t.id
                AND ta2.status = 'in_progress'
              ORDER BY ta2.id DESC
              LIMIT 1
            ) AS in_progress_attempt_id,

            /*
            --------------------------------------------------------------
            | IN-PROGRESS ATTEMPT NUMBER
            --------------------------------------------------------------
            */

            (
              SELECT ta3.attempt_number
              FROM ${seriesConfig.attemptsTable} ta3
              WHERE ta3.user_id = ?
                AND ta3.test_id = t.id
                AND ta3.status = 'in_progress'
              ORDER BY ta3.id DESC
              LIMIT 1
            ) AS in_progress_attempt_number

          FROM ${seriesConfig.testsTable} t

          INNER JOIN test_categories c
            ON c.id = t.category_id

          WHERE
            t.is_published = 1

            AND LOWER(c.slug) = ?

            ${subjectFilter.sql}

            ${cursorSql}

          ORDER BY
            t.id DESC

          LIMIT ${limit}
        `,
        args: [
          currentUser.id,
          currentUser.id,
          currentUser.id,

          mode,

          ...subjectFilter.args,
          ...cursorArgs,
        ],
      });

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE TESTS
    |--------------------------------------------------------------------------
    */

    const tests =
      result.rows.map((row) => {
        const attemptsUsed =
          Number(
            row.attempts_used || 0
          );

        const inProgressAttemptId =
          row.in_progress_attempt_id
            ? Number(
                row.in_progress_attempt_id
              )
            : null;

        const inProgressAttemptNumber =
          row.in_progress_attempt_number
            ? Number(
                row.in_progress_attempt_number
              )
            : null;

        const subjects =
          row.subjects_csv
            ? String(
                row.subjects_csv
              )
                .split(",")
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [];

        return {
          id: Number(row.id),

          title:
            row.title || "Untitled Test",

          slug:
            row.slug || null,

          description:
            row.description ||
            null,

          durationMinutes:
            Number(
              row.duration_minutes || 0
            ),

          totalQuestions:
            Number(
              row.total_questions || 0
            ),

          totalMarks:
            Number(
              row.total_marks || 0
            ),

          subjects,

          category: {
            id: Number(
              row.category_id
            ),

            name:
              row.category_name,

            slug:
              row.category_slug,
          },

          attemptsUsed,

          attemptsRemaining:
            Math.max(
              3 - attemptsUsed,
              0
            ),

          hasInProgress:
            Boolean(
              inProgressAttemptId
            ),

          inProgressAttemptId,

          inProgressAttemptNumber,

          attemptsExhausted:
            attemptsUsed >= 3 &&
            !inProgressAttemptId,
        };
      });

    /*
    |--------------------------------------------------------------------------
    | NEXT CURSOR
    |--------------------------------------------------------------------------
    */

    const lastTest =
      tests[tests.length - 1];

    const nextCursor =
      tests.length === limit &&
      lastTest?.id
        ? String(lastTest.id)
        : null;

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,

      series: {
        id: seriesConfig.id,
        slug: series,
        name: seriesConfig.name,
      },

      mode,

      subject:
        mode === "dpp"
          ? subject || null
          : null,

      hasAccess: true,

      tests,

      nextCursor,
    });
  } catch (error) {
    console.error(
      "Dashboard tests API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load tests right now.",
      },
      { status: 500 }
    );
  }
}