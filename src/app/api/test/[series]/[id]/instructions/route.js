import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

/*
|--------------------------------------------------------------------------
| SERIES CONFIG
|--------------------------------------------------------------------------
*/

const SERIES_CONFIG = {
  free: {
    seriesId: 1,
    testTable: "free_tests",
    sectionTable: "free_test_sections",
    questionTable: "free_questions",
    attemptTable: "free_test_attempts",
  },

  asspire: {
    seriesId: 2,
    testTable: "asspire_tests",
    sectionTable: "asspire_test_sections",
    questionTable: "asspire_questions",
    attemptTable: "asspire_test_attempts",
  },

  imppetus: {
    seriesId: 3,
    testTable: "imppetus_tests",
    sectionTable: "imppetus_test_sections",
    questionTable: "imppetus_questions",
    attemptTable: "imppetus_test_attempts",
  },

  spiderman: {
    seriesId: 4,
    testTable: "spiderman_tests",
    sectionTable: "spiderman_test_sections",
    questionTable: "spiderman_questions",
    attemptTable: "spiderman_test_attempts",
  },
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalizeSeries(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
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
        ? {
            code,
          }
        : {}),
    },
    {
      status,
    }
  );
}

function toNumber(
  value,
  fallback = 0
) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function formatMarkValue(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}

/*
|--------------------------------------------------------------------------
| DATABASE DATE
|--------------------------------------------------------------------------
|
| Supports:
|
| YYYY-MM-DD HH:mm:ss
| YYYY-MM-DDTHH:mm:ss
| ISO timestamps
|
*/

function parseDatabaseDate(value) {
  if (!value) {
    return NaN;
  }

  const text =
    String(value).trim();

  if (!text) {
    return NaN;
  }

  /*
   * SQLite / Turso:
   *
   * 2026-09-10 18:40:00
   */

  if (
    text.length === 19 &&
    text[4] === "-" &&
    text[7] === "-" &&
    text[10] === " " &&
    text[13] === ":" &&
    text[16] === ":"
  ) {
    return new Date(
      `${text.replace(
        " ",
        "T"
      )}Z`
    ).getTime();
  }

  /*
   * ISO:
   *
   * 2026-09-10T18:40:00Z
   */

  const parsed =
    new Date(text).getTime();

  return parsed;
}

/*
|--------------------------------------------------------------------------
| GET
| /api/test/[series]/[id]/instructions
|--------------------------------------------------------------------------
*/

