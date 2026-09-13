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

function normalizeText(
  value
) {
  return String(
    value ?? ""
  ).trim();
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

  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function normalizeBoolean(
  value,
  fallback
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

async function getSection({
  table,
  sectionId,
  testId,
}) {
  const result =
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
          timer_group,
          created_at,
          updated_at

        FROM ${table}

        WHERE
          id = ?
          AND test_id = ?

        LIMIT 1
      `,

      args: [
        sectionId,
        testId,
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

function mapSection(
  row
) {
  return {
    id:
      Number(
        row.id
      ),

    testId:
      Number(
        row.test_id
      ),

    sectionName:
      row.section_name,

    sectionOrder:
      Number(
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
        row.question_count ||
          0
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
   PATCH
========================================================= */

export const PATCH =
  withAdminAction(
    ADMIN_ACTIONS.TEST_UPDATE,

    async ({
      request,
      context,
    }) => {
      try {
        const {
          series: rawSeries,
          id: rawTestId,
          sectionId:
            rawSectionId,
        } =
          await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawTestId
          );

        const sectionId =
          normalizeId(
            rawSectionId
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

        if (!sectionId) {
          return adminBadRequestResponse(
            "Invalid section ID."
          );
        }

        const existing =
          await getSection({
            table:
              config.sectionTable,

            sectionId,

            testId,
          });

        if (!existing) {
          return adminNotFoundResponse(
            "Section not found."
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
          body.sectionName !==
          undefined
            ? normalizeText(
                body.sectionName
              )
            : existing.section_name;

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
          body.durationMinutes !==
          undefined
            ? normalizeOptionalPositiveInteger(
                body.durationMinutes
              )
            : existing.duration_minutes ===
              null
              ? null
              : Number(
                  existing.duration_minutes
                );

        if (
          body.durationMinutes !==
            undefined &&
          body.durationMinutes !==
            null &&
          body.durationMinutes !==
            "" &&
          durationMinutes ===
            null
        ) {
          return adminBadRequestResponse(
            "Duration must be a positive number."
          );
        }

        const isSequential =
          body.isSequential !==
          undefined
            ? normalizeBoolean(
                body.isSequential,
                true
              )
            : Number(
                existing.is_sequential
              ) === 1;

        const timerGroup =
          body.timerGroup !==
          undefined
            ? normalizeText(
                body.timerGroup
              ) || null
            : existing.timer_group ||
              null;

        /*
         * Section order is intentionally NOT editable here.
         * Reordering has its own dedicated endpoint.
         */

        const result =
          await db.execute({
            sql: `
              UPDATE ${config.sectionTable}

              SET
                section_name = ?,

                duration_minutes = ?,

                is_sequential = ?,

                timer_group = ?,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                id = ?
                AND test_id = ?

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
              sectionName,

              durationMinutes,

              isSequential
                ? 1
                : 0,

              timerGroup,

              sectionId,

              testId,
            ],
          });

        const updated =
          result.rows?.[0];

        if (!updated) {
          return adminNotFoundResponse(
            "Section could not be updated."
          );
        }

        /*
         * Recalculate count from real questions.
         */

        const countResult =
          await db.execute({
            sql: `
              SELECT
                COUNT(*) AS count

              FROM ${config.questionTable}

              WHERE
                test_id = ?
                AND section_id = ?
            `,

            args: [
              testId,
              sectionId,
            ],
          });

        const questionCount =
          Number(
            countResult
              .rows?.[0]
              ?.count || 0
          );

        updated.question_count =
          questionCount;

        return adminSuccess({
          message:
            "Section updated successfully.",

          section:
            mapSection(
              updated
            ),

          cacheInvalidation: {
            type:
              "series",

            series,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[PATCH section]"
        );
      }
    },

    {
      logContext:
        "[PATCH section]",
    }
  );

/* =========================================================
   DELETE
========================================================= */

export const DELETE =
  withAdminAction(
    ADMIN_ACTIONS.TEST_UPDATE,

    async ({
      request,
      context,
    }) => {
      try {
        const {
          series: rawSeries,
          id: rawTestId,
          sectionId:
            rawSectionId,
        } =
          await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawTestId
          );

        const sectionId =
          normalizeId(
            rawSectionId
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

        if (!sectionId) {
          return adminBadRequestResponse(
            "Invalid section ID."
          );
        }

        const body =
          await request
            .json()
            .catch(
              () => ({})
            );

        if (
          body?.confirm !==
          true
        ) {
          return adminBadRequestResponse(
            "Delete confirmation is required."
          );
        }

        const section =
          await getSection({
            table:
              config.sectionTable,

            sectionId,

            testId,
          });

        if (!section) {
          return adminNotFoundResponse(
            "Section not found."
          );
        }

        /*
         * Questions use ON DELETE SET NULL for section_id.
         *
         * Therefore deleting a section will NOT delete its
         * questions. They become unsectioned.
         */

        const questionResult =
          await db.execute({
            sql: `
              SELECT
                COUNT(*) AS count

              FROM ${config.questionTable}

              WHERE
                test_id = ?
                AND section_id = ?
            `,

            args: [
              testId,
              sectionId,
            ],
          });

        const questionCount =
          Number(
            questionResult
              .rows?.[0]
              ?.count || 0
          );

        const deleteResult =
          await db.execute({
            sql: `
              DELETE FROM ${config.sectionTable}

              WHERE
                id = ?
                AND test_id = ?
            `,

            args: [
              sectionId,
              testId,
            ],
          });

        if (
          Number(
            deleteResult.rowsAffected ||
              0
          ) !== 1
        ) {
          return adminNotFoundResponse(
            "Section no longer exists."
          );
        }

        /*
         * Keep section ordering compact.
         */

        await db.execute({
          sql: `
            UPDATE ${config.sectionTable}

            SET
              section_order =
                section_order - 1,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              test_id = ?
              AND section_order > ?
          `,

          args: [
            testId,
            Number(
              section.section_order
            ),
          ],
        });

        return adminSuccess({
          message:
            questionCount > 0
              ? `Section deleted. ${questionCount} question${
                  questionCount === 1
                    ? ""
                    : "s"
                } were moved to No Section.`
              : "Section deleted successfully.",

          deleted: true,

          section: {
            id:
              sectionId,

            testId,

            series,

            questionCount,
          },

          cacheInvalidation: {
            type:
              "series",

            series,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[DELETE section]"
        );
      }
    },

    {
      logContext:
        "[DELETE section]",
    }
  );