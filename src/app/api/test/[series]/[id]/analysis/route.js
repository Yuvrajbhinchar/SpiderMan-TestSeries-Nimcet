import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

/* =========================================================
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG = {
  free: {
    seriesId: 1,
    testTable: "free_tests",
    sectionTable: "free_test_sections",
    questionTable: "free_questions",
    optionTable: "free_question_options",
    attemptTable: "free_test_attempts",
    answerTable: "free_attempt_answers",
  },

  asspire: {
    seriesId: 2,
    testTable: "asspire_tests",
    sectionTable: "asspire_test_sections",
    questionTable: "asspire_questions",
    optionTable: "asspire_question_options",
    attemptTable: "asspire_test_attempts",
    answerTable: "asspire_attempt_answers",
  },

  imppetus: {
    seriesId: 3,
    testTable: "imppetus_tests",
    sectionTable: "imppetus_test_sections",
    questionTable: "imppetus_questions",
    optionTable: "imppetus_question_options",
    attemptTable: "imppetus_test_attempts",
    answerTable: "imppetus_attempt_answers",
  },

  spiderman: {
    seriesId: 4,
    testTable: "spiderman_tests",
    sectionTable: "spiderman_test_sections",
    questionTable: "spiderman_questions",
    optionTable: "spiderman_question_options",
    attemptTable: "spiderman_test_attempts",
    answerTable: "spiderman_attempt_answers",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeSeries(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1"
  );
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function toIsoUtc(value) {
  if (!value) {
    return null;
  }

  const text = String(value);

  /*
   * SQLite/Turso format:
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
    return `${text.replace(" ", "T")}Z`;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function jsonError(
  message,
  status = 400,
  code = null
) {
  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
    },
    {
      status,
    }
  );
}

/* =========================================================
   AUTH
========================================================= */