export async function GET(
  request,
  { params }
) {
  try {
    /*
    |----------------------------------------------------------------------
    | PARAMS
    |----------------------------------------------------------------------
    */

    const {
      series: rawSeries,
      id: rawId,
    } = await params;

    const series =
      normalizeSeries(
        rawSeries
      );

    const testId =
      normalizeId(rawId);

    if (
      !SERIES_CONFIG[series]
    ) {
      return jsonError(
        "Invalid test series.",
        400,
        "INVALID_SERIES"
      );
    }

    if (!testId) {
      return jsonError(
        "Invalid test ID.",
        400,
        "INVALID_TEST_ID"
      );
    }

    const config =
      SERIES_CONFIG[series];

    /*
    |----------------------------------------------------------------------
    | AUTHENTICATION
    |----------------------------------------------------------------------
    */

    const currentUser =
      await getCurrentUser();

    if (!currentUser?.id) {
      return jsonError(
        "Please login to continue.",
        401,
        "UNAUTHORIZED"
      );
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
      return jsonError(
        "Invalid user session.",
        401,
        "INVALID_SESSION"
      );
    }

    /*
    |----------------------------------------------------------------------
    | FRESH USER / SESSION STATE
    |----------------------------------------------------------------------
    */

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
      return jsonError(
        "User account not found.",
        401,
        "USER_NOT_FOUND"
      );
    }

    if (
      Number(
        user.is_active
      ) !== 1
    ) {
      return jsonError(
        "Your account is inactive.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    if (
      currentUser.sessionId &&
      user.active_session_id &&
      String(
        currentUser.sessionId
      ) !==
        String(
          user.active_session_id
        )
    ) {
      return jsonError(
        "Your session has been revoked.",
        401,
        "SESSION_REVOKED"
      );
    }

    if (
      currentUser.deviceId &&
      user.active_device_id &&
      String(
        currentUser.deviceId
      ) !==
        String(
          user.active_device_id
        )
    ) {
      return jsonError(
        "Your session is active on another device.",
        401,
        "SESSION_REVOKED"
      );
    }

    /*
    |----------------------------------------------------------------------
    | LOAD TEST
    |----------------------------------------------------------------------
    */

    const testResult =
      await db.execute({
        sql: `
          SELECT
            t.id,
            t.category_id,
            t.title,
            t.slug,
            t.description,
            t.duration_minutes,
            t.total_questions,
            t.total_marks,
            t.is_published,
            t.created_at,
            t.updated_at,

            c.name AS category_name,
            c.slug AS category_slug,

            ts.id AS series_id,
            ts.name AS series_name,
            ts.slug AS series_slug,
            ts.is_paid AS series_is_paid

          FROM ${config.testTable} t

          LEFT JOIN test_categories c
            ON c.id = t.category_id

          LEFT JOIN test_series ts
            ON ts.id = ?

          WHERE
            t.id = ?
            AND t.is_published = 1

          LIMIT 1
        `,
        args: [
          config.seriesId,
          testId,
        ],
      });

    const test =
      testResult.rows?.[0];

    if (!test) {
      return jsonError(
        "Test not found.",
        404,
        "TEST_NOT_FOUND"
      );
    }

    /*
    |----------------------------------------------------------------------
    | SERIES ACCESS
    |----------------------------------------------------------------------
    */

    const seriesIsPaid =
      Number(
        test.series_is_paid
      ) === 1;

    if (seriesIsPaid) {
      const accessResult =
        await db.execute({
          sql: `
            SELECT id
            FROM user_series_access
            WHERE
              user_id = ?
              AND series_id = ?
              AND is_active = 1
              AND (
                expires_at IS NULL
                OR expires_at > CURRENT_TIMESTAMP
              )
            LIMIT 1
          `,
          args: [
            userId,
            config.seriesId,
          ],
        });

      if (
        !accessResult.rows?.length
      ) {
        return jsonError(
          "You do not have access to this test series.",
          403,
          "SERIES_ACCESS_REQUIRED"
        );
      }
    }

    /*
    |----------------------------------------------------------------------
    | CATEGORY / MODE
    |----------------------------------------------------------------------
    */

    const categorySlug =
      String(
        test.category_slug ||
          ""
      )
        .trim()
        .toLowerCase();

    const isDpp =
      categorySlug === "dpp";

    /*
    |----------------------------------------------------------------------
    | SECTIONS
    |----------------------------------------------------------------------
    */

    const sectionsResult =
      await db.execute({
        sql: `
          SELECT
            id,
            test_id,
            section_name,
            section_order,
            duration_minutes,
            question_count,
            is_sequential,
            timer_group
          FROM ${config.sectionTable}
          WHERE test_id = ?
          ORDER BY
            section_order ASC,
            id ASC
        `,
        args: [testId],
      });

    const rawSections =
      sectionsResult.rows ||
      [];

    /*
    |----------------------------------------------------------------------
    | SECTION MARKING
    |----------------------------------------------------------------------
    */

    const sectionIds =
      rawSections
        .map(
          (section) =>
            Number(section.id)
        )
        .filter(
          (id) => id > 0
        );

    let markRows = [];

    if (
      sectionIds.length > 0
    ) {
      const placeholders =
        sectionIds
          .map(() => "?")
          .join(", ");

      const marksResult =
        await db.execute({
          sql: `
            SELECT
              section_id,
              marks,
              negative_marks,
              COUNT(*) AS question_count
            FROM ${config.questionTable}
            WHERE
              test_id = ?
              AND section_id IN (${placeholders})
            GROUP BY
              section_id,
              marks,
              negative_marks
            ORDER BY
              section_id ASC
          `,
          args: [
            testId,
            ...sectionIds,
          ],
        });

      markRows =
        marksResult.rows ||
        [];
    }

    /*
    |----------------------------------------------------------------------
    | BUILD SECTIONS
    |----------------------------------------------------------------------
    */

    const sections =
      rawSections.map(
        (section) => {
          const sectionId =
            Number(
              section.id
            );

          const rowsForSection =
            markRows.filter(
              (row) =>
                Number(
                  row.section_id
                ) ===
                sectionId
            );

          /*
           * Group distinct marking schemes.
           */

          const distinctMarks =
            Array.from(
              new Map(
                rowsForSection.map(
                  (row) => {
                    const positive =
                      Number(
                        row.marks
                      );

                    const negative =
                      Number(
                        row.negative_marks
                      );

                    const key =
                      `${positive}|${negative}`;

                    return [
                      key,
                      {
                        positiveMarks:
                          positive,

                        negativeMarks:
                          negative,

                        questionCount:
                          Number(
                            row.question_count ||
                              0
                          ),
                      },
                    ];
                  }
                )
              ).values()
            );

          let positiveMarks =
            0;

          let negativeMarks =
            0;

          /*
           * Single marking scheme.
           */

          if (
            distinctMarks.length ===
            1
          ) {
            positiveMarks =
              distinctMarks[0]
                .positiveMarks;

            negativeMarks =
              distinctMarks[0]
                .negativeMarks;
          }

          /*
           * Mixed marking scheme.
           *
           * Example:
           * CS + English section.
           *
           * The instruction UI needs a simple
           * representative value.
           *
           * Actual scoring remains question-level.
           */

          else if (
            distinctMarks.length >
            1
          ) {
            positiveMarks =
              Math.max(
                ...distinctMarks.map(
                  (item) =>
                    item.positiveMarks
                )
              );

            negativeMarks =
              Math.max(
                ...distinctMarks.map(
                  (item) =>
                    item.negativeMarks
                )
              );
          }

          return {
            id:
              sectionId,

            test_id:
              Number(
                section.test_id
              ),

            section_name:
              section.section_name,

            section_order:
              Number(
                section.section_order
              ),

            duration_minutes:
              section.duration_minutes ===
              null
                ? null
                : toNumber(
                    section.duration_minutes,
                    0
                  ),

            question_count:
              Number(
                section.question_count ||
                  0
              ),

            is_sequential:
              Number(
                section.is_sequential ||
                  0
              ) === 1,

            timer_group:
              section.timer_group ??
              null,

            positive_marks:
              formatMarkValue(
                positiveMarks
              ),

            negative_marks:
              formatMarkValue(
                negativeMarks
              ),

            marking_schemes:
              distinctMarks,
          };
        }
      );

    /*
    |----------------------------------------------------------------------
    | DURATION
    |----------------------------------------------------------------------
    */

    const sectionDurations =
      sections
        .map(
          (section) =>
            Number(
              section.duration_minutes
            )
        )
        .filter(
          (minutes) =>
            Number.isFinite(
              minutes
            ) &&
            minutes > 0
        );

    /*
     * DPP:
     * stopwatch, no fixed duration.
     *
     * Sectional:
     * sum section durations.
     *
     * Normal:
     * test duration.
     */

    const sectional =
      !isDpp &&
      sectionDurations.length >
        0;

    const totalSectionDuration =
      sectionDurations.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const totalDuration =
      isDpp
        ? 0
        : sectional
        ? totalSectionDuration
        : toNumber(
            test.duration_minutes,
            0
          );

    /*
    |----------------------------------------------------------------------
    | ATTEMPTS
    |----------------------------------------------------------------------
    */

    const attemptsResult =
      await db.execute({
        sql: `
          SELECT
            id,
            attempt_number,
            status,
            started_at,
            submitted_at,
            deadline_at
          FROM ${config.attemptTable}
          WHERE
            user_id = ?
            AND test_id = ?
          ORDER BY
            id DESC
        `,
        args: [
          userId,
          testId,
        ],
      });

    const attempts =
      Array.isArray(
        attemptsResult.rows
      )
        ? attemptsResult.rows
        : [];

    /*
    |----------------------------------------------------------------------
    | ACTIVE ATTEMPT
    |----------------------------------------------------------------------
    */

    const nowMs =
      Date.now();

    let active =
      attempts.find(
        (item) =>
          String(
            item.status
          ) ===
          "in_progress"
      ) || null;

    /*
    |----------------------------------------------------------------------
    | EXPIRE STALE ATTEMPT
    |----------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Do NOT use updated_at here.
    |
    | Your attempt tables don't require an updated_at column.
    |
    */

    if (
      active?.deadline_at
    ) {
      const deadlineMs =
        parseDatabaseDate(
          active.deadline_at
        );

      if (
        Number.isFinite(
          deadlineMs
        ) &&
        deadlineMs <=
          nowMs
      ) {
        console.log(
          `[instructions] Expiring stale attempt ${series}/${testId} attempt=${active.id}`
        );

        /*
         * Only use columns which are part of
         * the existing attempt schema.
         */

        await db.execute({
          sql: `
            UPDATE ${config.attemptTable}
            SET
              status = 'auto_submitted',
              submitted_at = CURRENT_TIMESTAMP
            WHERE
              id = ?
              AND user_id = ?
              AND test_id = ?
              AND status = 'in_progress'
          `,
          args: [
            Number(
              active.id
            ),
            userId,
            testId,
          ],
        });

        active = null;
      }
    }

    /*
    |----------------------------------------------------------------------
    | COMPLETED ATTEMPTS
    |----------------------------------------------------------------------
    */

    const completedStatuses =
      new Set([
        "submitted",
        "auto_submitted",
        "expired",
      ]);

    const submittedCount =
      attempts.filter(
        (item) =>
          completedStatuses.has(
            String(
              item.status
            )
          )
      ).length;

    /*
     * The stale attempt that was just changed
     * from in_progress -> auto_submitted
     * belongs to completed attempts too.
     */

    const staleWasExpired =
      attempts.some(
        (item) =>
          String(
            item.status
          ) === "in_progress" &&
          item.deadline_at &&
          Number.isFinite(
            parseDatabaseDate(
              item.deadline_at
            )
          ) &&
          parseDatabaseDate(
            item.deadline_at
          ) <= nowMs
      );

    const effectiveSubmittedCount =
      submittedCount +
      (staleWasExpired
        ? 1
        : 0);

    const maxAttempts =
      3;

    const remainingAttempts =
      Math.max(
        0,
        maxAttempts -
          effectiveSubmittedCount
      );

    /*
    |----------------------------------------------------------------------
    | ATTEMPT STATE
    |----------------------------------------------------------------------
    */

    const state =
      remainingAttempts <= 0
        ? "exhausted"
        : active
        ? "resume"
        : "new";

    /*
    |----------------------------------------------------------------------
    | RESPONSE
    |----------------------------------------------------------------------
    */

    return NextResponse.json(
      {
        success: true,

        test: {
          id:
            Number(
              test.id
            ),

          title:
            test.title,

          slug:
            test.slug,

          description:
            test.description,

          duration_minutes:
            toNumber(
              test.duration_minutes,
              0
            ),

          total_duration_minutes:
            totalDuration,

          total_questions:
            Number(
              test.total_questions ||
                0
            ),

          total_marks:
            toNumber(
              test.total_marks,
              0
            ),

          category_id:
            Number(
              test.category_id
            ),

          category_name:
            test.category_name ||
            null,

          category_slug:
            categorySlug,

          series_id:
            config.seriesId,

          series_name:
            test.series_name ||
            series,

          series_slug:
            test.series_slug ||
            series,

          is_dpp:
            isDpp,

          sectional,

          is_published:
            Number(
              test.is_published
            ) === 1,

          sections,
        },

        attempt: {
          state,

          active: active
            ? {
                id:
                  Number(
                    active.id
                  ),

                attemptNumber:
                  Number(
                    active.attempt_number
                  ),

                attempt_number:
                  Number(
                    active.attempt_number
                  ),

                status:
                  active.status,

                startedAt:
                  active.started_at,

                started_at:
                  active.started_at,

                deadlineAt:
                  active.deadline_at ||
                  null,

                deadline_at:
                  active.deadline_at ||
                  null,
              }
            : null,

          submittedCount:
            effectiveSubmittedCount,

          maxAttempts,

          remainingAttempts,
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Instructions API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load test instructions.",
      },
      {
        status: 500,
      }
    );
  }
}