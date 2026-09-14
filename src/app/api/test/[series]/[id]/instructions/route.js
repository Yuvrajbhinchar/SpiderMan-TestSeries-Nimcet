import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  firstDefined,
  toNumber,
  toBoolean,
  jsonError,
  requireSeriesAccess,
  getTestById,
  requireTestAvailability,
} from "@/lib/testSecurity";

/* =========================================================
   GET
   /api/test/[series]/[id]/instructions

   IMPORTANT:
   - Authentication is JWT-only.
   - No users table lookup.
   - No active_session_id / active_device_id lookup.
   - No questions query.
   - No options query.
   - Only test + availability + sections are loaded.
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
        "Invalid test ID.",
        400,
        "INVALID_TEST_ID"
      );
    }

    /* -------------------------------------------------------
       JWT-ONLY AUTH
       
       getCurrentUser():
       - reads auth cookie
       - verifies JWT
       - validates JWT payload
       
       IMPORTANT:
       It does NOT query users table.
    ------------------------------------------------------- */

    const currentUser =
      await getCurrentUser();

    if (
      !currentUser?.id
    ) {
      return jsonError(
        "Please login to continue.",
        401,
        "UNAUTHORIZED"
      );
    }

    /* -------------------------------------------------------
       SERIES ACCESS
       
       Paid-series entitlement comes from verified JWT.
       
       No user_series_access query.
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
       
       One DB read.
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
       AVAILABILITY
       
       Server-side availability still checks:
       - series active
       - category active
       - test published
       
       This is NOT user entitlement checking.
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

    const category =
      availability.category ||
      null;

    const seriesState =
      availability.series ||
      null;

    /* =======================================================
       CATEGORY / MODE
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

    /* =======================================================
       SERIES META
       
       Already returned by requireTestAvailability().
       
       No second test_series query.
    ======================================================= */

    const seriesName =
      firstDefined(
        seriesState?.name,
        null
      );

    const seriesSlug =
      firstDefined(
        seriesState?.slug,
        series
      );

    const seriesIsPaid =
      toBoolean(
        firstDefined(
          seriesState?.is_paid,
          seriesState?.isPaid,
          series !== "free"
            ? 1
            : 0
        )
      );

    const seriesIsActive =
      seriesState
        ? Number(
            firstDefined(
              seriesState?.is_active,
              seriesState?.isActive,
              0
            )
          ) === 1
        : true;

    const categoryIsActive =
      category
        ? Number(
            firstDefined(
              category?.is_active,
              category?.isActive,
              0
            )
          ) === 1
        : true;

    /* =======================================================
       SECTIONS
       
       IMPORTANT:
       We only fetch section configuration.
       
       No questions.
       No options.
       No explanations.
       No correct answers.
    ======================================================= */

    const sectionResult =
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

    /* =======================================================
       SECTION RESPONSE
       
       IMPORTANT:
       We use stored section.question_count.
       
       We DO NOT scan question table just to calculate
       section marks because that would defeat the purpose
       of making instructions lightweight.
       
       Since the section table has no marks columns, the
       test-level values are used as the fallback.
    ======================================================= */

    const testPositiveMarks =
      toNumber(
        firstDefined(
          testRow?.positive_marks,
          testRow?.positiveMarks,
          0
        ),
        0
      );

    const testNegativeMarks =
      toNumber(
        firstDefined(
          testRow?.negative_marks,
          testRow?.negativeMarks,
          0
        ),
        0
      );

    const sections =
      rawSections.map(
        (section) => {
          const sectionId =
            Number(
              firstDefined(
                section?.id,
                section?.section_id,
                section?.sectionId
              )
            );

          const sectionName =
            firstDefined(
              section?.section_name,
              section?.sectionName,
              `Section ${
                firstDefined(
                  section?.section_order,
                  section?.sectionOrder,
                  ""
                )
              }`.trim()
            );

          const sectionOrder =
            Number(
              firstDefined(
                section?.section_order,
                section?.sectionOrder,
                0
              )
            );

          const durationMinutes =
            toNumber(
              firstDefined(
                section?.duration_minutes,
                section?.durationMinutes,
                0
              ),
              0
            );

          const questionCount =
            toNumber(
              firstDefined(
                section?.question_count,
                section?.questionCount,
                0
              ),
              0
            );

          const isSequential =
            toBoolean(
              firstDefined(
                section?.is_sequential,
                section?.isSequential,
                1
              )
            );

          const timerGroup =
            firstDefined(
              section?.timer_group,
              section?.timerGroup,
              null
            );

          return {
            id:
              sectionId,

            section_id:
              sectionId,

            test_id:
              Number(testId),

            testId:
              Number(testId),

            section_name:
              sectionName,

            sectionName:
              sectionName,

            section_order:
              sectionOrder,

            sectionOrder:
              sectionOrder,

            duration_minutes:
              durationMinutes,

            durationMinutes:
              durationMinutes,

            question_count:
              questionCount,

            questionCount:
              questionCount,

            /*
             * Kept for existing frontend compatibility.
             *
             * No question scan is performed.
             */
            positive_marks:
              testPositiveMarks,

            positiveMarks:
              testPositiveMarks,

            negative_marks:
              testNegativeMarks,

            negativeMarks:
              testNegativeMarks,

            is_sequential:
              isSequential,

            isSequential:
              isSequential,

            timer_group:
              timerGroup,

            timerGroup:
              timerGroup,
          };
        }
      );

    /* =======================================================
       TEST META
    ======================================================= */

    const durationMinutes =
      toNumber(
        firstDefined(
          testRow?.duration_minutes,
          testRow?.durationMinutes,
          0
        ),
        0
      );

    const totalQuestions =
      toNumber(
        firstDefined(
          testRow?.total_questions,
          testRow?.totalQuestions,
          0
        ),
        0
      );

    const totalMarks =
      toNumber(
        firstDefined(
          testRow?.total_marks,
          testRow?.totalMarks,
          0
        ),
        0
      );

    const categoryIdValue =
      firstDefined(
        testRow?.category_id,
        testRow?.categoryId
      );

    const categoryId =
      categoryIdValue ===
        null ||
      categoryIdValue ===
        undefined ||
      categoryIdValue ===
        ""
        ? null
        : Number(
            categoryIdValue
          );

    const title =
      firstDefined(
        testRow?.title,
        testRow?.name,
        `Test ${testId}`
      );

    const slug =
      firstDefined(
        testRow?.slug,
        null
      );

    const description =
      firstDefined(
        testRow?.description,
        ""
      );

    const testIsActive =
      Number(
        firstDefined(
          testRow?.is_active,
          testRow?.isActive,
          1
        )
      ) === 1;

    const testIsPublished =
      Number(
        firstDefined(
          testRow?.is_published,
          testRow?.isPublished,
          0
        )
      ) === 1;

    /* =======================================================
       TEST RESPONSE
    ======================================================= */

    const testResponse = {
      id:
        Number(
          testRow.id
        ),

      series,

      series_id:
        config.seriesId,

      seriesId:
        config.seriesId,

      series_name:
        seriesName,

      seriesName:
        seriesName,

      series_slug:
        seriesSlug,

      seriesSlug:
        seriesSlug,

      series_is_paid:
        seriesIsPaid,

      seriesIsPaid:
        seriesIsPaid,

      series_is_active:
        seriesIsActive,

      seriesIsActive:
        seriesIsActive,

      test_is_active:
        testIsActive,

      testIsActive:
        testIsActive,

      is_published:
        testIsPublished,

      isPublished:
        testIsPublished,

      title,

      slug,

      description,

      duration_minutes:
        durationMinutes,

      durationMinutes:
        durationMinutes,

      total_duration_minutes:
        durationMinutes,

      totalDurationMinutes:
        durationMinutes,

      total_questions:
        totalQuestions,

      totalQuestions:
        totalQuestions,

      total_marks:
        totalMarks,

      totalMarks:
        totalMarks,

      positive_marks:
        testPositiveMarks,

      positiveMarks:
        testPositiveMarks,

      negative_marks:
        testNegativeMarks,

      negativeMarks:
        testNegativeMarks,

      category_id:
        categoryId,

      categoryId:
        categoryId,

      category_name:
        categoryName,

      categoryName:
        categoryName,

      category_slug:
        categorySlug,

      categorySlug:
        categorySlug,

      category_is_active:
        categoryIsActive,

      categoryIsActive:
        categoryIsActive,

      is_dpp:
        isDpp,

      isDpp,

      /*
       * Section timing is the important instructions data.
       */
      sections,

      section_list:
        sections,
    };

    /* =======================================================
       RESPONSE
       
       IMPORTANT:
       There is intentionally NO:
         questions
         options
         explanation
         is_correct
       
       Attempt page is responsible for loading questions.
    ======================================================= */

    return NextResponse.json(
      {
        success: true,

        test:
          testResponse,

        meta: {
          series,

          seriesId:
            config.seriesId,

          testId,

          questionCount:
            totalQuestions,

          sectionCount:
            sections.length,

          categorySlug,

          categoryName,

          isDpp,

          availability: {
            seriesActive:
              seriesIsActive,

            categoryActive:
              categoryIsActive,

            testActive:
              testIsActive,

            published:
              testIsPublished,
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