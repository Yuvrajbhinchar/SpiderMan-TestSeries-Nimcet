import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  toNumber,
  toBoolean,
  firstDefined,
  toIsoUtc,
  jsonError,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
  getTestCategory,
} from "@/lib/testSecurity";

/* =========================================================
   GET
   /api/test/[series]/[id]/analysis?attemptId=123
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
      normalizeSeries(
        rawSeries
      );

    const testId =
      normalizeId(
        rawId
      );

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const attemptId =
      normalizeId(
        searchParams.get(
          "attemptId"
        )
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

    if (!attemptId) {
      return jsonError(
        "Attempt ID is required.",
        400,
        "ATTEMPT_ID_REQUIRED"
      );
    }

    /* -------------------------------------------------------
       CENTRAL AUTH
       
       This checks:
       - JWT
       - database user
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
       CENTRAL SERIES ACCESS
       
       Paid entitlement is read from the verified JWT
       snapshot.
       
       No user_series_access request-time entitlement query.
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
       CENTRAL TEST LOOKUP
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
      config,
      test: testRow,
    } = testResult;

    /* -------------------------------------------------------
       CATEGORY
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
          SELECT *
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

    const attemptRow =
      attemptResult.rows?.[0];

    if (!attemptRow) {
      return jsonError(
        "Attempt not found.",
        404,
        "ATTEMPT_NOT_FOUND"
      );
    }

    /* -------------------------------------------------------
       ONLY COMPLETED ATTEMPTS
    ------------------------------------------------------- */

    const attemptStatus =
      String(
        firstDefined(
          attemptRow.status,
          ""
        )
      )
        .trim()
        .toLowerCase();

    const completedStatuses =
      new Set([
        "submitted",
        "auto_submitted",
      ]);

    if (
      !completedStatuses.has(
        attemptStatus
      )
    ) {
      return jsonError(
        "Detailed analysis is available only after the test is submitted.",
        403,
        "ATTEMPT_NOT_COMPLETED"
      );
    }

    /* =======================================================
       SECTIONS
    ======================================================= */

    const sectionResult =
      await db.execute({
        sql: `
          SELECT *
          FROM ${config.sectionTable}
          WHERE test_id = ?
          ORDER BY
            section_order ASC,
            id ASC
        `,

        args: [
          testId,
        ],
      });

    const rawSections =
      Array.isArray(
        sectionResult.rows
      )
        ? sectionResult.rows
        : [];

    const sections =
      rawSections.map(
        (
          section,
          index
        ) => ({
          id:
            Number(
              section.id
            ),

          testId:
            Number(
              firstDefined(
                section.test_id,
                section.testId,
                testId
              )
            ),

          sectionName:
            firstDefined(
              section.section_name,
              section.sectionName,
              `Section ${
                index + 1
              }`
            ),

          sectionOrder:
            Number(
              firstDefined(
                section.section_order,
                section.sectionOrder,
                index + 1
              )
            ),

          durationMinutes:
            firstDefined(
              section.duration_minutes,
              section.durationMinutes
            ) === null
              ? null
              : Number(
                  firstDefined(
                    section.duration_minutes,
                    section.durationMinutes
                  )
                ),

          questionCount:
            Number(
              firstDefined(
                section.question_count,
                section.questionCount,
                0
              )
            ),

          isSequential:
            toBoolean(
              firstDefined(
                section.is_sequential,
                section.isSequential,
                0
              )
            ),

          timerGroup:
            firstDefined(
              section.timer_group,
              section.timerGroup,
              null
            ),
        })
      );

    /* =======================================================
       QUESTIONS
    ======================================================= */

    const questionResult =
      await db.execute({
        sql: `
          SELECT *
          FROM ${config.questionTable}
          WHERE test_id = ?
          ORDER BY
            question_order ASC,
            id ASC
        `,

        args: [
          testId,
        ],
      });

    const rawQuestions =
      Array.isArray(
        questionResult.rows
      )
        ? questionResult.rows
        : [];

    const questionIds =
      rawQuestions
        .map(
          (
            question
          ) =>
            Number(
              question.id
            )
        )
        .filter(
          (
            questionId
          ) =>
            Number.isInteger(
              questionId
            ) &&
            questionId > 0
        );

    /* =======================================================
       OPTIONS
    ======================================================= */

    let rawOptions = [];

    if (
      questionIds.length >
      0
    ) {
      const placeholders =
        questionIds
          .map(
            () => "?"
          )
          .join(",");

      const optionsResult =
        await db.execute({
          sql: `
            SELECT *
            FROM ${config.optionTable}
            WHERE
              question_id IN (${placeholders})
            ORDER BY
              question_id ASC,
              option_order ASC,
              id ASC
          `,

          args:
            questionIds,
        });

      rawOptions =
        Array.isArray(
          optionsResult.rows
        )
          ? optionsResult.rows
          : [];
    }

    /* =======================================================
       SAVED ANSWERS
    ======================================================= */

    const answerResult =
      await db.execute({
        sql: `
          SELECT *
          FROM ${config.answerTable}
          WHERE attempt_id = ?
          ORDER BY question_id ASC
        `,

        args: [
          attemptId,
        ],
      });

    const rawAnswers =
      Array.isArray(
        answerResult.rows
      )
        ? answerResult.rows
        : [];

    const answersByQuestion =
      new Map();

    for (
      const answer of
        rawAnswers
    ) {
      const questionId =
        Number(
          firstDefined(
            answer.question_id,
            answer.questionId
          )
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
        {
          selectedOptionId:
            firstDefined(
              answer.selected_option_id,
              answer.selectedOptionId
            ) === null
              ? null
              : Number(
                  firstDefined(
                    answer.selected_option_id,
                    answer.selectedOptionId
                  )
                ),

          isCorrect:
            answer.is_correct ===
              null ||
            answer.is_correct ===
              undefined
              ? null
              : toBoolean(
                  answer.is_correct
                ),

          marksObtained:
            toNumber(
              answer.marks_obtained,
              0
            ),

          timeSpentSeconds:
            toNumber(
              firstDefined(
                answer.time_spent_seconds,
                answer.timeSpentSeconds
              ),
              0
            ),

          answeredAt:
            toIsoUtc(
              firstDefined(
                answer.answered_at,
                answer.answeredAt
              )
            ),

          visited:
            toBoolean(
              firstDefined(
                answer.visited,
                0
              )
            ),

          markedForReview:
            toBoolean(
              firstDefined(
                answer.marked_for_review,
                answer.markedForReview,
                0
              )
            ),
        }
      );
    }

    /* =======================================================
       OPTION MAP
    ======================================================= */

    const optionsByQuestion =
      new Map();

    for (
      const option of rawOptions
    ) {
      const questionId =
        Number(
          firstDefined(
            option.question_id,
            option.questionId
          )
        );

      if (
        !Number.isInteger(
          questionId
        ) ||
        questionId <= 0
      ) {
        continue;
      }

      if (
        !optionsByQuestion.has(
          questionId
        )
      ) {
        optionsByQuestion.set(
          questionId,
          []
        );
      }

      optionsByQuestion
        .get(questionId)
        .push({
          id:
            Number(
              option.id
            ),

          label:
            firstDefined(
              option.option_label,
              option.optionLabel,
              ""
            ),

          text:
            firstDefined(
              option.option_text,
              option.optionText,
              option.text,
              ""
            ),

          isCorrect:
            toBoolean(
              option.is_correct
            ),

          optionOrder:
            Number(
              firstDefined(
                option.option_order,
                option.optionOrder,
                0
              )
            ),
        });
    }

    /* =======================================================
       SECTION MAP
    ======================================================= */

    const sectionMap =
      new Map();

    for (
      const section of
        sections
    ) {
      sectionMap.set(
        Number(
          section.id
        ),
        section
      );
    }

    /* =======================================================
       QUESTION ANALYSIS
    ======================================================= */

    const questions =
      rawQuestions.map(
        (
          question,
          index
        ) => {
          const questionId =
            Number(
              question.id
            );

          const sectionId =
            firstDefined(
              question.section_id,
              question.sectionId
            ) === null
              ? null
              : Number(
                  firstDefined(
                    question.section_id,
                    question.sectionId
                  )
                );

          const saved =
            answersByQuestion.get(
              questionId
            );

          const options =
            optionsByQuestion.get(
              questionId
            ) || [];

          const correctOption =
            options.find(
              (
                option
              ) =>
                option.isCorrect
            ) || null;

          const selectedOption =
            saved?.selectedOptionId
              ? options.find(
                  (
                    option
                  ) =>
                    option.id ===
                    saved.selectedOptionId
                ) || null
              : null;

          /*
           * --------------------------------------------------
           * STABLE QUESTION NUMBER
           * --------------------------------------------------
           *
           * question_order is the real test order.
           *
           * number is the stable value consumed by the
           * analysis palette.
           *
           * It does NOT change when the frontend filters
           * the question array.
           * --------------------------------------------------
           */

          const questionOrder =
            Number(
              firstDefined(
                question.question_order,
                question.questionOrder,
                index + 1
              )
            );

          return {
            id:
              questionId,

            testId:
              Number(
                firstDefined(
                  question.test_id,
                  question.testId,
                  testId
                )
              ),

            sectionId,

            sectionName:
              sectionId !== null
                ? sectionMap.get(
                    sectionId
                  )
                    ?.sectionName ||
                  null
                : null,

            questionOrder,

            /*
             * Phase 2:
             * analysis palette uses this.
             */
            number:
              questionOrder,

            questionText:
              firstDefined(
                question.question_text,
                question.questionText,
                question.text,
                ""
              ),

            /*
             * Question image support.
             */
            questionImageUrl:
              firstDefined(
                question.question_image_url,
                question.questionImageUrl,
                null
              ),

            explanation:
              firstDefined(
                question.explanation,
                null
              ),

            questionType:
              String(
                firstDefined(
                  question.question_type,
                  question.questionType,
                  "mcq"
                )
              )
                .trim()
                .toLowerCase(),

            marks:
              Number(
                firstDefined(
                  question.marks,
                  0
                )
              ),

            negativeMarks:
              Number(
                firstDefined(
                  question.negative_marks,
                  question.negativeMarks,
                  0
                )
              ),

            options:
              options.map(
                (
                  option
                ) => ({
                  id:
                    option.id,

                  label:
                    option.label,

                  text:
                    option.text,

                  optionLabel:
                    option.label,

                  optionText:
                    option.text,

                  optionOrder:
                    option.optionOrder,
                })
              ),

            selectedOptionId:
              saved
                ? saved.selectedOptionId
                : null,

            selectedOption:
              selectedOption
                ? {
                    id:
                      selectedOption.id,

                    label:
                      selectedOption.label,

                    text:
                      selectedOption.text,
                  }
                : null,

            correctOption:
              correctOption
                ? {
                    id:
                      correctOption.id,

                    label:
                      correctOption.label,

                    text:
                      correctOption.text,
                  }
                : null,

            isCorrect:
              saved?.isCorrect ??
              null,

            marksObtained:
              saved?.marksObtained ??
              0,

            timeSpentSeconds:
              saved?.timeSpentSeconds ??
              0,

            answeredAt:
              saved?.answeredAt ??
              null,

            visited:
              saved?.visited ??
              false,

            markedForReview:
              saved?.markedForReview ??
              false,
          };
        }
      );

    /* =======================================================
       SCORE SUMMARY
    ======================================================= */

    let totalScore = 0;

    let correctCount = 0;

    let wrongCount = 0;

    let unansweredCount =
      0;

    let totalTimeSpentSeconds =
      0;

    for (
      const question of
        questions
    ) {
      totalScore += Number(
        question.marksObtained ||
          0
      );

      totalTimeSpentSeconds +=
        Number(
          question.timeSpentSeconds ||
            0
        );

      if (
        question.isCorrect ===
        true
      ) {
        correctCount++;
      } else if (
        question.isCorrect ===
        false
      ) {
        wrongCount++;
      } else {
        unansweredCount++;
      }
    }

    /* =======================================================
       TEST META
    ======================================================= */

    const categorySlug =
      String(
        firstDefined(
          category?.slug,
          ""
        )
      )
        .trim()
        .toLowerCase();

    const categoryName =
      firstDefined(
        category?.name,
        null
      );

    const totalQuestions =
      Number(
        firstDefined(
          testRow.total_questions,
          testRow.totalQuestions,
          questions.length
        )
      );

    const totalMarks =
      Number(
        firstDefined(
          testRow.total_marks,
          testRow.totalMarks,
          0
        )
      );

    const durationMinutes =
      Number(
        firstDefined(
          testRow.duration_minutes,
          testRow.durationMinutes,
          0
        )
      );

    const test = {
      id:
        testId,

      series,

      seriesId:
        config.seriesId,

      title:
        firstDefined(
          testRow.title,
          testRow.name,
          `Test ${testId}`
        ),

      slug:
        firstDefined(
          testRow.slug,
          null
        ),

      description:
        firstDefined(
          testRow.description,
          ""
        ),

      categoryId:
        category
          ? Number(
              category.id
            )
          : normalizeId(
              firstDefined(
                testRow.category_id,
                testRow.categoryId
              )
            ),

      categorySlug,

      categoryName,

      durationMinutes,

      totalQuestions,

      totalMarks,

      isPublished:
        toBoolean(
          firstDefined(
            testRow.is_published,
            testRow.isPublished,
            1
          )
        ),
    };

    /* =======================================================
       RESPONSE
    ======================================================= */

    return NextResponse.json(
      {
        success: true,

        test,

        attempt: {
          id:
            Number(
              attemptRow.id
            ),

          userId:
            Number(
              attemptRow.user_id
            ),

          testId:
            Number(
              attemptRow.test_id
            ),

          attemptNumber:
            Number(
              attemptRow.attempt_number
            ),

          status:
            attemptStatus,

          startedAt:
            toIsoUtc(
              attemptRow.started_at
            ),

          submittedAt:
            toIsoUtc(
              attemptRow.submitted_at
            ),

          deadlineAt:
            toIsoUtc(
              attemptRow.deadline_at
            ),

          score:
            attemptRow.score ===
              null ||
            attemptRow.score ===
              undefined
              ? null
              : Number(
                  attemptRow.score
                ),

          totalMarks:
            Number(
              firstDefined(
                attemptRow.total_marks,
                totalMarks,
                0
              )
            ),

          correctCount:
            Number(
              firstDefined(
                attemptRow.correct_count,
                correctCount,
                0
              )
            ),

          wrongCount:
            Number(
              firstDefined(
                attemptRow.wrong_count,
                wrongCount,
                0
              )
            ),

          unansweredCount:
            Number(
              firstDefined(
                attemptRow.unanswered_count,
                unansweredCount,
                0
              )
            ),

          timeTakenSeconds:
            Number(
              firstDefined(
                attemptRow.time_taken_seconds,
                totalTimeSpentSeconds,
                0
              )
            ),
        },

        summary: {
          score:
            Number(
              attemptRow.score ??
                totalScore
            ),

          totalMarks,

          correctCount,

          wrongCount,

          unansweredCount,

          totalQuestions,

          totalTimeSpentSeconds,
        },

        sections,

        questions,

        meta: {
          series,

          seriesId:
            config.seriesId,

          testId,

          attemptId,

          questionCount:
            questions.length,

          sectionCount:
            sections.length,

          categorySlug,

          categoryName,

          attemptStatus:
            attemptStatus,
        },
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
      "[analysis GET] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load analysis.",
      },
      {
        status: 500,
      }
    );
  }
}