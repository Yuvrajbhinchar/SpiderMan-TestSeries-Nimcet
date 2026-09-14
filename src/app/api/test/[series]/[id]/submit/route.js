import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  toNumber,
  firstDefined,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
} from "@/lib/testSecurity";

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
    return new Date(
      `${text.replace(
        " ",
        "T"
      )}Z`
    ).getTime();
  }

  const timestamp =
    new Date(
      text
    ).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : NaN;
}

function toIsoUtc(
  value
) {
  if (!value) {
    return null;
  }

  const text =
    String(value);

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

  const date =
    new Date(
      text
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
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

  /*
   * NULL means the self-paced attempt is paused.
   */
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
   POST
   /api/test/[series]/[id]/submit
========================================================= */

export async function POST(
  request,
  { params }
) {
  try {
    /* -------------------------------------------------------
       PARAMS
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

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

    const config =
      SERIES_CONFIG[
        series
      ];

    /* -------------------------------------------------------
       AUTH
       
       Actual attempt submission remains protected by:
       JWT + server-side user/session/device validation.
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
       SERIES ACCESS
       
       Paid entitlement comes from verified JWT.
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
       BODY
    ------------------------------------------------------- */

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const attemptId =
      normalizeId(
        body?.attemptId
      );

    if (!attemptId) {
      return jsonError(
        "Attempt ID is required.",
        400,
        "ATTEMPT_ID_REQUIRED"
      );
    }

    /* -------------------------------------------------------
       TEST
    ------------------------------------------------------- */

    const testResult =
      await getTestById(
        series,
        testId
      );

    if (!testResult.ok) {
      return testResult.response;
    }

    const {
      test: testRow,
    } = testResult;

    /* -------------------------------------------------------
       ATTEMPT
       
       IMPORTANT:
       Timer fields are now included.
    ------------------------------------------------------- */

    const attemptResult =
      await db.execute({
        sql: `
          SELECT
            id,
            user_id,
            test_id,
            event_id,
            attempt_number,
            status,
            started_at,
            submitted_at,
            deadline_at,
            active_seconds,
            last_active_at,
            score,
            total_marks,
            correct_count,
            wrong_count,
            unanswered_count,
            time_taken_seconds,
            created_at

          FROM ${config.attemptTable}

          WHERE
            id = ?
            AND user_id = ?
            AND test_id = ?

          LIMIT 1
        `,

        args: [
          attemptId,
          userId,
          testId,
        ],
      });

    const attempt =
      attemptResult.rows?.[0];

    if (!attempt) {
      return jsonError(
        "Attempt not found.",
        404,
        "ATTEMPT_NOT_FOUND"
      );
    }

    /* -------------------------------------------------------
       DOUBLE SUBMIT PROTECTION
    ------------------------------------------------------- */

    if (
      String(
        attempt.status
      ) !==
      "in_progress"
    ) {
      return jsonError(
        "This attempt has already been submitted.",
        409,
        "ATTEMPT_ALREADY_SUBMITTED"
      );
    }

    /* =======================================================
       TIMER / EXPIRY
    ======================================================= */

    const live =
      isLiveAttempt(
        attempt.event_id
      );

    const now =
      new Date();

    let finalTimeTakenSeconds =
      0;

    let expired =
      false;

    /*
     * -------------------------------------------------------
     * LIVE TEST
     * -------------------------------------------------------
     *
     * Fixed wall-clock timer.
     */

    if (live) {
      const deadlineTimestamp =
        parseDatabaseDate(
          attempt.deadline_at
        );

      expired =
        Number.isFinite(
          deadlineTimestamp
        ) &&
        deadlineTimestamp <=
          now.getTime();

      /*
       * For live tests, time_taken is based on
       * started_at → submission time, capped by duration.
       */

      const startedTimestamp =
        parseDatabaseDate(
          attempt.started_at
        );

      const durationSeconds =
        Math.max(
          0,
          toNumber(
            firstDefined(
              testRow?.duration_minutes,
              testRow?.durationMinutes,
              0
            ),
            0
          ) * 60
        );

      if (
        Number.isFinite(
          startedTimestamp
        )
      ) {
        const wallClockSeconds =
          Math.max(
            0,
            Math.floor(
              (
                now.getTime() -
                startedTimestamp
              ) / 1000
            )
          );

        finalTimeTakenSeconds =
          durationSeconds > 0
            ? Math.min(
                wallClockSeconds,
                durationSeconds
              )
            : wallClockSeconds;
      } else {
        finalTimeTakenSeconds =
          Math.max(
            0,
            Number(
              attempt.time_taken_seconds ||
                0
            )
          );
      }
    }

    /*
     * -------------------------------------------------------
     * SELF-PACED TEST
     * -------------------------------------------------------
     *
     * active_seconds is authoritative.
     *
     * If last_active_at exists:
     *   current active interval is added.
     *
     * If last_active_at is NULL:
     *   timer is paused and no extra time is added.
     */

    else {
      const durationSeconds =
        Math.max(
          0,
          toNumber(
            firstDefined(
              testRow?.duration_minutes,
              testRow?.durationMinutes,
              0
            ),
            0
          ) * 60
        );

      let currentActiveSeconds =
        calculateActiveSeconds(
          attempt.active_seconds,
          attempt.last_active_at
        );

      if (
        durationSeconds > 0
      ) {
        currentActiveSeconds =
          Math.min(
            currentActiveSeconds,
            durationSeconds
          );
      }

      finalTimeTakenSeconds =
        Math.max(
          0,
          Math.floor(
            currentActiveSeconds
          )
        );

      /*
       * Expiry is based only on active usage,
       * NOT on deadline_at.
       *
       * This is what makes pause/resume work.
       */

      expired =
        durationSeconds > 0 &&
        currentActiveSeconds >=
          durationSeconds;

      /*
       * Keep timer state final and paused before
       * the final submission.
       */
      attempt.active_seconds =
        finalTimeTakenSeconds;

      attempt.last_active_at =
        null;
    }

    /* =======================================================
       QUESTIONS + CORRECT OPTIONS + SAVED ANSWERS
       
       Correct answers NEVER reach the frontend.
    ======================================================= */

    const questionsResult =
      await db.execute({
        sql: `
          SELECT
            q.id AS question_id,
            q.marks,
            q.negative_marks,
            qo.id AS correct_option_id

          FROM ${config.questionTable} q

          LEFT JOIN ${config.optionTable} qo
            ON qo.question_id = q.id
            AND qo.is_correct = 1

          WHERE
            q.test_id = ?

          ORDER BY
            q.question_order ASC,
            q.id ASC
        `,

        args: [
          testId,
        ],
      });

    const questions =
      questionsResult.rows ||
      [];

    if (
      questions.length ===
      0
    ) {
      return jsonError(
        "This test has no questions.",
        422,
        "NO_QUESTIONS"
      );
    }

    /* =======================================================
       SAVED ANSWERS
    ======================================================= */

    const answersResult =
      await db.execute({
        sql: `
          SELECT
            id,
            attempt_id,
            question_id,
            selected_option_id,
            is_correct,
            marks_obtained,
            time_spent_seconds,
            answered_at,
            visited,
            marked_for_review

          FROM ${config.answerTable}

          WHERE
            attempt_id = ?

          ORDER BY
            question_id ASC
        `,

        args: [
          attemptId,
        ],
      });

    const savedAnswers =
      answersResult.rows ||
      [];

    const answersByQuestion =
      new Map();

    for (
      const answer of
        savedAnswers
    ) {
      const questionId =
        Number(
          answer.question_id
        );

      if (
        !Number.isInteger(
          questionId
        ) ||
        questionId <= 0
      ) {
        continue;
      }

      answersByQuestion.set(
        questionId,
        answer
      );
    }

    /* =======================================================
       SCORE
    ======================================================= */

    let score = 0;

    let correctCount = 0;

    let wrongCount = 0;

    let unansweredCount =
      0;

    /*
     * Question-level answer time is still preserved
     * separately from the master attempt timer.
     *
     * For result analytics we use the authoritative
     * master timer as time_taken_seconds.
     */

    const answerUpdates =
      [];

    /* -------------------------------------------------------
       SCORE EACH QUESTION
    ------------------------------------------------------- */

    for (
      const question of
        questions
    ) {
      const questionId =
        Number(
          question.question_id
        );

      const marks =
        toNumber(
          question.marks,
          0
        );

      const negativeMarks =
        toNumber(
          question.negative_marks,
          0
        );

      const correctOptionId =
        question.correct_option_id ===
          null ||
        question.correct_option_id ===
          undefined
          ? null
          : Number(
              question.correct_option_id
            );

      const answer =
        answersByQuestion.get(
          questionId
        );

      const selectedOptionId =
        answer?.selected_option_id ===
          null ||
        answer?.selected_option_id ===
          undefined ||
        answer?.selected_option_id ===
          ""
          ? null
          : Number(
              answer.selected_option_id
            );

      const timeSpentSeconds =
        Math.max(
          0,
          Math.floor(
            toNumber(
              answer?.time_spent_seconds,
              0
            )
          )
        );

      let isCorrect =
        null;

      let marksObtained =
        0;

      /* -----------------------------------------------------
         UNANSWERED
      ----------------------------------------------------- */

      if (
        selectedOptionId ===
          null ||
        !Number.isInteger(
          selectedOptionId
        ) ||
        selectedOptionId <=
          0
      ) {
        unansweredCount +=
          1;

        isCorrect =
          null;

        marksObtained =
          0;
      }

      /* -----------------------------------------------------
         CORRECT
      ----------------------------------------------------- */

      else if (
        correctOptionId !==
          null &&
        selectedOptionId ===
          correctOptionId
      ) {
        correctCount +=
          1;

        isCorrect =
          1;

        marksObtained =
          marks;

        score +=
          marks;
      }

      /* -----------------------------------------------------
         WRONG
      ----------------------------------------------------- */

      else {
        wrongCount +=
          1;

        isCorrect =
          0;

        marksObtained =
          -negativeMarks;

        score -=
          negativeMarks;
      }

      /* -----------------------------------------------------
         CHECKPOINT FLAGS
      ----------------------------------------------------- */

      const visited =
        answer
          ? Number(
              answer.visited ||
                0
            )
          : selectedOptionId !==
              null
          ? 1
          : 0;

      const markedForReview =
        answer
          ? Number(
              answer.marked_for_review ||
                0
            )
          : 0;

      const answeredAt =
        selectedOptionId !==
          null
          ? answer?.answered_at ||
            now.toISOString()
          : null;

      answerUpdates.push({
        questionId,

        selectedOptionId,

        isCorrect,

        marksObtained,

        timeSpentSeconds,

        answeredAt,

        visited,

        markedForReview,
      });
    }

    /* =======================================================
       ROUND SCORE
    ======================================================= */

    const finalScore =
      Number(
        Number(
          score
        ).toFixed(2)
      );

    /* =======================================================
       FINALIZE ANSWER STATE
    ======================================================= */

    const answerStatements =
      [];

    for (
      const answer of
        answerUpdates
    ) {
      const existing =
        answersByQuestion.get(
          answer.questionId
        );

      /*
       * Do not create fake answer rows for questions
       * which were never checkpointed.
       */

      if (!existing) {
        continue;
      }

      answerStatements.push({
        sql: `
          UPDATE ${config.answerTable}

          SET
            selected_option_id = ?,
            is_correct = ?,
            marks_obtained = ?,
            time_spent_seconds = ?,
            answered_at = ?,
            visited = ?,
            marked_for_review = ?

          WHERE
            id = ?
            AND attempt_id = ?
            AND question_id = ?
        `,

        args: [
          answer.selectedOptionId,

          answer.isCorrect,

          answer.marksObtained,

          answer.timeSpentSeconds,

          answer.answeredAt,

          answer.visited,

          answer.markedForReview,

          Number(
            existing.id
          ),

          attemptId,

          answer.questionId,
        ],
      });
    }

    /* =======================================================
       TOTAL MARKS
    ======================================================= */

    const totalMarks =
      toNumber(
        attempt.total_marks,
        toNumber(
          testRow.total_marks,
          0
        )
      );

    /* =======================================================
       FINAL STATUS
       
       auto_submitted when timer reached zero
       otherwise normal submitted.
    ======================================================= */

    const finalStatus =
      expired
        ? "auto_submitted"
        : "submitted";

    const submittedAt =
      now.toISOString();

    /* =======================================================
       ATOMIC FINAL WRITE
    ======================================================= */

    const finalStatements =
      [
        ...answerStatements,

        {
          sql: `
            UPDATE ${config.attemptTable}

            SET
              status = ?,
              submitted_at = ?,
              score = ?,
              total_marks = ?,
              correct_count = ?,
              wrong_count = ?,
              unanswered_count = ?,
              time_taken_seconds = ?,
              active_seconds = ?,
              last_active_at = NULL

            WHERE
              id = ?
              AND user_id = ?
              AND test_id = ?
              AND status = 'in_progress'
          `,

          args: [
            finalStatus,

            submittedAt,

            finalScore,

            totalMarks,

            correctCount,

            wrongCount,

            unansweredCount,

            finalTimeTakenSeconds,

            finalTimeTakenSeconds,

            attemptId,

            userId,

            testId,
          ],
        },
      ];

    const batchResults =
      await db.batch(
        finalStatements,
        "write"
      );

    const updateResult =
      batchResults[
        batchResults.length -
          1
      ];

    /* =======================================================
       RACE CONDITION / DOUBLE SUBMIT
    ======================================================= */

    if (
      Number(
        updateResult.rowsAffected ||
          0
      ) !== 1
    ) {
      return jsonError(
        "This attempt has already been submitted.",
        409,
        "ATTEMPT_ALREADY_SUBMITTED"
      );
    }

    /* =======================================================
       DEBUG
    ======================================================= */

    console.log(
      `[submit] ${series}/${testId} attempt=${attemptId} ` +
        `mode=${live ? "live" : "active"} ` +
        `status=${finalStatus} ` +
        `questions=${questions.length} ` +
        `savedAnswers=${savedAnswers.length} ` +
        `correct=${correctCount} ` +
        `wrong=${wrongCount} ` +
        `unanswered=${unansweredCount} ` +
        `score=${finalScore} ` +
        `time=${finalTimeTakenSeconds}`
    );

    /* =======================================================
       RESPONSE
    ======================================================= */

    return NextResponse.json(
      {
        success: true,

        result: {
          attemptId:
            Number(
              attemptId
            ),

          testId:
            Number(
              testId
            ),

          series,

          attemptNumber:
            Number(
              attempt.attempt_number
            ),

          status:
            finalStatus,

          timerMode:
            live
              ? "live"
              : "active",

          score:
            finalScore,

          totalMarks:
            totalMarks,

          correct:
            correctCount,

          wrong:
            wrongCount,

          unanswered:
            unansweredCount,

          totalQuestions:
            questions.length,

          timeTakenSeconds:
            finalTimeTakenSeconds,

          submittedAt,

          expired:
            expired,
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
      "[POST /api/test/[series]/[id]/submit] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to submit test.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   ERROR HELPER
========================================================= */

function jsonError(
  message,
  status,
  code
) {
  return NextResponse.json(
    {
      success: false,

      error:
        message,

      code:
        code || null,
    },
    {
      status,
    }
  );
}