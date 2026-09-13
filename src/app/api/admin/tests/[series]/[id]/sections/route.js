import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
} from "@/lib/testSecurity";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminConflictResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  withAdminAction,
} from "@/lib/adminApi";

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizePositiveInteger(
  value,
  fallback = null
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function normalizeOptionalPositiveInteger(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return normalizePositiveInteger(
    value
  );
}

function normalizeBoolean(
  value,
  fallback = true
) {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return fallback;
}

/* =========================================================
   GET TEST
========================================================= */

async function getTest({
  table,
  testId,
}) {
  const result = await db.execute({
    sql: `
      SELECT
        id,
        title
      FROM ${table}
      WHERE id = ?
      LIMIT 1
    `,
    args: [testId],
  });

  return result.rows?.[0] || null;
}

/* =========================================================
   BUILD SECTION OBJECT
========================================================= */

function mapSection(row) {
  return {
    id: Number(row.id),

    testId: Number(
      row.test_id
    ),

    sectionName:
      row.section_name,

    sectionOrder: Number(
      row.section_order
    ),

    durationMinutes:
      row.duration_minutes ===
      null
        ? null
        : Number(
            row.duration_minutes
          ),

    questionCount:
      Number(
        row.question_count || 0
      ),

    isSequential:
      Number(
        row.is_sequential
      ) === 1,

    timerGroup:
      row.timer_group ||
      null,

    createdAt:
      row.created_at ||
      null,

    updatedAt:
      row.updated_at ||
      null,
  };
}

/* =========================================================
   GET
   /api/admin/tests/[series]/[id]/sections
========================================================= */

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.TEST_READ,

    async ({
      context,
    }) => {
      try {
        const {
          series: rawSeries,
          id: rawId,
        } = await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawId
          );

        const config =
          SERIES_CONFIG[
            series
          ];

        if (!config) {
          return adminBadRequestResponse(
            "Invalid test series."
          );
        }

        if (!testId) {
          return adminBadRequestResponse(
            "Invalid test ID."
          );
        }

        const test =
          await getTest({
            table:
              config.testTable,
            testId,
          });

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        /*
         * Count questions dynamically instead of trusting the
         * stored question_count field.
         */

        const result =
          await db.execute({
            sql: `
              SELECT
                s.id,
                s.test_id,
                s.section_name,
                s.section_order,
                s.duration_minutes,
                s.is_sequential,
                s.timer_group,
                s.created_at,
                s.updated_at,

                COUNT(q.id) AS question_count

              FROM ${config.sectionTable} s

              LEFT JOIN ${config.questionTable} q
                ON q.section_id = s.id
                AND q.test_id = s.test_id

              WHERE
                s.test_id = ?

              GROUP BY
                s.id,
                s.test_id,
                s.section_name,
                s.section_order,
                s.duration_minutes,
                s.is_sequential,
                s.timer_group,
                s.created_at,
                s.updated_at

              ORDER BY
                s.section_order ASC,
                s.id ASC
            `,

            args: [
              testId,
            ],
          });

        const sections =
          (
            result.rows ||
            []
          ).map(
            mapSection
          );

        return adminSuccess({
          test: {
            id:
              Number(
                test.id
              ),

            title:
              test.title,
          },

          sections,

          count:
            sections.length,
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET /api/admin/tests/[series]/[id]/sections]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/tests/[series]/[id]/sections]",
    }
  );

/* =========================================================
   POST
   CREATE SECTION
========================================================= */

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.TEST_UPDATE,

    async ({
      request,
      context,
    }) => {
      try {
        const {
          series: rawSeries,
          id: rawId,
        } = await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawId
          );

        const config =
          SERIES_CONFIG[
            series
          ];

        if (!config) {
          return adminBadRequestResponse(
            "Invalid test series."
          );
        }

        if (!testId) {
          return adminBadRequestResponse(
            "Invalid test ID."
          );
        }

        const test =
          await getTest({
            table:
              config.testTable,
            testId,
          });

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        const body =
          await request
            .json()
            .catch(
              () => null
            );

        if (!body) {
          return adminBadRequestResponse(
            "Invalid JSON request."
          );
        }

        const sectionName =
          normalizeText(
            body.sectionName
          );

        if (!sectionName) {
          return adminBadRequestResponse(
            "Section name is required."
          );
        }

        if (
          sectionName.length >
          150
        ) {
          return adminBadRequestResponse(
            "Section name is too long."
          );
        }

        const durationMinutes =
          normalizeOptionalPositiveInteger(
            body.durationMinutes
          );

        const isSequential =
          normalizeBoolean(
            body.isSequential,
            true
          );

        const timerGroup =
          normalizeText(
            body.timerGroup
          ) || null;

        /*
         * Automatically put the new section at the end.
         */

        const maxResult =
          await db.execute({
            sql: `
              SELECT
                COALESCE(
                  MAX(section_order),
                  0
                ) + 1 AS next_order

              FROM ${config.sectionTable}

              WHERE
                test_id = ?
            `,

            args: [
              testId,
            ],
          });

        const sectionOrder =
          Number(
            maxResult
              .rows?.[0]
              ?.next_order || 1
          );

        const result =
          await db.execute({
            sql: `
              INSERT INTO ${config.sectionTable} (
                test_id,
                section_name,
                section_order,
                duration_minutes,
                question_count,
                is_sequential,
                timer_group,
                created_at,
                updated_at
              )

              VALUES (
                ?,
                ?,
                ?,
                ?,
                0,
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              RETURNING
                id,
                test_id,
                section_name,
                section_order,
                duration_minutes,
                question_count,
                is_sequential,
                timer_group,
                created_at,
                updated_at
            `,

            args: [
              testId,

              sectionName,

              sectionOrder,

              durationMinutes,

              isSequential
                ? 1
                : 0,

              timerGroup,
            ],
          });

        const section =
          result.rows?.[0];

        if (!section) {
          throw new Error(
            "Section insert returned no row."
          );
        }

        return adminSuccess(
          {
            message:
              "Section created successfully.",

            section:
              mapSection(
                section
              ),

            cacheInvalidation: {
              type:
                "series",

              series,
            },
          },
          201
        );
      } catch (
        error
      ) {
        const message =
          String(
            error?.message ||
              ""
          ).toLowerCase();

        if (
          message.includes(
            "unique"
          ) &&
          message.includes(
            "section_order"
          )
        ) {
          return adminConflictResponse(
            "Section order is already in use."
          );
        }

        return adminInternalError(
          error,
          "[POST /api/admin/tests/[series]/[id]/sections]"
        );
      }
    },

    {
      logContext:
        "[POST /api/admin/tests/[series]/[id]/sections]",
    }
  );