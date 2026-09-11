import { NextResponse } from "next/server";

import {
  db,
} from "@/lib/turso";

import {
  getAccessibleTest,
  requireRuntimeUser,
} from "@/lib/testRuntime";

/*
|--------------------------------------------------------------------------
| NORMALIZE ANSWERS
|--------------------------------------------------------------------------
*/

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

    /*
     * Selected option
     */

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

    /*
     * Question time
     */

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

    /*
     * State
     */

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
     * This also prevents duplicate question
     * payloads from creating multiple writes.
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

/*
|--------------------------------------------------------------------------
| DATE HELPERS
|--------------------------------------------------------------------------
*/

function parseDatabaseDate(
  value
) {
  if (!value) {
    return NaN;
  }

  const text =
    String(
      value
    ).trim();

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

  const parsed =
    new Date(
      text
    ).getTime();

  return parsed;
}

/*
|--------------------------------------------------------------------------
| POST CHECKPOINT
|--------------------------------------------------------------------------
*/

export async function POST(
  request,
  { params }
) {
  try {
    /*
     * ----------------------------------------------------------
     * PARAMS
     * ----------------------------------------------------------
     */

    const {
      series,
      id,
    } = await params;

    /*
     * ----------------------------------------------------------
     * AUTH
     * ----------------------------------------------------------
     */

    const auth =
      await requireRuntimeUser();

    if (!auth.ok) {
      return NextResponse.json(
        {
          error:
            auth.error,

          ...(auth.code
            ? {
                code:
                  auth.code,
              }
            : {}),
        },
        {
          status:
            auth.status,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * TEST ACCESS
     * ----------------------------------------------------------
     */

    const access =
      await getAccessibleTest(
        series,
        id,
        auth.userId
      );

    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const {
      config,
      test,
    } = access;

    /*
     * ----------------------------------------------------------
     * REQUEST BODY
     * ----------------------------------------------------------
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
     * ----------------------------------------------------------
     * ATTEMPT ID VALIDATION
     * ----------------------------------------------------------
     */

    if (
      !Number.isInteger(
        attemptId
      ) ||
      attemptId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Valid attempt id is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * EMPTY CHECKPOINT
     * ----------------------------------------------------------
     *
     * Nothing to save.
     *
     * This is a successful no-op.
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
     * ----------------------------------------------------------
     * MAX PAYLOAD
     * ----------------------------------------------------------
     */

    if (
      answers.length >
      200
    ) {
      return NextResponse.json(
        {
          error:
            "Too many answers in one checkpoint.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * VERIFY ATTEMPT
     * ----------------------------------------------------------
     *
     * Ownership + correct test + active status +
     * start/deadline in one query.
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
          auth.userId,
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
     * ----------------------------------------------------------
     * ATTEMPT STATUS
     * ----------------------------------------------------------
     */

    if (
      String(
        attempt.status
      ) !==
      "in_progress"
    ) {
      /*
       * If already submitted/closed, this is still
       * not a server error.
       *
       * The client may be firing one last checkpoint
       * during navigation.
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
     * ----------------------------------------------------------
     * EXPIRY CHECK
     * ----------------------------------------------------------
     *
     * IMPORTANT:
     *
     * Previously this returned HTTP 410.
     *
     * That caused submitTest() to stop before calling
     * the submit API.
     *
     * Now an expired checkpoint is treated as a
     * successful no-op.
     *
     * The SUBMIT endpoint remains responsible for
     * final scoring + auto submission.
     * ----------------------------------------------------------
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
     * ----------------------------------------------------------
     * BUILD WRITE STATEMENTS
     * ----------------------------------------------------------
     *
     * Each statement:
     *
     * - verifies question belongs to test
     * - verifies selected option belongs to question
     * - inserts or updates attempt answer
     *
     * is_correct remains NULL here.
     *
     * Scoring is intentionally done during final submit.
     * ----------------------------------------------------------
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
                    AND qo.question_id =
                      q.id
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
     * ----------------------------------------------------------
     * WRITE
     * ----------------------------------------------------------
     */

    await db.batch(
      statements,
      "write"
    );

    /*
     * ----------------------------------------------------------
     * RESPONSE
     * ----------------------------------------------------------
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