import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  toNumber,
  firstDefined,
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

  return new Date(
    text
  ).getTime();
}

/* =========================================================
   TIMER HELPERS
========================================================= */

function isLiveAttempt(
  eventId
) {
  return (
    Number(
      eventId || 0
    ) > 0
  );
}

function calculateActiveSeconds(
  storedSeconds,
  lastActiveAt
) {
  const stored =
    Math.max(
      0,
      Number(
        storedSeconds || 0
      )
    );

  if (!lastActiveAt) {
    return Math.floor(
      stored
    );
  }

  const timestamp =
    parseDatabaseDate(
      lastActiveAt
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return Math.floor(
      stored
    );
  }

  const additional =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          timestamp
        ) / 1000
      )
    );

  return Math.floor(
    stored +
      additional
  );
}

/* =========================================================
   POST CHECKPOINT
========================================================= */

export async function POST(
  request,
  { params }
) {
  try {
    /* ------------------------------------------------------
       PARAMS
    ------------------------------------------------------ */

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

    /* ------------------------------------------------------
       BASIC VALIDATION
    ------------------------------------------------------ */

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

    /* ------------------------------------------------------
       AUTH
       
       Keep existing DB-backed session/device validation
       for actual attempt APIs.
    ------------------------------------------------------ */

    const auth =
      await requireAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
      currentUser,
    } = auth;

    /* ------------------------------------------------------
       JWT SERIES ACCESS
    ------------------------------------------------------ */

    const access =
      requireSeriesAccess(
        currentUser,
        series
      );

    if (!access.ok) {
      return access.response;
    }

    /* ------------------------------------------------------
       TEST
    ------------------------------------------------------ */

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

    /* ------------------------------------------------------
       REQUEST BODY
    ------------------------------------------------------ */

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

    /* ------------------------------------------------------
       ATTEMPT ID VALIDATION
    ------------------------------------------------------ */

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

    /* ------------------------------------------------------
       MAX PAYLOAD
    ------------------------------------------------------ */

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
     * ------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We now fetch timer fields as well.
     *
     * event_id != NULL
     *     => LIVE / wall-clock
     *
     * event_id == NULL
     *     => SELF-PACED / active-time
     *
     * active_seconds + last_active_at are authoritative
     * for self-paced attempts.
     */

    const attemptResult =
      await db.execute({
        sql: `
          SELECT
            id,
            status,
            event_id,
            started_at,
            deadline_at,
            active_seconds,
            last_active_at
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

    /* ------------------------------------------------------
       ATTEMPT STATUS
    ------------------------------------------------------ */

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

          activeSeconds:
            Number(
              attempt.active_seconds ||
                0
            ),
        },
        {
          status: 200,
        }
      );
    }

    /* =======================================================
       TIMER STATE
    ======================================================= */

    const live =
      isLiveAttempt(
        attempt.event_id
      );

    let currentActiveSeconds =
      Math.max(
        0,
        Number(
          attempt.active_seconds ||
            0
        )
      );

    /*
     * ------------------------------------------------------
     * SELF-PACED
     * ------------------------------------------------------
     *
     * If last_active_at exists, add time since the last
     * server checkpoint/heartbeat.
     *
     * If it is NULL, attempt is paused.
     */

    if (!live) {
      currentActiveSeconds =
        calculateActiveSeconds(
          attempt.active_seconds,
          attempt.last_active_at
        );

      /*
       * Do NOT use deadline_at as the primary expiry check
       * for self-paced attempts.
       *
       * deadline_at can pass while the attempt is paused.
       */
    }

    /*
     * ------------------------------------------------------
     * LIVE
     * ------------------------------------------------------
     *
     * Existing wall-clock deadline remains authoritative.
     * ------------------------------------------------------
     */

    if (live) {
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
          `[checkpoint] LIVE EXPIRED ${series}/${test.id} attempt=${attemptId} -> skip checkpoint, allow submit`
        );

        return NextResponse.json(
          {
            success: true,

            saved: 0,

            expired: true,

            code:
              "ATTEMPT_EXPIRED",

            activeSeconds:
              currentActiveSeconds,

            message:
              "Attempt time has expired. Final submission should be processed by the submit endpoint.",
          },
          {
            status: 200,
          }
        );
      }
    }

    /*
     * ------------------------------------------------------
     * SELF-PACED DURATION CHECK
     * ------------------------------------------------------
     */

    const durationSeconds =
      Math.max(
        0,
        Number(
          firstDefined(
            test?.duration_minutes,
            test?.durationMinutes,
            0
          )
        ) *
          60
      );

    if (
      !live &&
      durationSeconds > 0 &&
      currentActiveSeconds >=
        durationSeconds
    ) {
      /*
       * Keep checkpoint a no-op.
       * Submit endpoint remains responsible for finalization.
       */

      console.log(
        `[checkpoint] ACTIVE EXPIRED ${series}/${test.id} attempt=${attemptId} -> skip checkpoint, allow submit`
      );

      return NextResponse.json(
        {
          success: true,

          saved: 0,

          expired: true,

          code:
            "ATTEMPT_EXPIRED",

          activeSeconds:
            durationSeconds,

          remainingSeconds:
            0,

          message:
            "Attempt time has expired. Final submission should be processed by the submit endpoint.",
        },
        {
          status: 200,
        }
      );
    }

    /* =======================================================
       TIMER PERSISTENCE
    ======================================================= */

    /*
     * For a self-paced RUNNING attempt:
     *
     * active_seconds = calculated current value
     * last_active_at = now
     *
     * For a self-paced PAUSED attempt:
     *
     * last_active_at is NULL
     *
     * IMPORTANT:
     * We never revive a paused attempt here.
     *
     * This avoids a race with the pause endpoint.
     */

    if (!live) {
      if (
        attempt.last_active_at
      ) {
        await db.execute({
          sql: `
            UPDATE ${config.attempts}
            SET
              active_seconds = ?,
              last_active_at = CURRENT_TIMESTAMP
            WHERE
              id = ?
              AND user_id = ?
              AND test_id = ?
              AND status = 'in_progress'
              AND last_active_at IS NOT NULL
          `,

          args: [
            Math.min(
              currentActiveSeconds,
              durationSeconds > 0
                ? durationSeconds
                : currentActiveSeconds
            ),

            attemptId,

            userId,

            testId,
          ],
        });
      } else {
        /*
         * Attempt is paused.
         *
         * Keep it paused.
         * Do not update last_active_at.
         */
      }
    }

    /* =======================================================
       EMPTY CHECKPOINT
    ======================================================= */

    if (
      answers.length ===
      0
    ) {
      const remaining =
        !live &&
        durationSeconds > 0
          ? Math.max(
              0,
              durationSeconds -
                Math.min(
                  currentActiveSeconds,
                  durationSeconds
                )
            )
          : null;

      return NextResponse.json(
        {
          success: true,

          saved: 0,

          expired: false,

          activeSeconds:
            currentActiveSeconds,

          remainingSeconds:
            remaining,
        },
        {
          status: 200,
        }
      );
    }

    /* =======================================================
       BUILD WRITE STATEMENTS
    ======================================================= */

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

    /* =======================================================
       ATOMIC ANSWER WRITE
    ======================================================= */

    await db.batch(
      statements,
      "write"
    );

    /* =======================================================
       FINAL RESPONSE
    ======================================================= */

    const remaining =
      !live &&
      durationSeconds > 0
        ? Math.max(
            0,
            durationSeconds -
              Math.min(
                currentActiveSeconds,
                durationSeconds
              )
          )
        : null;

    console.log(
      `[checkpoint] SAVED ${series}/${test.id} attempt=${attemptId} answers=${answers.length} timer=${live ? "live" : "active"}`
    );

    return NextResponse.json(
      {
        success: true,

        saved:
          answers.length,

        expired:
          false,

        timerMode:
          live
            ? "live"
            : "active",

        activeSeconds:
          currentActiveSeconds,

        remainingSeconds:
          remaining,
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