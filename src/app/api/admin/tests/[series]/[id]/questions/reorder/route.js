import {
  db,
} from "@/lib/turso";

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

function normalizeDirection(
  value
) {
  const direction =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();

  if (
    direction ===
      "up" ||
    direction ===
      "down"
  ) {
    return direction;
  }

  return null;
}

/* =========================================================
   POST
   /api/admin/tests/[series]/[id]/questions/reorder
========================================================= */

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.QUESTION_UPDATE,

    async ({
      request,
      context,
      userId,
    }) => {
      let transaction = null;

      try {
        /* ---------------------------------------------------
           PARAMS
        --------------------------------------------------- */

        const {
          series:
            rawSeries,
          id:
            rawTestId,
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

        /* ---------------------------------------------------
           BODY
        --------------------------------------------------- */

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

        const questionId =
          normalizeId(
            body.questionId
          );

        const direction =
          normalizeDirection(
            body.direction
          );

        if (!questionId) {
          return adminBadRequestResponse(
            "Invalid question ID."
          );
        }

        if (!direction) {
          return adminBadRequestResponse(
            "Direction must be either up or down."
          );
        }

        /* ---------------------------------------------------
           CURRENT QUESTION
        --------------------------------------------------- */

        const currentResult =
          await db.execute({
            sql: `
              SELECT
                id,
                test_id,
                section_id,
                question_order,
                question_text
              FROM ${config.questionTable}

              WHERE
                id = ?
                AND test_id = ?

              LIMIT 1
            `,

            args: [
              questionId,
              testId,
            ],
          });

        const current =
          currentResult.rows?.[0];

        if (!current) {
          return adminNotFoundResponse(
            "Question not found."
          );
        }

        const currentOrder =
          Number(
            current.question_order
          );

        if (
          !Number.isInteger(
            currentOrder
          ) ||
          currentOrder <=
            0
        ) {
          return adminConflictResponse(
            "Question has an invalid order."
          );
        }

        /* ---------------------------------------------------
           SECTION-AWARE REORDER
           
           We only move inside the same section.
           
           This prevents accidentally moving a question from
           one section into another when sectional tests are
           being managed.
        --------------------------------------------------- */

        const sectionId =
          current.section_id ===
            null ||
          current.section_id ===
            undefined
            ? null
            : Number(
                current.section_id
              );

        let neighborSql = `
          SELECT
            id,
            section_id,
            question_order,
            question_text
          FROM ${config.questionTable}

          WHERE
            test_id = ?
            AND question_order ${
              direction ===
              "up"
                ? "<"
                : ">"
            } ?
        `;

        const neighborArgs = [
          testId,
          currentOrder,
        ];

        if (
          sectionId ===
          null
        ) {
          neighborSql += `
            AND section_id IS NULL
          `;
        } else {
          neighborSql += `
            AND section_id = ?
          `;

          neighborArgs.push(
            sectionId
          );
        }

        neighborSql +=
          direction ===
          "up"
            ? `
                ORDER BY
                  question_order DESC
                LIMIT 1
              `
            : `
                ORDER BY
                  question_order ASC
                LIMIT 1
              `;

        const neighborResult =
          await db.execute({
            sql:
              neighborSql,

            args:
              neighborArgs,
          });

        const neighbor =
          neighborResult
            .rows?.[0];

        /* ---------------------------------------------------
           EDGE
        --------------------------------------------------- */

        if (!neighbor) {
          return adminSuccess({
            message:
              direction ===
              "up"
                ? "Question is already first in its section."
                : "Question is already last in its section.",

            changed: false,

            question: {
              id:
                questionId,

              testId,

              sectionId,

              questionOrder:
                currentOrder,
            },

            cacheInvalidation: {
              type:
                "series",

              series,
            },
          });
        }

        const neighborId =
          Number(
            neighbor.id
          );

        const neighborOrder =
          Number(
            neighbor.question_order
          );

        if (
          !Number.isInteger(
            neighborOrder
          ) ||
          neighborOrder <=
            0
        ) {
          return adminConflictResponse(
            "The neighboring question has an invalid order."
          );
        }

        /* ---------------------------------------------------
           TRANSACTION
           
           Temporary negative order prevents the UNIQUE
           (test_id, question_order) collision while swapping.
        --------------------------------------------------- */

        transaction =
          await db.transaction(
            "write"
          );

        /*
         * STEP 1
         *
         * Move current question to a temporary negative
         * position.
         *
         * We use a value guaranteed to be well outside normal
         * question ordering.
         */

        const temporaryOrder =
          -(
            1000000 +
            questionId
          );

        await transaction.execute({
          sql: `
            UPDATE ${config.questionTable}

            SET
              question_order = ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
              AND test_id = ?
          `,

          args: [
            temporaryOrder,

            questionId,

            testId,
          ],
        });

        /* ---------------------------------------------------
           STEP 2
           
           Neighbor takes current question's position.
        --------------------------------------------------- */

        await transaction.execute({
          sql: `
            UPDATE ${config.questionTable}

            SET
              question_order = ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
              AND test_id = ?
          `,

          args: [
            currentOrder,

            neighborId,

            testId,
          ],
        });

        /* ---------------------------------------------------
           STEP 3
           
           Current question takes neighbor's position.
        --------------------------------------------------- */

        await transaction.execute({
          sql: `
            UPDATE ${config.questionTable}

            SET
              question_order = ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
              AND test_id = ?
          `,

          args: [
            neighborOrder,

            questionId,

            testId,
          ],
        });

        /* ---------------------------------------------------
           COMMIT
        --------------------------------------------------- */

        await transaction.commit();

        transaction =
          null;

        return adminSuccess({
          message:
            direction ===
            "up"
              ? "Question moved up successfully."
              : "Question moved down successfully.",

          changed: true,

          changedBy:
            Number(
              userId
            ),

          question: {
            id:
              questionId,

            testId,

            sectionId,

            questionOrder:
              neighborOrder,
          },

          swappedWith: {
            id:
              neighborId,

            questionOrder:
              currentOrder,
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
        /* ---------------------------------------------------
           ROLLBACK
        --------------------------------------------------- */

        if (
          transaction
        ) {
          try {
            await transaction.rollback();
          } catch (
            rollbackError
          ) {
            console.error(
              "[question reorder] rollback error:",
              rollbackError
            );
          }
        }

        const message =
          String(
            error?.message ||
              ""
          ).toLowerCase();

        if (
          message.includes(
            "unique"
          ) ||
          message.includes(
            "constraint"
          )
        ) {
          return adminConflictResponse(
            "Question order could not be updated because another question changed at the same time. Refresh and try again."
          );
        }

        return adminInternalError(
          error,
          "[POST /api/admin/tests/[series]/[id]/questions/reorder]"
        );
      }
    },

    {
      logContext:
        "[POST /api/admin/tests/[series]/[id]/questions/reorder]",
    }
  );