async function getAuthenticatedUser() {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    return {
      ok: false,
      response: jsonError(
        "Please login to continue.",
        401,
        "UNAUTHORIZED"
      ),
    };
  }

  const userId = Number(currentUser.id);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return {
      ok: false,
      response: jsonError(
        "Invalid user session.",
        401,
        "INVALID_SESSION"
      ),
    };
  }

  const userResult = await db.execute({
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

  const user = userResult.rows?.[0];

  if (!user) {
    return {
      ok: false,
      response: jsonError(
        "User account not found.",
        401,
        "USER_NOT_FOUND"
      ),
    };
  }

  if (Number(user.is_active) !== 1) {
    return {
      ok: false,
      response: jsonError(
        "Your account is inactive.",
        403,
        "ACCOUNT_INACTIVE"
      ),
    };
  }

  const jwtSessionId =
    firstDefined(
      currentUser.sessionId,
      currentUser.session_id,
      null
    );

  const jwtDeviceId =
    firstDefined(
      currentUser.deviceId,
      currentUser.device_id,
      null
    );

  if (
    jwtSessionId &&
    user.active_session_id &&
    String(jwtSessionId) !==
      String(user.active_session_id)
  ) {
    return {
      ok: false,
      response: jsonError(
        "Your session is no longer active.",
        401,
        "SESSION_REVOKED"
      ),
    };
  }

  if (
    jwtDeviceId &&
    user.active_device_id &&
    String(jwtDeviceId) !==
      String(user.active_device_id)
  ) {
    return {
      ok: false,
      response: jsonError(
        "This device is no longer active.",
        401,
        "DEVICE_REVOKED"
      ),
    };
  }

  return {
    ok: true,
    user,
    currentUser,
    userId,
  };
}

/* =========================================================
   TEST ACCESS
========================================================= */

async function getTestContext(
  series,
  testId,
  userId
) {
  const config = SERIES_CONFIG[series];

  const testResult = await db.execute({
    sql: `
      SELECT *
      FROM ${config.testTable}
      WHERE id = ?
      LIMIT 1
    `,
    args: [testId],
  });

  const testRow = testResult.rows?.[0];

  if (!testRow) {
    return {
      ok: false,
      response: jsonError(
        "Test not found.",
        404,
        "TEST_NOT_FOUND"
      ),
    };
  }

  /*
   * Free series is always accessible.
   * Paid series require active access.
   */
  let hasAccess = false;

  if (config.seriesId === 1) {
    hasAccess = true;
  } else {
    const accessResult = await db.execute({
      sql: `
        SELECT
          id,
          series_id,
          is_active,
          expires_at
        FROM user_series_access
        WHERE
          user_id = ?
          AND series_id = ?
          AND is_active = 1
        LIMIT 1
      `,
      args: [
        userId,
        config.seriesId,
      ],
    });

    const access =
      accessResult.rows?.[0];

    if (access) {
      if (!access.expires_at) {
        hasAccess = true;
      } else {
        const expiry = new Date(
          toIsoUtc(access.expires_at) ||
            access.expires_at
        );

        hasAccess =
          !Number.isNaN(
            expiry.getTime()
          ) &&
          expiry.getTime() > Date.now();
      }
    }
  }

  if (!hasAccess) {
    return {
      ok: false,
      response: jsonError(
        "You do not have access to this test series.",
        403,
        "SERIES_ACCESS_REQUIRED"
      ),
    };
  }

  /*
   * CATEGORY
   */
  let category = null;

  const categoryId = normalizeId(
    firstDefined(
      testRow.category_id,
      testRow.categoryId
    )
  );

  if (categoryId) {
    try {
      const categoryResult =
        await db.execute({
          sql: `
            SELECT
              id,
              name,
              slug,
              parent_id,
              is_active
            FROM test_categories
            WHERE id = ?
            LIMIT 1
          `,
          args: [categoryId],
        });

      category =
        categoryResult.rows?.[0] ||
        null;
    } catch (error) {
      console.warn(
        "[analysis] Category lookup failed:",
        error
      );
    }
  }

  return {
    ok: true,
    config,
    testRow,
    category,
  };
}

/* =========================================================
   GET
   /api/test/[series]/[id]/analysis?attemptId=123
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
      normalizeSeries(rawSeries);

    const testId =
      normalizeId(rawId);

    const { searchParams } =
      new URL(request.url);

    const attemptId =
      normalizeId(
        searchParams.get("attemptId")
      );

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    if (!SERIES_CONFIG[series]) {
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
      await getAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const { userId } = auth;

    /* -------------------------------------------------------
       TEST ACCESS
    ------------------------------------------------------- */

    const testContext =
      await getTestContext(
        series,
        testId,
        userId
      );

    if (!testContext.ok) {
      return testContext.response;
    }

    const {
      config,
      testRow,
      category,
    } = testContext;

    /* -------------------------------------------------------
       ATTEMPT
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

    const completedStatuses = new Set([
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

    /* -------------------------------------------------------
       SECTIONS
    ------------------------------------------------------- */

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
        args: [testId],
      });

    const rawSections =
      Array.isArray(
        sectionResult.rows
      )
        ? sectionResult.rows
        : [];

    const sections =
      rawSections.map(
        (section, index) => ({
          id: Number(section.id),

          testId: Number(
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
              `Section ${index + 1}`
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

    const sectionMap = new Map();

    for (const section of sections) {
      sectionMap.set(
        Number(section.id),
        section
      );
    }

    /* -------------------------------------------------------
       QUESTIONS

       No section filtering because section_id
       can be NULL.
    ------------------------------------------------------- */

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
        args: [testId],
      });

    const rawQuestions =
      Array.isArray(
        questionResult.rows
      )
        ? questionResult.rows
        : [];

    if (rawQuestions.length === 0) {
      return jsonError(
        "No questions were found for this test.",
        422,
        "NO_QUESTIONS"
      );
    }

    const questionIds =
      rawQuestions
        .map((row) => Number(row.id))
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        );

    /* -------------------------------------------------------
       OPTIONS
    ------------------------------------------------------- */

    let rawOptions = [];

    if (questionIds.length > 0) {
      const placeholders =
        questionIds
          .map(() => "?")
          .join(",");

      const optionResult =
        await db.execute({
          sql: `
            SELECT *
            FROM ${config.optionTable}
            WHERE question_id IN (${placeholders})
            ORDER BY
              question_id ASC,
              option_order ASC,
              id ASC
          `,
          args: questionIds,
        });

      rawOptions =
        Array.isArray(
          optionResult.rows
        )
          ? optionResult.rows
          : [];
    }

    const optionsByQuestion =
      new Map();

    for (const option of rawOptions) {
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
          id: Number(option.id),

          label: firstDefined(
            option.option_label,
            option.optionLabel,
            ""
          ),

          text: firstDefined(
            option.option_text,
            option.optionText,
            option.text,
            ""
          ),

          order: Number(
            firstDefined(
              option.option_order,
              option.optionOrder,
              0
            )
          ),

          isCorrect:
            Number(
              firstDefined(
                option.is_correct,
                option.isCorrect,
                0
              )
            ) === 1,
        });
    }

    /* -------------------------------------------------------
       ANSWERS
    ------------------------------------------------------- */

    const answerResult =
      await db.execute({
        sql: `
          SELECT *
          FROM ${config.answerTable}
          WHERE attempt_id = ?
          ORDER BY
            question_id ASC
        `,
        args: [attemptId],
      });

    const rawAnswers =
      Array.isArray(
        answerResult.rows
      )
        ? answerResult.rows
        : [];

    const answersByQuestion =
      new Map();

    for (const answer of rawAnswers) {
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

      const selectedValue =
        firstDefined(
          answer.selected_option_id,
          answer.selectedOptionId,
          null
        );

      answersByQuestion.set(
        questionId,
        {
          selectedOptionId:
            selectedValue ===
              null ||
            selectedValue ===
              ""
              ? null
              : Number(
                  selectedValue
                ),

          isCorrect:
            answer.is_correct ===
                null ||
            answer.is_correct ===
                undefined
              ? null
              : Number(
                  answer.is_correct
                ) === 1,

          marksObtained:
            Number(
              firstDefined(
                answer.marks_obtained,
                answer.marksObtained,
                0
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
                answer.answeredAt,
                null
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

    /* -------------------------------------------------------
       TEST METADATA
    ------------------------------------------------------- */

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

    const normalizedTest = {
      id: testId,

      title: firstDefined(
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

      totalQuestions:
        Number(
          firstDefined(
            testRow.total_questions,
            testRow.totalQuestions,
            rawQuestions.length
          )
        ),

      totalMarks:
        Number(
          firstDefined(
            testRow.total_marks,
            testRow.totalMarks,
            attemptRow.total_marks,
            0
          )
        ),

      durationMinutes:
        Number(
          firstDefined(
            testRow.duration_minutes,
            testRow.durationMinutes,
            0
          )
        ),

      series,

      seriesId:
        config.seriesId,

      categoryName,

      categorySlug,

      isDpp:
        categorySlug === "dpp",
    };

    /* -------------------------------------------------------
       ATTEMPT METADATA
    ------------------------------------------------------- */

    const normalizedAttempt = {
      id: Number(attemptRow.id),

      userId: Number(
        firstDefined(
          attemptRow.user_id,
          attemptRow.userId,
          userId
        )
      ),

      testId: Number(
        firstDefined(
          attemptRow.test_id,
          attemptRow.testId,
          testId
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

      status:
        attemptStatus,

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

      score:
        toNumber(
          attemptRow.score,
          0
        ),

      totalMarks:
        toNumber(
          firstDefined(
            attemptRow.total_marks,
            attemptRow.totalMarks,
            testRow.total_marks
          ),
          0
        ),

      correct:
        toNumber(
          firstDefined(
            attemptRow.correct_count,
            attemptRow.correctCount,
            0
          ),
          0
        ),

      wrong:
        toNumber(
          firstDefined(
            attemptRow.wrong_count,
            attemptRow.wrongCount,
            0
          ),
          0
        ),

      unanswered:
        toNumber(
          firstDefined(
            attemptRow.unanswered_count,
            attemptRow.unansweredCount,
            0
          ),
          0
        ),

      timeTakenSeconds:
        toNumber(
          firstDefined(
            attemptRow.time_taken_seconds,
            attemptRow.timeTakenSeconds,
            0
          ),
          0
        ),
    };

    /* -------------------------------------------------------
       QUESTIONS NORMALIZED
    ------------------------------------------------------- */

    const questions =
      rawQuestions.map(
        (question, index) => {
          const questionId =
            Number(question.id);

          const sectionIdRaw =
            firstDefined(
              question.section_id,
              question.sectionId,
              null
            );

          const sectionId =
            sectionIdRaw === null
              ? null
              : Number(
                  sectionIdRaw
                );

          const answer =
            answersByQuestion.get(
              questionId
            ) || null;

          const options =
            optionsByQuestion.get(
              questionId
            ) || [];

          const selectedOptionId =
            answer?.selectedOptionId ??
            null;

          const selectedOption =
            selectedOptionId ===
              null
              ? null
              : options.find(
                  (option) =>
                    Number(option.id) ===
                    Number(
                      selectedOptionId
                    )
                ) || null;

          const correctOptions =
            options.filter(
              (option) =>
                option.isCorrect
            );

          /*
           * The client gets the answer key here
           * because this is a completed-attempt
           * review endpoint.
           *
           * isCorrect is kept only on the analysis
           * endpoint and is NOT present in attempt
           * bootstrap response.
           */
          const correctOption =
            correctOptions[0] ||
            null;

          const resultStatus =
            selectedOptionId === null
              ? "unanswered"
              : answer?.isCorrect === true
                ? "correct"
                : answer?.isCorrect === false
                  ? "wrong"
                  : "unanswered";

          /*
           * Current question schema does not contain
           * subject_id in the series tables.
           *
           * So use section name when available.
           * DPP questions therefore naturally show their
           * section/subject label.
           */
          const subjectName =
            sectionId !== null
              ? sectionMap.get(
                  sectionId
                )?.sectionName || null
              : categoryName ||
                series;

          return {
            id: questionId,

            number:
              Number(
                firstDefined(
                  question.question_order,
                  question.questionOrder,
                  index + 1
                )
              ),

            sectionId,

            sectionName:
              sectionId !== null
                ? sectionMap.get(
                    sectionId
                  )?.sectionName || null
                : null,

            subjectName,

            questionText:
              firstDefined(
                question.question_text,
                question.questionText,
                question.text,
                ""
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

            options: options.map(
              (option) => ({
                id: option.id,
                label: option.label,
                text: option.text,
                order: option.order,
              })
            ),

            selectedOptionId,

            selectedOption:
              selectedOption
                ? {
                    id:
                      selectedOption.id,
                    label:
                      selectedOption.label,
                    text:
                      selectedOption.text,
                    order:
                      selectedOption.order,
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
                    order:
                      correctOption.order,
                  }
                : null,

            correctOptionIds:
              correctOptions.map(
                (option) =>
                  option.id
              ),

            isCorrect:
              answer?.isCorrect ??
              null,

            resultStatus,

            marksObtained:
              answer?.marksObtained ??
              0,

            timeSpentSeconds:
              answer?.timeSpentSeconds ??
              0,

            answeredAt:
              answer?.answeredAt ??
              null,

            visited:
              answer?.visited ??
              false,

            markedForReview:
              answer?.markedForReview ??
              false,
          };
        }
      );

    /* -------------------------------------------------------
       SECTION SUMMARY
    ------------------------------------------------------- */

    const sectionStats =
      sections.map((section) => {
        const sectionQuestions =
          questions.filter(
            (question) =>
              Number(
                question.sectionId
              ) ===
              Number(section.id)
          );

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
              false
          ).length;

        const unanswered =
          sectionQuestions.filter(
            (question) =>
              question.selectedOptionId ===
              null
          ).length;

        const score =
          sectionQuestions.reduce(
            (sum, question) =>
              sum +
              Number(
                question.marksObtained ||
                  0
              ),
            0
          );

        return {
          id: section.id,

          sectionName:
            section.sectionName,

          questionCount:
            sectionQuestions.length,

          correct,

          wrong,

          unanswered,

          score,
        };
      });

    console.log(
      `[analysis GET] ${series}/${testId} attempt=${attemptId} questions=${questions.length} sections=${sections.length}`
    );

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        test: normalizedTest,

        attempt: normalizedAttempt,

        sections: sectionStats,

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

          isDpp:
            categorySlug === "dpp",
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          Pragma: "no-cache",

          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET /api/test/[series]/[id]/analysis] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load detailed analysis.",
      },
      {
        status: 500,
      }
    );
  }
}