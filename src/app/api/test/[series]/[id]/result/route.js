import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
  jsonError,
} from "@/lib/testSecurity";

/* =========================================================
   GET
   /api/test/[series]/[id]/result?attemptId=123
========================================================= */

export async function GET(
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
      normalizeSeries(rawSeries);

    const testId =
      normalizeId(rawId);

    /* -------------------------------------------------------
       AUTH
       
       Centralized in testSecurity.js.
       
       This validates:
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
       SERIES VALIDATION
    ------------------------------------------------------- */

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
        "Invalid test id.",
        400,
        "INVALID_TEST_ID"
      );
    }

    /* -------------------------------------------------------
       SERIES ACCESS
       
       IMPORTANT:
       
       Paid access is checked from the verified JWT.
       
       No user_series_access entitlement query here.
    ------------------------------------------------------- */

    const accessCheck =
      requireSeriesAccess(
        currentUser,
        series
      );

    if (!accessCheck.ok) {
      return accessCheck.response;
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
      test,
      config: securityConfig,
    } = testResult;

    /* -------------------------------------------------------
       KEEP EXISTING TABLE ALIASES
       
       The result SQL below uses:
         attempts
         sections
         questions
         answers
         options
       
       Central config stores:
         attemptTable
         sectionTable
         questionTable
         answerTable
         optionTable
    ------------------------------------------------------- */

    const config = {
      ...securityConfig,

      attempts:
        securityConfig.attemptTable,

      sections:
        securityConfig.sectionTable,

      questions:
        securityConfig.questionTable,

      answers:
        securityConfig.answerTable,

      options:
        securityConfig.optionTable,
    };

    /* -------------------------------------------------------
       ATTEMPT ID
    ------------------------------------------------------- */

    const url =
      new URL(request.url);

    const attemptId =
      normalizeId(
        url.searchParams.get(
          "attemptId"
        )
      );

    if (!attemptId) {
      return jsonError(
        "Invalid attempt id.",
        400,
        "INVALID_ATTEMPT_ID"
      );
    }

    /* -------------------------------------------------------
       ATTEMPT
       
       Verify:
       - attempt exists
       - belongs to current user
       - belongs to current test
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
            score,
            total_marks,
            correct_count,
            wrong_count,
            unanswered_count,
            time_taken_seconds,
            created_at

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
       SUBMISSION STATUS
       
       Result is available only after the attempt has
       actually been submitted / auto-submitted / expired.
    ------------------------------------------------------- */

    if (
      ![
        "submitted",
        "auto_submitted",
        "expired",
      ].includes(
        String(
          attempt.status
        )
      )
    ) {
      return jsonError(
        "This attempt has not been submitted yet.",
        409,
        "ATTEMPT_NOT_SUBMITTED"
      );
    }

    /* =======================================================
       SECTIONS
    ======================================================= */

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

          FROM ${config.sections}

          WHERE test_id = ?

          ORDER BY
            section_order ASC
        `,

        args: [
          testId,
        ],
      });

    /* =======================================================
       QUESTION-WISE ANALYSIS
    ======================================================= */

    const questionsResult =
      await db.execute({
        sql: `
          SELECT
            q.id,
            q.section_id,
            q.question_text,
            q.explanation,
            q.question_type,
            q.marks,
            q.negative_marks,
            q.question_order,

            a.selected_option_id,
            a.is_correct,
            a.marks_obtained,
            a.time_spent_seconds,
            a.visited,
            a.marked_for_review,
            a.answered_at,

            selected_opt.option_label
              AS selected_option_label,

            selected_opt.option_text
              AS selected_option_text,

            correct_opt.id
              AS correct_option_id,

            correct_opt.option_label
              AS correct_option_label,

            correct_opt.option_text
              AS correct_option_text

          FROM ${config.questions} q

          LEFT JOIN ${config.answers} a
            ON a.question_id = q.id
            AND a.attempt_id = ?

          LEFT JOIN ${config.options} selected_opt
            ON selected_opt.id =
              a.selected_option_id

            AND selected_opt.question_id =
              q.id

          LEFT JOIN ${config.options} correct_opt
            ON correct_opt.question_id =
              q.id

            AND correct_opt.is_correct = 1

          WHERE
            q.test_id = ?

          ORDER BY
            q.question_order ASC
        `,

        args: [
          attemptId,
          testId,
        ],
      });

    /* -------------------------------------------------------
       NORMALIZE QUESTIONS
    ------------------------------------------------------- */

    const questions =
      (
        questionsResult.rows ||
        []
      ).map(
        (row) => ({
          id:
            Number(row.id),

          sectionId:
            row.section_id == null
              ? null
              : Number(
                  row.section_id
                ),

          questionText:
            row.question_text,

          explanation:
            row.explanation ||
            "",

          questionType:
            row.question_type ||
            "mcq",

          marks:
            Number(
              row.marks ||
                0
            ),

          negativeMarks:
            Number(
              row.negative_marks ||
                0
            ),

          /*
           * Stable original position of the question.
           */
          questionOrder:
            Number(
              row.question_order ||
                0
            ),

          selectedOptionId:
            row.selected_option_id ==
              null
              ? null
              : Number(
                  row.selected_option_id
                ),

          selectedOptionLabel:
            row.selected_option_label ||
            null,

          selectedOptionText:
            row.selected_option_text ||
            null,

          correctOptionId:
            row.correct_option_id ==
              null
              ? null
              : Number(
                  row.correct_option_id
                ),

          correctOptionLabel:
            row.correct_option_label ||
            null,

          correctOptionText:
            row.correct_option_text ||
            null,

          isCorrect:
            row.is_correct == null
              ? null
              : Number(
                  row.is_correct
                ) === 1,

          marksObtained:
            Number(
              row.marks_obtained ||
                0
            ),

          timeSpentSeconds:
            Number(
              row.time_spent_seconds ||
                0
            ),

          visited:
            Number(
              row.visited ||
                0
            ) === 1,

          markedForReview:
            Number(
              row.marked_for_review ||
                0
            ) === 1,

          answeredAt:
            row.answered_at ||
            null,
        })
      );

    /* =======================================================
       SECTION ANALYSIS
    ======================================================= */

    const sectionAnalysis =
      (
        sectionsResult.rows ||
        []
      ).map(
        (section) => {
          const sectionQuestions =
            questions.filter(
              (question) =>
                Number(
                  question.sectionId
                ) ===
                Number(
                  section.id
                )
            );

          const answered =
            sectionQuestions.filter(
              (question) =>
                question.selectedOptionId !=
                null
            ).length;

          const correct =
            sectionQuestions.filter(
              (question) =>
                question.isCorrect ===
                true
            ).length;

          const wrong =
            sectionQuestions.filter(
              (question) =>
                question.isCorrect ===
                  false &&
                question.selectedOptionId !=
                  null
            ).length;

          const unanswered =
            sectionQuestions.length -
            answered;

          const sectionScore =
            sectionQuestions.reduce(
              (
                sum,
                question
              ) =>
                sum +
                Number(
                  question.marksObtained ||
                    0
                ),
              0
            );

          const timeTaken =
            sectionQuestions.reduce(
              (
                sum,
                question
              ) =>
                sum +
                Number(
                  question.timeSpentSeconds ||
                    0
                ),
              0
            );

          return {
            id:
              Number(
                section.id
              ),

            sectionName:
              section.section_name,

            sectionOrder:
              Number(
                section.section_order ||
                  0
              ),

            durationMinutes:
              section.duration_minutes ==
              null
                ? null
                : Number(
                    section.duration_minutes
                  ),

            questionCount:
              sectionQuestions.length,

            answered,

            correct,

            wrong,

            unanswered,

            score:
              Number(
                sectionScore.toFixed(
                  2
                )
              ),

            timeTakenSeconds:
              timeTaken,
          };
        }
      );

    /* =======================================================
       OVERALL STATISTICS
    ======================================================= */

    const totalQuestions =
      questions.length;

    const attempted =
      Number(
        attempt.correct_count ||
          0
      ) +
      Number(
        attempt.wrong_count ||
          0
      );

    const accuracy =
      attempted > 0
        ? Number(
            (
              (Number(
                attempt.correct_count ||
                  0
              ) /
                attempted) *
              100
            ).toFixed(2)
          )
        : 0;

    /* =======================================================
       TEST NORMALIZATION
       
       getTestById() returns raw DB test columns.
       Keep result response compatible with the existing
       frontend shape.
    ======================================================= */

    const normalizedTest = {
      ...test,

      id:
        Number(
          test.id
        ),

      title:
        test.title ||
        test.name ||
        `Test ${testId}`,

      durationMinutes:
        Number(
          test.duration_minutes ??
            test.durationMinutes ??
            0
        ),

      totalQuestions:
        Number(
          test.total_questions ??
            test.totalQuestions ??
            totalQuestions
        ),

      totalMarks:
        Number(
          test.total_marks ??
            test.totalMarks ??
            0
        ),

      categoryId:
        test.category_id ??
        test.categoryId ??
        null,
    };

    /* =======================================================
       RESULT
    ======================================================= */

    const result = {
      attemptId:
        Number(
          attempt.id
        ),

      testId:
        Number(
          attempt.test_id
        ),

      attemptNumber:
        Number(
          attempt.attempt_number ||
            1
        ),

      status:
        attempt.status,

      startedAt:
        attempt.started_at,

      submittedAt:
        attempt.submitted_at,

      score:
        Number(
          attempt.score ||
            0
        ),

      totalMarks:
        Number(
          attempt.total_marks ||
            normalizedTest.totalMarks ||
            0
        ),

      correct:
        Number(
          attempt.correct_count ||
            0
        ),

      wrong:
        Number(
          attempt.wrong_count ||
            0
        ),

      unanswered:
        Number(
          attempt.unanswered_count ||
            0
        ),

      attempted,

      totalQuestions,

      accuracy,

      timeTakenSeconds:
        Number(
          attempt.time_taken_seconds ||
            0
        ),

      test:
        normalizedTest,

      sections:
        sectionAnalysis,

      questions,
    };

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      result,
    });
  } catch (error) {
    console.error(
      "Result API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load result.",
      },
      {
        status: 500,
      }
    );
  }
}