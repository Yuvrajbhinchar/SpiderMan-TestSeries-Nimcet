import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  firstDefined,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getSeriesState,
} from "@/lib/testSecurity";

export const dynamic =
  "force-dynamic";

/* =========================================================
   ALLOWED MODES
========================================================= */

const ALLOWED_MODES =
  new Set([
    "dpp",
    "mini",
    "mock",
    "live",
  ]);

/* =========================================================
   SUBJECT SLUG PATTERN

   The filter joins subjects.slug instead of a hardcoded id
   map, so re-seeding the subjects table (or adding a fifth
   subject later) can never silently break the DPP tabs.

   The pattern is only here to keep junk out of the query.
========================================================= */

const SUBJECT_SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* =========================================================
   HELPERS
========================================================= */

function normalize(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function getLimit(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 12;
  }

  return Math.min(
    Math.max(
      Math.floor(
        number
      ),
      1
    ),
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

  if (
    !SUBJECT_SLUG_PATTERN.test(
      subject
    )
  ) {
    return {
      sql:
        "AND 1 = 0",

      args: [],
    };
  }

  return {
    sql: `
      AND EXISTS (
        SELECT 1
        FROM ${subjectsTable} tst_filter

        INNER JOIN subjects s_filter
          ON s_filter.id =
            tst_filter.subject_id

        WHERE
          tst_filter.test_id = t.id
          AND LOWER(s_filter.slug) = ?
      )
    `,

    args: [
      subject,
    ],
  };
}

/* =========================================================
   GET /api/dashboard/tests
========================================================= */

export async function GET(
  request
) {
  try {
    /* -------------------------------------------------------
       AUTH
       
       Centralized:
       - JWT
       - user
       - account active
       - session
       - device
    ------------------------------------------------------- */

    const auth =
      await requireAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
      currentUser,
    } = auth;

    /* -------------------------------------------------------
       QUERY PARAMS
    ------------------------------------------------------- */

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const series =
      normalizeSeries(
        searchParams.get(
          "series"
        ) ||
          "free"
      );

    const mode =
      normalize(
        searchParams.get(
          "mode"
        ) ||
          "dpp"
      );

    const subject =
      normalize(
        searchParams.get(
          "subject"
        ) ||
          ""
      );

    const cursor =
      searchParams.get(
        "cursor"
      );

    const limit =
      getLimit(
        searchParams.get(
          "limit"
        )
      );

    /* -------------------------------------------------------
       SERIES CONFIG
    ------------------------------------------------------- */

    const seriesConfig =
      SERIES_CONFIG[
        series
      ];

    if (!seriesConfig) {
      return NextResponse.json(
        {
          error:
            "Invalid series.",
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       MODE
    ------------------------------------------------------- */

    if (
      !ALLOWED_MODES.has(
        mode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid test mode.",
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       SERIES ACCESS
       
       IMPORTANT:
       
       Free:
         always accessible from entitlement perspective.
       
       Paid:
         JWT snapshot only.
       
       No user_series_access query here.
    ------------------------------------------------------- */

    const access =
      requireSeriesAccess(
        currentUser,
        series
      );

    if (!access.ok) {
      return access.response;
    }

    /* -------------------------------------------------------
       SERIES ACTIVE STATE
       
       This is an actual server-side availability control,
       so we check test_series.is_active.
    ------------------------------------------------------- */

    const seriesState =
      await getSeriesState(
        seriesConfig.seriesId
      );

    if (!seriesState.ok) {
      return seriesState.response;
    }

    /* -------------------------------------------------------
       INACTIVE SERIES
       
       User is authenticated and may technically have
       entitlement, but there are no currently available
       tests in this inactive series.
    ------------------------------------------------------- */

    if (
      !seriesState.active
    ) {
      return NextResponse.json(
        {
          success: true,

          series: {
            id:
              seriesConfig.seriesId,

            slug:
              series,

            name:
              seriesConfig.name,
          },

          mode,

          subject:
            mode === "dpp"
              ? subject ||
                null
              : null,

          hasAccess: true,

          seriesActive: false,

          tests: [],

          nextCursor:
            null,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",

            Pragma:
              "no-cache",

            Expires:
              "0",
          },
        }
      );
    }

    /* -------------------------------------------------------
       SUBJECT FILTER
       
       Subject filter is used ONLY for DPP.
    ------------------------------------------------------- */

    const subjectFilter =
      mode === "dpp"
        ? getSubjectFilter({
            subject,
            subjectsTable:
              seriesConfig.testSubjectTable,
          })
        : {
            sql: "",
            args: [],
          };

    /* -------------------------------------------------------
       CURSOR
    ------------------------------------------------------- */

    let cursorSql =
      "";

    let cursorArgs =
      [];

    if (cursor) {
      const cursorId =
        Number(cursor);

      if (
        Number.isInteger(
          cursorId
        ) &&
        cursorId > 0
      ) {
        cursorSql = `
          AND t.id < ?
        `;

        cursorArgs = [
          cursorId,
        ];
      }
    }

    /* -------------------------------------------------------
       STEP 1
       
       Fetch only this page of tests.
       
       PHASE 5 AVAILABILITY:
       
       series.is_active = 1
       category.is_active = 1
       test.is_published = 1
    ------------------------------------------------------- */

    const testResult =
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

            c.slug AS category_slug

          FROM ${seriesConfig.testTable} t

          INNER JOIN test_categories c
            ON c.id =
              t.category_id

          INNER JOIN test_series ts
            ON ts.id = ?

          WHERE
            ts.is_active = 1

            AND c.is_active = 1

            AND t.is_published = 1

            AND LOWER(c.slug) = ?

            ${subjectFilter.sql}

            ${cursorSql}

          ORDER BY
            t.id DESC

          LIMIT ${limit}
        `,

        args: [
          seriesConfig.seriesId,

          mode,

          ...subjectFilter.args,

          ...cursorArgs,
        ],
      });

    const testRows =
      Array.isArray(
        testResult.rows
      )
        ? testResult.rows
        : [];

    /* -------------------------------------------------------
       EMPTY PAGE
    ------------------------------------------------------- */

    if (
      testRows.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: true,

          series: {
            id:
              seriesConfig.seriesId,

            slug:
              series,

            name:
              seriesConfig.name,
          },

          mode,

          subject:
            mode === "dpp"
              ? subject ||
                null
              : null,

          hasAccess: true,

          seriesActive: true,

          tests: [],

          nextCursor:
            null,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",

            Pragma:
              "no-cache",

            Expires:
              "0",
          },
        }
      );
    }

    /* -------------------------------------------------------
       TEST IDS
    ------------------------------------------------------- */

    const testIds =
      testRows
        .map(
          (row) =>
            Number(
              row.id
            )
        )
        .filter(
          (id) =>
            Number.isInteger(
              id
            ) &&
            id > 0
        );

    const placeholders =
      testIds
        .map(
          () => "?"
        )
        .join(",");

    /* -------------------------------------------------------
       STEP 2
       
       SUBJECTS FOR CURRENT PAGE
    ------------------------------------------------------- */

    const subjectsResult =
      await db.execute({
        sql: `
          SELECT
            tst_subject.test_id,

            GROUP_CONCAT(
              DISTINCT s.name
            ) AS subjects_csv

          FROM ${seriesConfig.testSubjectTable} tst_subject

          INNER JOIN subjects s
            ON s.id =
              tst_subject.subject_id

          WHERE
            tst_subject.test_id
              IN (${placeholders})

          GROUP BY
            tst_subject.test_id
        `,

        args:
          testIds,
      });

    /* -------------------------------------------------------
       STEP 3
       
       CURRENT USER ATTEMPTS FOR CURRENT PAGE
    ------------------------------------------------------- */

    const attemptsResult =
      await db.execute({
        sql: `
          SELECT
            test_id,

            SUM(
              CASE
                WHEN status = 'submitted'
                THEN 1
                ELSE 0
              END
            ) AS attempts_used,

            MAX(
              CASE
                WHEN status = 'in_progress'
                THEN id
                ELSE NULL
              END
            ) AS in_progress_attempt_id,

            MAX(
              CASE
                WHEN status = 'in_progress'
                THEN attempt_number
                ELSE NULL
              END
            ) AS in_progress_attempt_number

          FROM ${seriesConfig.attemptTable}

          WHERE
            user_id = ?

            AND test_id IN (
              ${placeholders}
            )

          GROUP BY
            test_id
        `,

        args: [
          userId,
          ...testIds,
        ],
      });

    /* -------------------------------------------------------
       MAP SUBJECTS
    ------------------------------------------------------- */

    const subjectsByTest =
      new Map();

    for (
      const row of
        subjectsResult.rows ||
        []
    ) {
      const testId =
        Number(
          row.test_id
        );

      const subjects =
        row.subjects_csv
          ? String(
              row.subjects_csv
            )
              .split(",")
              .map(
                (item) =>
                  item.trim()
              )
              .filter(
                Boolean
              )
          : [];

      subjectsByTest.set(
        testId,
        subjects
      );
    }

    /* -------------------------------------------------------
       MAP ATTEMPTS
    ------------------------------------------------------- */

    const attemptsByTest =
      new Map();

    for (
      const row of
        attemptsResult.rows ||
        []
    ) {
      const testId =
        Number(
          row.test_id
        );

      attemptsByTest.set(
        testId,
        {
          attemptsUsed:
            Number(
              row.attempts_used ||
                0
            ),

          inProgressAttemptId:
            row.in_progress_attempt_id
              ? Number(
                  row.in_progress_attempt_id
                )
              : null,

          inProgressAttemptNumber:
            row.in_progress_attempt_number
              ? Number(
                  row.in_progress_attempt_number
                )
              : null,
        }
      );
    }

    /* -------------------------------------------------------
       STEP 4
       
       BUILD FINAL RESPONSE
    ------------------------------------------------------- */

    const tests =
      testRows.map(
        (row) => {
          const testId =
            Number(
              row.id
            );

          const attemptStats =
            attemptsByTest.get(
              testId
            ) || {
              attemptsUsed: 0,

              inProgressAttemptId:
                null,

              inProgressAttemptNumber:
                null,
            };

          const attemptsUsed =
            Number(
              attemptStats.attemptsUsed ||
                0
            );

          const inProgressAttemptId =
            attemptStats.inProgressAttemptId ||
            null;

          const inProgressAttemptNumber =
            attemptStats.inProgressAttemptNumber ||
            null;

          const subjects =
            subjectsByTest.get(
              testId
            ) || [];

          return {
            id:
              testId,

            title:
              row.title ||
              "Untitled Test",

            slug:
              row.slug ||
              null,

            description:
              row.description ||
              null,

            durationMinutes:
              Number(
                row.duration_minutes ||
                  0
              ),

            totalQuestions:
              Number(
                row.total_questions ||
                  0
              ),

            totalMarks:
              Number(
                row.total_marks ||
                  0
              ),

            /*
             * Availability information is useful to the
             * frontend without changing the existing UI.
             */

            isPublished:
              Number(
                row.is_published ||
                  0
              ) === 1,

            isAvailable:
              true,

            subjects,

            category: {
              id:
                Number(
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
                3 -
                  attemptsUsed,
                0
              ),

            hasInProgress:
              Boolean(
                inProgressAttemptId
              ),

            inProgressAttemptId,

            inProgressAttemptNumber,

            attemptsExhausted:
              attemptsUsed >=
                3 &&
              !inProgressAttemptId,
          };
        }
      );

    /* -------------------------------------------------------
       NEXT CURSOR
    ------------------------------------------------------- */

    const lastTest =
      tests[
        tests.length -
          1
      ];

    const nextCursor =
      tests.length ===
        limit &&
      lastTest?.id
        ? String(
            lastTest.id
          )
        : null;

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        series: {
          id:
            seriesConfig.seriesId,

          slug:
            series,

          name:
            seriesConfig.name,
        },

        mode,

        subject:
          mode === "dpp"
            ? subject ||
              null
            : null,

        hasAccess: true,

        seriesActive: true,

        tests,

        nextCursor,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Dashboard tests API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to load tests right now.",
      },
      {
        status: 500,
      }
    );
  }
}