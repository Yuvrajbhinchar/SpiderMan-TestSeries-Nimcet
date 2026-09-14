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
  requireTestAvailability,
} from "@/lib/testSecurity";

/* =========================================================
   GET
   /api/test/[series]/[id]/attempt?attemptId=123

   IMPORTANT:
   Existing/in-progress attempts are allowed to load even
   when the test has subsequently been made inactive.

   This is intentional.
========================================================= */

export async function GET(
  request,
  { params }
) {
  try {
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
       AUTH
    ------------------------------------------------------- */

    const auth =
      await requireAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
      user,
      currentUser,
    } = auth;

    /* -------------------------------------------------------
       SERIES ACCESS
       
       Paid access remains JWT based.
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
      config,
      test: testRow,
    } = testResult;

    const category =
      await getTestCategory(
        testRow
      );

        /* -------------------------------------------------------
       ATTEMPT
    ------------------------------------------------------- */

    /* -------------------------------------------------------
       PERFORMANCE FIX (parallelize independent reads):

       attempt / sections / questions / saved-answers each
       only depend on values we already have from the URL
       (testId, attemptId, userId) — none of them depend on
       another one's result. They used to run as 4 sequential
       round trips; now they fire together and we wait once.

       The OPTIONS query further below stays sequential,
       since it genuinely needs the question ids that come
       out of questionResult.
    ------------------------------------------------------- */

    const [
      attemptResult,
      sectionResult,
      questionResult,
      answerResult,
    ] = await Promise.all([
      db.execute({
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
      }),

      db.execute({
        sql: `
          SELECT *
          FROM ${config.sectionTable}

          WHERE
            test_id = ?

          ORDER BY
            section_order ASC,
            id ASC
        `,

        args: [
          testId,
        ],
      }),

      db.execute({
        sql: `
          SELECT *
          FROM ${config.questionTable}

          WHERE
            test_id = ?

          ORDER BY
            question_order ASC,
            id ASC
        `,

        args: [
          testId,
        ],
      }),

      db.execute({
        sql: `
          SELECT *
          FROM ${config.answerTable}

          WHERE
            attempt_id = ?

          ORDER BY
            question_id ASC
        `,

        args: [
          attemptId,
        ],
      }),
    ]);

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
       BASIC USER CHECK
    ------------------------------------------------------- */

    if (!user?.id) {
      return jsonError(
        "Invalid authenticated user.",
        401,
        "INVALID_USER"
      );
    }

    /* -------------------------------------------------------
       ATTEMPT STATUS
    ------------------------------------------------------- */

    const status =
      String(
        firstDefined(
          attemptRow.status,
          "in_progress"
        )
      ).toLowerCase();

    const normalizedAttempt = {
      id:
        Number(
          attemptRow.id
        ),

      userId:
        Number(
          firstDefined(
            attemptRow.user_id,
            attemptRow.userId
          )
        ),

      testId:
        Number(
          firstDefined(
            attemptRow.test_id,
            attemptRow.testId
          )
        ),

      eventId:
        firstDefined(
          attemptRow.event_id,
          attemptRow.eventId,
          null
        ) === null
          ? null
          : Number(
              firstDefined(
                attemptRow.event_id,
                attemptRow.eventId
              )
            ),

      attemptNumber:
        Number(
          firstDefined(
            attemptRow.attempt_number,
            attemptRow.attemptNumber,
            1
          )
        ),

      status,

      startedAt:
        toIsoUtc(
          firstDefined(
            attemptRow.started_at,
            attemptRow.startedAt
          )
        ),

      submittedAt:
        toIsoUtc(
          firstDefined(
            attemptRow.submitted_at,
            attemptRow.submittedAt
          )
        ),

      deadlineAt:
        toIsoUtc(
          firstDefined(
            attemptRow.deadline_at,
            attemptRow.deadlineAt
          )
        ),

      score:
        toNumber(
          attemptRow.score,
          null
        ),

      totalMarks:
        toNumber(
          firstDefined(
            attemptRow.total_marks,
            attemptRow.totalMarks
          ),
          0
        ),

      correctCount:
        toNumber(
          firstDefined(
            attemptRow.correct_count,
            attemptRow.correctCount
          ),
          0
        ),

      wrongCount:
        toNumber(
          firstDefined(
            attemptRow.wrong_count,
            attemptRow.wrongCount
          ),
          0
        ),

      unansweredCount:
        toNumber(
          firstDefined(
            attemptRow.unanswered_count,
            attemptRow.unansweredCount
          ),
          0
        ),

      timeTakenSeconds:
        toNumber(
          firstDefined(
            attemptRow.time_taken_seconds,
            attemptRow.timeTakenSeconds
          ),
          0
        ),

      createdAt:
        toIsoUtc(
          firstDefined(
            attemptRow.created_at,
            attemptRow.createdAt
          )
        ),
    };

    /* =======================================================
       SECTIONS
    ======================================================= */

  
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


    const rawQuestions =
      Array.isArray(
        questionResult.rows
      )
        ? questionResult.rows
        : [];

    if (
      rawQuestions.length ===
      0
    ) {
      console.error(
        `[attempt GET] No questions for ${series}/${testId}`
      );

      return jsonError(
        "No questions were found for this test.",
        422,
        "NO_QUESTIONS"
      );
    }

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

    let rawOptions =
      [];

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
       OPTIONS BY QUESTION
    ======================================================= */

    const optionsByQuestion =
      new Map();

    for (
      const option of
        rawOptions
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

      const label =
        firstDefined(
          option.option_label,
          option.optionLabel,
          ""
        );

      const text =
        firstDefined(
          option.option_text,
          option.optionText,
          option.text,
          ""
        );

      optionsByQuestion
        .get(
          questionId
        )
        .push({
          id:
            Number(
              option.id
            ),

          label,

          text,

          optionLabel:
            label,

          optionText:
            text,

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
       SAVED ANSWERS
    ======================================================= */

  

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

          timeSpentSeconds:
            Number(
              firstDefined(
                answer.time_spent_seconds,
                answer.timeSpentSeconds,
                0
              )
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
       QUESTIONS NORMALIZED
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

            questionText:
              firstDefined(
                question.question_text,
                question.questionText,
                question.text,
                ""
              ),

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
              ).toLowerCase(),

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

            questionOrder:
              Number(
                firstDefined(
                  question.question_order,
                  question.questionOrder,
                  index + 1
                )
              ),

            options:
              optionsByQuestion.get(
                questionId
              ) || [],

            selectedOptionId:
              saved?.selectedOptionId ??
              null,

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
       CATEGORY / TIMER FLAGS
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

    const isDpp =
      categorySlug ===
      "dpp";

    const hasTimedSections =
      sections.some(
        (section) =>
          Number(
            section.durationMinutes ||
              0
          ) > 0
      );

    const sectional =
      !isDpp &&
      hasTimedSections &&
      sections.some(
        (section) =>
          Number(
            section.durationMinutes ||
              0
          ) > 0 &&
          Boolean(
            section.timerGroup
          )
      );

    /* =======================================================
       TEST OBJECT
    ======================================================= */

    const test = {
      id:
        testId,

      series,

      seriesId:
        config.seriesId,

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

      isDpp,

      isSectional:
        sectional,

      sectional,

      /*
       * PHASE 5 TEST STATE
       */

      isActive:
        Number(
          firstDefined(
            testRow.is_active,
            testRow.isActive,
            0
          )
        ) === 1,

      isPublished:
        toBoolean(
          firstDefined(
            testRow.is_published,
            testRow.isPublished,
            0
          )
        ),

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

      durationMinutes:
        Number(
          firstDefined(
            testRow.duration_minutes,
            testRow.durationMinutes,
            0
          )
        ),

      totalQuestions:
        Number(
          firstDefined(
            testRow.total_questions,
            testRow.totalQuestions,
            questions.length
          )
        ),

      totalMarks:
        Number(
          firstDefined(
            testRow.total_marks,
            testRow.totalMarks,
            0
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

        attempt:
          normalizedAttempt,

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

          optionCount:
            rawOptions.length,

          sectionCount:
            sections.length,

          savedAnswerCount:
            rawAnswers.length,

          categorySlug,

          isDpp,

          sectional,

          /*
           * GET is intentionally allowed for an existing
           * attempt even when availability changed later.
           */
          availabilityCheckSkipped:
            true,
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
      "[GET attempt] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load test attempt.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   /api/test/[series]/[id]/attempt

   mode = "new"
   mode = "resume"

   PHASE 5 RULE:

   NEW:
     availability required

   RESUME:
     availability NOT required

   Existing active attempt:
     resume even if availability has changed
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

    const mode =
      String(
        body?.mode ||
          "new"
      )
        .trim()
        .toLowerCase();

    const requestedAttemptId =
      normalizeId(
        body?.attemptId
      );

    if (
      mode !== "new" &&
      mode !== "resume"
    ) {
      return jsonError(
        "Invalid attempt mode.",
        400,
        "INVALID_MODE"
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

    const category =
      await getTestCategory(
        testRow
      );

    /* =======================================================
       RESUME SPECIFIC ATTEMPT
       
       IMPORTANT:
       
       Availability is intentionally NOT checked here.
       
       An already-started attempt should remain resumable.
    ======================================================= */

    if (
      mode === "resume"
    ) {
      if (
        !requestedAttemptId
      ) {
        return jsonError(
          "Valid attempt ID is required.",
          400,
          "ATTEMPT_ID_REQUIRED"
        );
      }

      const resumeResult =
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
            requestedAttemptId,
            userId,
            testId,
          ],
        });

      const attempt =
        resumeResult.rows?.[0];

      if (!attempt) {
        return jsonError(
          "Attempt not found.",
          404,
          "ATTEMPT_NOT_FOUND"
        );
      }

      if (
        String(
          attempt.status
        ) !==
        "in_progress"
      ) {
        return jsonError(
          "This attempt is no longer active.",
          409,
          "ATTEMPT_NOT_ACTIVE"
        );
      }

      const startedAt =
        toIsoUtc(
          attempt.started_at
        );

      if (!startedAt) {
        return jsonError(
          "Invalid attempt start time.",
          500,
          "INVALID_START_TIME"
        );
      }

      const deadlineAt =
        toIsoUtc(
          attempt.deadline_at
        );

      console.log(
        `[attempt POST] RESUME ${series}/${testId} attempt=${attempt.id}`
      );

      return NextResponse.json(
        {
          success: true,

          resumed: true,

          mode:
            "resume",

          attempt: {
            id:
              Number(
                attempt.id
              ),

            userId:
              Number(
                attempt.user_id
              ),

            testId:
              Number(
                attempt.test_id
              ),

            attemptNumber:
              Number(
                attempt.attempt_number
              ),

            status:
              "in_progress",

            startedAt,

            started_at:
              startedAt,

            deadlineAt,

            deadline_at:
              deadlineAt,

            submittedAt:
              toIsoUtc(
                attempt.submitted_at
              ),

            score:
              attempt.score ===
              null
                ? null
                : Number(
                    attempt.score
                  ),

            totalMarks:
              Number(
                firstDefined(
                  attempt.total_marks,
                  testRow.total_marks,
                  0
                )
              ),
          },

          test: {
            id:
              testId,

            title:
              firstDefined(
                testRow.title,
                `Test ${testId}`
              ),

            categorySlug:
              String(
                firstDefined(
                  category?.slug,
                  ""
                )
              )
                .trim()
                .toLowerCase(),

            isDpp:
              String(
                firstDefined(
                  category?.slug,
                  ""
                )
              )
                .trim()
                .toLowerCase() ===
              "dpp",

            /*
             * State is returned for frontend awareness,
             * but does not block resume.
             */

            isActive:
              Number(
                firstDefined(
                  testRow.is_active,
                  testRow.isActive,
                  0
                )
              ) === 1,

            isPublished:
              toBoolean(
                firstDefined(
                  testRow.is_published,
                  testRow.isPublished,
                  0
                )
              ),
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
    }

    /* =======================================================
       CHECK EXISTING ACTIVE ATTEMPT
       
       IMPORTANT:
       
       Existing active attempt takes priority over new-test
       availability.
       
       Therefore:
       
       test becomes inactive
       +
       student already has in_progress attempt
       
       => RESUME IT.
    ======================================================= */

    const activeResult =
      await db.execute({
        sql: `
          SELECT *
          FROM ${config.attemptTable}

          WHERE
            user_id = ?
            AND test_id = ?
            AND status = 'in_progress'

          ORDER BY
            id DESC

          LIMIT 1
        `,

        args: [
          userId,
          testId,
        ],
      });

    const activeAttempt =
      activeResult.rows?.[0] ||
      null;

    if (activeAttempt) {
      const startedAt =
        toIsoUtc(
          activeAttempt.started_at
        );

      const deadlineAt =
        toIsoUtc(
          activeAttempt.deadline_at
        );

      console.log(
        `[attempt POST] EXISTING ${series}/${testId} attempt=${activeAttempt.id} -> resume`
      );

      return NextResponse.json(
        {
          success: true,

          resumed: true,

          mode:
            "resume",

          attempt: {
            id:
              Number(
                activeAttempt.id
              ),

            userId:
              Number(
                activeAttempt.user_id
              ),

            testId:
              Number(
                activeAttempt.test_id
              ),

            attemptNumber:
              Number(
                activeAttempt.attempt_number
              ),

            status:
              "in_progress",

            startedAt,

            started_at:
              startedAt,

            deadlineAt,

            deadline_at:
              deadlineAt,
          },

          test: {
            id:
              testId,

            title:
              firstDefined(
                testRow.title,
                `Test ${testId}`
              ),

            categorySlug:
              String(
                firstDefined(
                  category?.slug,
                  ""
                )
              )
                .trim()
                .toLowerCase(),

            isDpp:
              String(
                firstDefined(
                  category?.slug,
                  ""
                )
              )
                .trim()
                .toLowerCase() ===
              "dpp",

            isActive:
              Number(
                firstDefined(
                  testRow.is_active,
                  testRow.isActive,
                  0
                )
              ) === 1,

            isPublished:
              toBoolean(
                firstDefined(
                  testRow.is_published,
                  testRow.isPublished,
                  0
                )
              ),
          },
        },
        {
          status: 200,
        }
      );
    }

    /* =======================================================
       PHASE 5
       
       NEW ATTEMPT AVAILABILITY
       
       This is the FIRST place where the new-attempt flow
       checks:
       
       - series.is_active
       - category.is_active
       - test.is_active
       - test.is_published
       
       No active attempt exists at this point.
    ======================================================= */

    const availability =
      await requireTestAvailability({
        config,

        test:
          testRow,
      });

    if (!availability.ok) {
      return availability.response;
    }

    /* -------------------------------------------------------
       COUNT SUBMITTED ATTEMPTS

       This is used ONLY to build the response payload
       (submittedCount / remainingAttempts / the error
       message text below). It is intentionally NOT the
       thing that decides whether a new attempt is allowed —
       that decision now happens atomically inside the
       INSERT itself (see ATOMIC CREATE ATTEMPT below), so
       two parallel "start test" requests can no longer both
       pass this check and both insert a row.
    ------------------------------------------------------- */

    const submittedResult =
      await db.execute({
        sql: `
          SELECT
            COUNT(*) AS count

          FROM ${config.attemptTable}

          WHERE
            user_id = ?
            AND test_id = ?
            AND status = 'submitted'
        `,

        args: [
          userId,
          testId,
        ],
      });

    const submittedCount =
      Number(
        submittedResult.rows?.[0]
          ?.count || 0
      );

    const maxAttempts =
      3;

    /* =======================================================
       TIMER
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

    const isDpp =
      categorySlug ===
      "dpp";

    const durationMinutes =
      Number(
        firstDefined(
          testRow.duration_minutes,
          testRow.durationMinutes,
          0
        )
      );

    let deadlineAt =
      null;

    if (
      !isDpp &&
      Number.isFinite(
        durationMinutes
      ) &&
      durationMinutes >
        0
    ) {
      const deadlineResult =
        await db.execute({
          sql: `
            SELECT
              datetime(
                CURRENT_TIMESTAMP,
                '+' || ? || ' minutes'
              ) AS deadline_at
          `,

          args: [
            durationMinutes,
          ],
        });

      deadlineAt =
        deadlineResult.rows?.[0]
          ?.deadline_at ||
        null;
    }

       /* =======================================================
       ATOMIC CREATE ATTEMPT

       SECURITY FIX (race condition):

       Previously this was 3 separate round trips:
         1) SELECT to check no active in_progress attempt
         2) SELECT COUNT to check submitted < maxAttempts
         3) SELECT MAX(attempt_number) to pick the next number
         4) INSERT the new attempt

       Two parallel "start test" requests (double-click,
       two tabs, flaky retry) could both pass steps 1-3
       before either finished step 4, letting a student end
       up with more in_progress/total attempts than allowed.

       Fix:

       All of the gating logic (no existing in_progress
       attempt + submitted count under the limit) AND the
       next attempt_number calculation now live inside a
       single INSERT ... SELECT statement. The next number
       is computed in a derived subquery ("next_num"), and
       the gating conditions sit in a plain WHERE on the
       outer SELECT (Turso's SQL parser rejects a bare
       HAVING without GROUP BY, so this avoids that).

       SQLite/Turso only ever runs one write at a time per
       database, so this whole statement is evaluated and
       applied as one atomic unit — a second, concurrent
       request cannot slip in between the check and the
       insert anymore. If the WHERE condition is false
       (an in_progress attempt now exists, or the submitted
       count is already at the limit), the SELECT yields
       zero rows and the INSERT inserts nothing.
    ======================================================= */

    const insertResult =
      await db.execute({
        sql: `
          INSERT INTO ${config.attemptTable} (
            user_id,
            test_id,
            attempt_number,
            status,
            started_at,
            total_marks,
            deadline_at,
            created_at
          )

          SELECT
            ? AS user_id,
            ? AS test_id,
            next_num.val AS attempt_number,
            'in_progress' AS status,
            CURRENT_TIMESTAMP AS started_at,
            ? AS total_marks,
            ? AS deadline_at,
            CURRENT_TIMESTAMP AS created_at

          FROM (
            SELECT
              COALESCE(
                MAX(attempt_number),
                0
              ) + 1 AS val
            FROM ${config.attemptTable}
            WHERE
              user_id = ?
              AND test_id = ?
          ) AS next_num

          WHERE
            NOT EXISTS (
              SELECT 1
              FROM ${config.attemptTable}
              WHERE
                user_id = ?
                AND test_id = ?
                AND status = 'in_progress'
            )
            AND (
              SELECT COUNT(*)
              FROM ${config.attemptTable}
              WHERE
                user_id = ?
                AND test_id = ?
                AND status = 'submitted'
            ) < ?

          RETURNING
            id,
            user_id,
            test_id,
            attempt_number,
            status,
            started_at,
            submitted_at,
            score,
            total_marks,
            correct_count,
            wrong_count,
            unanswered_count,
            time_taken_seconds,
            created_at,
            event_id,
            deadline_at
        `,

        args: [
          userId,

          testId,

          Number(
            firstDefined(
              testRow.total_marks,
              testRow.totalMarks,
              0
            )
          ),

          deadlineAt,

          userId,

          testId,

          userId,

          testId,

          userId,

          testId,

          maxAttempts,
        ],
      });

    if (
      !insertResult.rows ||
      insertResult.rows.length ===
        0
    ) {
      /* -----------------------------------------------------
         The atomic insert produced no row. Find out why so
         we can respond correctly instead of a raw 500 —
         either a concurrent request just created/holds an
         in_progress attempt (race lost -> resume it), or the
         submitted-attempt limit is genuinely exhausted.
      ----------------------------------------------------- */

      const raceCheckResult =
        await db.execute({
          sql: `
            SELECT *
            FROM ${config.attemptTable}

            WHERE
              user_id = ?
              AND test_id = ?
              AND status = 'in_progress'

            ORDER BY
              id DESC

            LIMIT 1
          `,

          args: [
            userId,
            testId,
          ],
        });

      const raceActiveAttempt =
        raceCheckResult.rows?.[0] ||
        null;

      if (raceActiveAttempt) {
        const startedAt =
          toIsoUtc(
            raceActiveAttempt.started_at
          );

        const raceDeadlineAt =
          toIsoUtc(
            raceActiveAttempt.deadline_at
          );

        console.log(
          `[attempt POST] RACE-LOST ${series}/${testId} attempt=${raceActiveAttempt.id} -> resume`
        );

        return NextResponse.json(
          {
            success: true,

            resumed: true,

            mode:
              "resume",

            attempt: {
              id:
                Number(
                  raceActiveAttempt.id
                ),

              userId:
                Number(
                  raceActiveAttempt.user_id
                ),

              testId:
                Number(
                  raceActiveAttempt.test_id
                ),

              attemptNumber:
                Number(
                  raceActiveAttempt.attempt_number
                ),

              status:
                "in_progress",

              startedAt,

              started_at:
                startedAt,

              deadlineAt:
                raceDeadlineAt,

              deadline_at:
                raceDeadlineAt,
            },

            test: {
              id:
                testId,

              title:
                firstDefined(
                  testRow.title,
                  `Test ${testId}`
                ),

              categorySlug,

              isDpp,

              isActive:
                Number(
                  firstDefined(
                    testRow.is_active,
                    testRow.isActive,
                    0
                  )
                ) === 1,

              isPublished:
                toBoolean(
                  firstDefined(
                    testRow.is_published,
                    testRow.isPublished,
                    0
                  )
                ),
            },
          },
          {
            status: 200,
          }
        );
      }

      return jsonError(
        "You have already completed the maximum 3 attempts for this test.",
        403,
        "ATTEMPTS_EXHAUSTED"
      );
    }

    const attempt =
      insertResult.rows[0];

    const startedAt =
      toIsoUtc(
        attempt.started_at
      );

    const normalizedDeadlineAt =
      toIsoUtc(
        attempt.deadline_at
      );

    if (!startedAt) {
      return jsonError(
        "Invalid attempt start time.",
        500,
        "INVALID_START_TIME"
      );
    }

    console.log(
      `[attempt POST] NEW ${series}/${testId} attempt=${attempt.id} attemptNumber=${attempt.attempt_number} dpp=${isDpp} deadline=${normalizedDeadlineAt || "none"}`
    );

    /* =======================================================
       FINAL RESPONSE
    ======================================================= */

    return NextResponse.json(
      {
        success: true,

        resumed: false,

        mode:
          "new",

        attempt: {
          id:
            Number(
              attempt.id
            ),

          userId:
            Number(
              attempt.user_id
            ),

          testId:
            Number(
              attempt.test_id
            ),

          attemptNumber:
            Number(
              attempt.attempt_number
            ),

          attempt_number:
            Number(
              attempt.attempt_number
            ),

          status:
            "in_progress",

          startedAt,

          started_at:
            startedAt,

          submittedAt:
            toIsoUtc(
              attempt.submitted_at
            ),

          submitted_at:
            toIsoUtc(
              attempt.submitted_at
            ),

          score:
            attempt.score ===
            null
              ? null
              : Number(
                  attempt.score
                ),

          totalMarks:
            Number(
              firstDefined(
                attempt.total_marks,
                testRow.total_marks,
                0
              )
            ),

          correctCount:
            Number(
              attempt.correct_count ||
                0
            ),

          wrongCount:
            Number(
              attempt.wrong_count ||
                0
            ),

          unansweredCount:
            Number(
              attempt.unanswered_count ||
                0
            ),

          timeTakenSeconds:
            Number(
              attempt.time_taken_seconds ||
                0
            ),

          createdAt:
            toIsoUtc(
              attempt.created_at
            ),

          eventId:
            attempt.event_id ===
              null ||
            attempt.event_id ===
              undefined
              ? null
              : Number(
                  attempt.event_id
                ),

          deadlineAt:
            normalizedDeadlineAt,

          deadline_at:
            normalizedDeadlineAt,
        },

        submittedCount,

        maxAttempts,

        remainingAttempts:
          Math.max(
            0,
            maxAttempts -
              submittedCount
          ),

        test: {
          id:
            testId,

          title:
            firstDefined(
              testRow.title,
              `Test ${testId}`
            ),

          totalQuestions:
            Number(
              firstDefined(
                testRow.total_questions,
                0
              )
            ),

          totalMarks:
            Number(
              firstDefined(
                testRow.total_marks,
                0
              )
            ),

          durationMinutes,

          categorySlug,

          categoryName:
            category?.name ||
            null,

          isDpp,

          /*
           * New attempt passed all Phase 5
           * availability checks.
           */

          isActive:
            true,

          isPublished:
            true,

          availabilityValidated:
            true,
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
      "[POST attempt] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to start test attempt.",
      },
      {
        status: 500,
      }
    );
  }
}