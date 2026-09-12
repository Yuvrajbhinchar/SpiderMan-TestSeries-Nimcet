import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  firstDefined,
  toNumber,
  toBoolean,
  jsonError,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
  getTestCategory,
  requireTestAvailability,
} from "@/lib/testSecurity";

/* =========================================================
   GET
   /api/test/[series]/[id]/instructions
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

    /* -------------------------------------------------------
       BASIC VALIDATION
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
       AUTH
       
       Centralized:
       - JWT
       - user existence
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
      currentUser,
    } = auth;

    /* -------------------------------------------------------
       SERIES ACCESS
       
       IMPORTANT:
       
       Paid series entitlement comes from the verified
       JWT snapshot.
       
       No user_series_access entitlement query.
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
       
       Centralized test lookup.
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
      config,
    } = testResult;

    /* -------------------------------------------------------
       PHASE 5
       
       CENTRAL AVAILABILITY CHECK
       
       Checks:
       
       1. Series is active
       2. Category is active
       3. Test is active
       4. Test is published
       
       IMPORTANT:
       
       This route is for starting the test/instructions,
       so inactive/unpublished tests are blocked here.
    ------------------------------------------------------- */

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
       CATEGORY
       
       We already fetched it inside availability, but keep
       the existing helper call because this route needs the
       category metadata for the response.
    ------------------------------------------------------- */

    const category =
      await getTestCategory(
        testRow
      );

    /* -------------------------------------------------------
       CATEGORY / MODE
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

    const isDpp =
      categorySlug ===
      "dpp";

    /* -------------------------------------------------------
       SERIES META
       
       Presentation metadata only.
    ------------------------------------------------------- */

    let seriesMeta =
      null;

    try {
      const seriesResult =
        await db.execute({
          sql: `
            SELECT
              id,
              name,
              slug,
              is_paid,
              is_active
            FROM test_series
            WHERE id = ?
            LIMIT 1
          `,

          args: [
            config.seriesId,
          ],
        });

      seriesMeta =
        seriesResult.rows?.[0] ||
        null;
    } catch (error) {
      /*
       * Optional metadata failure should not crash the
       * instructions response.
       */
      console.warn(
        "[instructions] Series metadata lookup failed:",
        error
      );
    }

    /* =======================================================
       QUESTIONS
    ======================================================= */

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
            question_order,
            question_image_url

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
      });

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
      return jsonError(
        "No questions were found for this test.",
        422,
        "NO_QUESTIONS"
      );
    }

    /* =======================================================
       OPTIONS
    ======================================================= */

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
          optionResult.rows
        )
          ? optionResult.rows
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

      optionsByQuestion
        .get(
          questionId
        )
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
       RESPONSE QUESTIONS
    ======================================================= */

    const questions =
      rawQuestions.map(
        (
          question,
          index
        ) => ({
          id:
            Number(
              question.id
            ),

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

          /* -------------------------------------------------
             QUESTION IMAGE
          ------------------------------------------------- */

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

          /* -------------------------------------------------
             STABLE QUESTION ORDER
          ------------------------------------------------- */

          questionOrder:
            Number(
              firstDefined(
                question.question_order,
                question.questionOrder,
                index + 1
              )
            ),

          number:
            Number(
              firstDefined(
                question.question_order,
                question.questionOrder,
                index + 1
              )
            ),

          options:
            optionsByQuestion.get(
              Number(
                question.id
              )
            ) || [],
        })
      );

    /* =======================================================
       TEST RESPONSE
    ======================================================= */

    const testResponse = {
      id:
        Number(
          testRow.id
        ),

      series,

      seriesId:
        config.seriesId,

      seriesName:
        firstDefined(
          seriesMeta?.name,
          null
        ),

      seriesSlug:
        firstDefined(
          seriesMeta?.slug,
          series
        ),

      seriesIsPaid:
        toBoolean(
          firstDefined(
            seriesMeta?.is_paid,
            seriesMeta?.isPaid,
            series !== "free"
              ? 1
              : 0
          )
        ),

      /*
       * Phase 5 state information.
       */

      seriesIsActive:
        seriesMeta
          ? Number(
              seriesMeta.is_active
            ) === 1
          : true,

      testIsActive:
        Number(
          firstDefined(
            testRow.is_active,
            testRow.isActive,
            0
          )
        ) === 1,

      isPublished:
        Number(
          firstDefined(
            testRow.is_published,
            testRow.isPublished,
            0
          )
        ) === 1,

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
        toNumber(
          firstDefined(
            testRow.duration_minutes,
            testRow.durationMinutes,
            0
          ),
          0
        ),

      totalQuestions:
        toNumber(
          firstDefined(
            testRow.total_questions,
            testRow.totalQuestions,
            questions.length
          ),
          questions.length
        ),

      totalMarks:
        toNumber(
          firstDefined(
            testRow.total_marks,
            testRow.totalMarks,
            0
          ),
          0
        ),

      categoryId:
        firstDefined(
          testRow.category_id,
          testRow.categoryId
        ) === null
          ? null
          : Number(
              firstDefined(
                testRow.category_id,
                testRow.categoryId
              )
            ),

      categoryName,

      categorySlug,

      categoryIsActive:
        category
          ? Number(
              category.is_active
            ) === 1
          : true,

      isDpp,
    };

    /* =======================================================
       RESPONSE
    ======================================================= */

    return NextResponse.json(
      {
        success: true,

        test:
          testResponse,

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

          availability: {
            seriesActive:
              true,

            categoryActive:
              true,

            testActive:
              true,

            published:
              true,
          },
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