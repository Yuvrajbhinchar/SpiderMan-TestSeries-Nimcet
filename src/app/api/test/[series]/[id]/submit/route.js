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
  getTestCategory,
} from "@/lib/testSecurity";

/* =========================================================
   DATE HELPER
========================================================= */

function toIsoUtc(value) {
  if (!value) {
    return null;
  }

  const text = String(value);

  /*
   * Turso / SQLite:
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
    return `${text.replace(
      " ",
      "T"
    )}Z`;
  }

  const date =
    new Date(text);

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

    /* -------------------------------------------------------
       CENTRAL CONFIG
    ------------------------------------------------------- */

    const config =
      SERIES_CONFIG[
        series
      ];

    /* -------------------------------------------------------
       AUTH
       
       Centralized in testSecurity.js
       
       This now checks:
       - JWT
       - DB user
       - account active
       - active session
       - active device
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
       
       IMPORTANT:
       
       Paid access is checked from the verified JWT
       snapshot through testSecurity.js.
       
       No user_series_access entitlement query here.
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
       
       Current frontend sends:
       
       {
         attemptId: Number(...)
       }
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
       CATEGORY

       Kept available so existing behaviour remains intact
       if category-dependent logic is needed later.
    ------------------------------------------------------- */

    const category =
      await getTestCategory(
        testRow
      );

    /* -------------------------------------------------------
       ATTEMPT
       
       Verify:
       - attempt belongs to current user
       - attempt belongs to current test
    ------------------------------------------------------- */

    const attemptResult =
      await db.execute({
        sql: `
          SELECT
            id,
            user_id,
            test_id,
            attempt_number,
            status,
            started_at,
            submitted_at,
            deadline_at,
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

    /* -------------------------------------------------------
       EXPIRY
       
       DPP:
       deadline_at is normally NULL.
       
       Mini / Mock:
       deadline_at can exist.
    ------------------------------------------------------- */

    const now =
      new Date();

    const deadlineIso =
      toIsoUtc(
        attempt.deadline_at
      );

    const expired =
      Boolean(
        deadlineIso
      ) &&
      new Date(
        deadlineIso
      ).getTime() <=
        now.getTime();

    /*
     * DPP should never be force-expired simply because
     * duration_minutes exists in the test row.
     *
     * Server trusts the attempt's actual deadline.
     */

    const finalStatus =
      expired
        ? "auto_submitted"
        : "submitted";

    /* -------------------------------------------------------
       QUESTIONS + CORRECT OPTIONS + SAVED ANSWERS
       
       Important:
       
       Correct answers are calculated entirely server-side.
       No correct answer is exposed to the frontend.
    ------------------------------------------------------- */

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
      questions.length === 0
    ) {
      return jsonError(
        "This test has no questions.",
        422,
        "NO_QUESTIONS"
      );
    }

    /* -------------------------------------------------------
       SAVED ANSWERS
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       SCORE
    ------------------------------------------------------- */

    let score = 0;

    let correctCount = 0;

    let wrongCount = 0;

    let unansweredCount =
      0;

    let totalTimeSeconds =
      0;

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

      totalTimeSeconds +=
        timeSpentSeconds;

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
         PREVIOUS CHECKPOINT FLAGS
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

    /* -------------------------------------------------------
       ROUND SCORE
    ------------------------------------------------------- */

    const finalScore =
      Number(
        Number(score).toFixed(2)
      );

    /* -------------------------------------------------------
       WRITE FINAL ANSWER STATE
       
       Checkpoint already created the answer rows.
       
       Here we finalize:
       - is_correct
       - marks_obtained
       - answered_at
       
       We intentionally don't create fake answer rows for
       questions that were never checkpointed.
    ------------------------------------------------------- */

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
       * No checkpoint row exists.
       *
       * This means no answer interaction was saved.
       *
       * We intentionally don't insert a fake row.
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

    if (
      answerStatements.length >
      0
    ) {
      await db.batch(
        answerStatements,
        "write"
      );
    }

    /* -------------------------------------------------------
       TOTAL MARKS
       
       Prefer attempt.total_marks because the total was
       already locked when the attempt was created.
       
       Fallback:
       test.total_marks
    ------------------------------------------------------- */

    const totalMarks =
      toNumber(
        attempt.total_marks,
        toNumber(
          testRow.total_marks,
          0
        )
      );

    /* -------------------------------------------------------
       SUBMIT ATTEMPT
       
       IMPORTANT:
       No updated_at because the existing schema
       doesn't contain updated_at.
    ------------------------------------------------------- */

    const submittedAt =
      now.toISOString();

    const updateResult =
      await db.execute({
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
            time_taken_seconds = ?

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

          totalTimeSeconds,

          attemptId,

          userId,

          testId,
        ],
      });

    /* -------------------------------------------------------
       RACE CONDITION / DOUBLE SUBMIT
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       DEBUG
    ------------------------------------------------------- */

    console.log(
      `[submit] ${series}/${testId} attempt=${attemptId} ` +
        `status=${finalStatus} questions=${questions.length} ` +
        `savedAnswers=${savedAnswers.length} ` +
        `correct=${correctCount} wrong=${wrongCount} ` +
        `unanswered=${unansweredCount} score=${finalScore}`
    );

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

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
            totalTimeSeconds,

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