import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  jsonError,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
} from "@/lib/testSecurity";

/* =========================================================
   NORMALIZE ANSWERS
========================================================= */

function normalizeAnswers(input) {
  const map = new Map();

  for (
    const item of Array.isArray(input)
      ? input
      : []
  ) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const questionId =
      Number(
        item.questionId
      );

    if (
      !Number.isInteger(
        questionId
      ) ||
      questionId <= 0
    ) {
      continue;
    }

    /* -------------------------------------------------------
       Selected option
    ------------------------------------------------------- */

    let selectedOptionId =
      null;

    if (
      item.selectedOptionId !==
        null &&
      item.selectedOptionId !==
        undefined &&
      item.selectedOptionId !==
        ""
    ) {
      const parsed =
        Number(
          item.selectedOptionId
        );

      if (
        Number.isInteger(
          parsed
        ) &&
        parsed > 0
      ) {
        selectedOptionId =
          parsed;
      }
    }

    /* -------------------------------------------------------
       Question time
    ------------------------------------------------------- */

    const rawTime =
      Number(
        item.timeSpentSeconds ||
          0
      );

    const timeSpentSeconds =
      Number.isFinite(
        rawTime
      ) &&
      rawTime >= 0
        ? Math.floor(
            rawTime
          )
        : 0;

    /* -------------------------------------------------------
       State
    ------------------------------------------------------- */

    const visited =
      item.visited
        ? 1
        : 0;

    const markedForReview =
      item.markedForReview
        ? 1
        : 0;

    /*
     * Last occurrence wins.
     *
     * Duplicate question IDs therefore
     * result in one database write only.
     */
    map.set(
      questionId,
      {
        selectedOptionId,
        timeSpentSeconds,
        visited,
        markedForReview,
      }
    );
  }

  return Array.from(
    map.entries()
  );
}

/* =========================================================
   DATE HELPERS
========================================================= */

function parseDatabaseDate(
  value
) {
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
    return new Date(
      `${text.replace(
        " ",
        "T"
      )}Z`
    ).getTime();
  }

  /*
   * ISO timestamp
   */

  return new Date(
    text
  ).getTime();
}

/* =========================================================
   POST CHECKPOINT
========================================================= */

