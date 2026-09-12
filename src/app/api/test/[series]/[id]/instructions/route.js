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
    questionTable: "free_questions",
    optionTable: "free_question_options",
  },

  asspire: {
    seriesId: 2,
    testTable: "asspire_tests",
    questionTable: "asspire_questions",
    optionTable: "asspire_question_options",
  },

  imppetus: {
    seriesId: 3,
    testTable: "imppetus_tests",
    questionTable: "imppetus_questions",
    optionTable: "imppetus_question_options",
  },

  spiderman: {
    seriesId: 4,
    testTable: "spiderman_tests",
    questionTable: "spiderman_questions",
    optionTable: "spiderman_question_options",
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

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1"
  );
}

function toIsoUtc(value) {
  if (!value) {
    return null;
  }

  const text = String(value);

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
   GET
   /api/test/[series]/[id]/instructions
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

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    const config =
      SERIES_CONFIG[series];

    if (!config) {
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
       AUTH
    ------------------------------------------------------- */

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
      Number(currentUser.id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return jsonError(
        "Invalid user session.",
        401,
        "INVALID_SESSION"
      );
    }

    /* -------------------------------------------------------
       USER / SESSION VALIDATION
    ------------------------------------------------------- */

    const userResult =
      await db.execute({
        sql: `
          SELECT
            id,
            username,
            email,
            display_name,
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
      Number(user.is_active) !== 1
    ) {
      return jsonError(
        "Your account is inactive.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    if (
      !currentUser.sessionId ||
      !user.active_session_id ||
      String(
        currentUser.sessionId
      ) !==
        String(
          user.active_session_id
        )
    ) {
      return jsonError(
        "Your session is no longer active.",
        401,
        "SESSION_REVOKED"
      );
    }

    if (
      !currentUser.deviceId ||
      !user.active_device_id ||
      String(
        currentUser.deviceId
      ) !==
        String(
          user.active_device_id
        )
    ) {
      return jsonError(
        "This device is no longer active.",
        401,
        "DEVICE_REVOKED"
      );
    }

    /* -------------------------------------------------------
       LOAD TEST
    ------------------------------------------------------- */

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
    |
    | Free series are always accessible.
    | Paid series access is checked from the verified JWT snapshot.
    |
    | IMPORTANT: no user_series_access entitlement query is performed
    | on this request. Entitlement is loaded when the JWT is issued.
    |----------------------------------------------------------------------
    */

    const hasSeriesAccess =
      series === "free" ||
      currentUser.seriesAccess?.[series] === true;

    if (!hasSeriesAccess) {
      return jsonError(
        "You do not have access to this test series.",
        403,
        "SERIES_ACCESS_REQUIRED"
      );
    }

    /* -------------------------------------------------------
       CATEGORY / MODE
    ------------------------------------------------------- */

    const categorySlug =
      String(
        test.category_slug || ""
      )
        .trim()
        .toLowerCase();

    const categoryName =
      firstDefined(
        test.category_name,
        null
      );

    const isDpp =
      categorySlug === "dpp";

    /* -------------------------------------------------------
       QUESTIONS
    ------------------------------------------------------- */

    const questionResult =
      await db.execute({
        sql: `
          SELECT
            id,
            test_id,
            section_id,
            question_text,
            explanation,
            question_type,
            marks,
            negative_marks,
            question_order
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

    if (
      rawQuestions.length === 0
    ) {
      return jsonError(
        "No questions were found for this test.",
        422,
        "NO_QUESTIONS"
      );
    }

    /* -------------------------------------------------------
       OPTIONS
    ------------------------------------------------------- */

    const questionIds =
      rawQuestions
        .map(
          (question) =>
            Number(question.id)
        )
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        );

    let rawOptions = [];

    if (questionIds.length > 0) {
      const placeholders =
        questionIds
          .map(() => "?")
          .join(",");

      const optionResult =
        await db.execute({
          sql: `
            SELECT
              id,
              question_id,
              option_label,
              option_text,
              option_order
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

    /* -------------------------------------------------------
       RESPONSE QUESTIONS
    ------------------------------------------------------- */

    const questions =
      rawQuestions.map(
        (question, index) => ({
          id:
            Number(question.id),

          testId:
            Number(
              firstDefined(
                question.test_id,
                question.testId,
                testId
              )
            ),

          sectionId:
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
                ),

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
              Number(question.id)
            ) || [],
        })
      );

    /* -------------------------------------------------------
       TEST RESPONSE
    ------------------------------------------------------- */

    const testResponse = {
      id: Number(test.id),

      series,

      seriesId:
        config.seriesId,

      seriesName:
        firstDefined(
          test.series_name,
          null
        ),

      seriesSlug:
        firstDefined(
          test.series_slug,
          series
        ),

      title:
        firstDefined(
          test.title,
          `Test ${testId}`
        ),

      slug:
        firstDefined(
          test.slug,
          null
        ),

      description:
        firstDefined(
          test.description,
          ""
        ),

      durationMinutes:
        toNumber(
          test.duration_minutes,
          0
        ),

      totalQuestions:
        toNumber(
          test.total_questions,
          questions.length
        ),

      totalMarks:
        toNumber(
          test.total_marks,
          0
        ),

      isPublished:
        toBoolean(
          test.is_published
        ),

      categoryId:
        test.category_id ===
          null ||
        test.category_id ===
          undefined
          ? null
          : Number(
              test.category_id
            ),

      categoryName,

      categorySlug,

      isDpp,
    };

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        test: testResponse,

        questions,

        meta: {
          series,

          seriesId:
            config.seriesId,

          testId,

          questionCount:
            questions.length,

          optionCount:
            rawOptions.length,

          categorySlug,

          categoryName,

          isDpp,
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          Pragma:
            "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[instructions GET] ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

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