export async function POST(
  request,
  { params }
) {
  try {
    /*
     * ------------------------------------------------------
     * PARAMS
     * ------------------------------------------------------
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
      normalizeId(
        rawId
      );

    /*
     * ------------------------------------------------------
     * BASIC VALIDATION
     * ------------------------------------------------------
     */

    if (
      !SERIES_CONFIG[
        series
      ]
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

    /*
     * ------------------------------------------------------
     * AUTH
     *
     * Centralized in testSecurity.js
     * ------------------------------------------------------
     */

    const auth =
      await requireAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
      currentUser,
    } = auth;

    /*
     * ------------------------------------------------------
     * SERIES ACCESS
     *
     * IMPORTANT:
     *
     * Paid access comes from the verified JWT snapshot.
     *
     * This route does NOT query
     * user_series_access for entitlement.
     * ------------------------------------------------------
     */

    const access =
      requireSeriesAccess(
        currentUser,
        series
      );

    if (!access.ok) {
      return access.response;
    }

    /*
     * ------------------------------------------------------
     * TEST
     * ------------------------------------------------------
     */

    const testResult =
      await getTestById(
        series,
        testId
      );

    if (!testResult.ok) {
      return testResult.response;
    }

    const {
      test,
      config: securityConfig,
    } = testResult;

    /*
     * ------------------------------------------------------
     * CONFIG
     *
     * Keep the existing checkpoint naming convention:
     *
     * attempts
     * answers
     * questions
     * options
     *
     * The central security config stores the same series
     * table names.
     * ------------------------------------------------------
     */

    const config = {
      ...securityConfig,

      attempts:
        securityConfig.attemptTable,

      answers:
        securityConfig.answerTable,

      questions:
        securityConfig.questionTable,

      options:
        securityConfig.optionTable,
    };

    /*
     * ------------------------------------------------------
     * REQUEST BODY
     * ------------------------------------------------------
     */

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const attemptId =
      Number(
        body?.attemptId ||
          0
      );

    const answers =
      normalizeAnswers(
        body?.answers
      );

    /*
     * ------------------------------------------------------
     * ATTEMPT ID VALIDATION
     * ------------------------------------------------------
     */

    if (
      !Number.isInteger(
        attemptId
      ) ||
      attemptId <= 0
    ) {
      return jsonError(
        "Valid attempt id is required.",
        400,
        "ATTEMPT_ID_REQUIRED"
      );
    }

    /*
     * ------------------------------------------------------
     * EMPTY CHECKPOINT
     *
     * Successful no-op.
     * ------------------------------------------------------
     */

    if (
      answers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: true,

          saved: 0,

          expired: false,
        },
        {
          status: 200,
        }
      );
    }

    /*
     * ------------------------------------------------------
     * MAX PAYLOAD
     * ------------------------------------------------------
     */

    if (
      answers.length >
      200
    ) {
      return jsonError(
        "Too many answers in one checkpoint.",
        400,
        "CHECKPOINT_TOO_LARGE"
      );
    }

    /*
     * ------------------------------------------------------
     * VERIFY ATTEMPT
     *
     * Ownership + correct test + active status +
     * start/deadline in one query.
     * ------------------------------------------------------
     */

    const attemptResult =
      await db.execute({
        sql: `
          SELECT
            id,
            status,
            started_at,
            deadline_at
          FROM ${config.attempts}
          WHERE
            id = ?
            AND user_id = ?
            AND test_id = ?
          LIMIT 1
        `,

        args: [
          attemptId,
          userId,
          test.id,
        ],
      });

    const attempt =
      attemptResult.rows?.[0];

    if (!attempt) {
      return NextResponse.json(
        {
          error:
            "Attempt not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ------------------------------------------------------
     * ATTEMPT STATUS
     * ------------------------------------------------------
     */

    if (
      String(
        attempt.status
      ) !==
      "in_progress"
    ) {
      /*
       * Client may fire one last checkpoint during
       * navigation/submission.
       */

      return NextResponse.json(
        {
          success: true,

          saved: 0,

          expired:
            String(
              attempt.status
            ) ===
            "auto_submitted",
        },
        {
          status: 200,
        }
      );
    }

    /*
     * ------------------------------------------------------
     * EXPIRY CHECK
     * ------------------------------------------------------
     *
     * Expired checkpoint is a successful no-op.
     *
     * Final scoring/submission stays the responsibility
     * of the submit endpoint.
     * ------------------------------------------------------
     */

    const deadlineTimestamp =
      parseDatabaseDate(
        attempt.deadline_at
      );

    const expired =
      Number.isFinite(
        deadlineTimestamp
      ) &&
      deadlineTimestamp <=
        Date.now();

    if (expired) {
      console.log(
        `[checkpoint] EXPIRED ${series}/${test.id} attempt=${attemptId} -> skip checkpoint, allow submit`
      );

      return NextResponse.json(
        {
          success: true,

          saved: 0,

          expired: true,

          code:
            "ATTEMPT_EXPIRED",

          message:
            "Attempt time has expired. Final submission should be processed by the submit endpoint.",
        },
        {
          status: 200,
        }
      );
    }

    /*
     * ------------------------------------------------------
     * BUILD WRITE STATEMENTS
     * ------------------------------------------------------
     *
     * Every statement:
     *
     * - verifies question belongs to test
     * - verifies selected option belongs to question
     * - upserts attempt answer
     *
     * is_correct stays NULL.
     *
     * Final scoring is performed by submit.
     * ------------------------------------------------------
     */

    const statements =
      answers.map(
        ([
          questionId,
          answer,
        ]) => ({
          sql: `
            INSERT INTO ${config.answers} (
              attempt_id,
              question_id,
              selected_option_id,
              is_correct,
              marks_obtained,
              time_spent_seconds,
              answered_at,
              visited,
              marked_for_review
            )

            SELECT
              ?,
              q.id,
              ?,
              NULL,
              0,
              ?,
              CASE
                WHEN ? IS NOT NULL
                THEN CURRENT_TIMESTAMP
                ELSE NULL
              END,
              ?,
              ?

            FROM ${config.questions} q

            WHERE
              q.id = ?
              AND q.test_id = ?

              AND (
                ? IS NULL

                OR EXISTS (
                  SELECT 1
                  FROM ${config.options} qo
                  WHERE
                    qo.id = ?
                    AND qo.question_id = q.id
                )
              )

            ON CONFLICT(
              attempt_id,
              question_id
            )

            DO UPDATE SET
              selected_option_id =
                excluded.selected_option_id,

              time_spent_seconds =
                excluded.time_spent_seconds,

              answered_at =
                excluded.answered_at,

              visited =
                excluded.visited,

              marked_for_review =
                excluded.marked_for_review
          `,

          args: [
            /*
             * attempt_id
             */
            attemptId,

            /*
             * selected_option_id
             */
            answer.selectedOptionId,

            /*
             * time_spent_seconds
             */
            answer.timeSpentSeconds,

            /*
             * answered_at condition
             */
            answer.selectedOptionId,

            /*
             * visited
             */
            answer.visited,

            /*
             * marked_for_review
             */
            answer.markedForReview,

            /*
             * q.id
             */
            questionId,

            /*
             * q.test_id
             */
            test.id,

            /*
             * option validation
             */
            answer.selectedOptionId,

            /*
             * option id
             */
            answer.selectedOptionId,
          ],
        })
      );

    /*
     * ------------------------------------------------------
     * WRITE
     * ------------------------------------------------------
     */

    await db.batch(
      statements,
      "write"
    );

    /*
     * ------------------------------------------------------
     * RESPONSE
     * ------------------------------------------------------
     */

    console.log(
      `[checkpoint] SAVED ${series}/${test.id} attempt=${attemptId} answers=${answers.length}`
    );

    return NextResponse.json(
      {
        success: true,

        saved:
          answers.length,

        expired: false,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[POST checkpoint] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to save attempt progress.",
      },
      {
        status: 500,
      }
    );
  }
}