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
    direction === "up" ||
    direction === "down"
  ) {
    return direction;
  }

  return null;
}

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.TEST_UPDATE,

    async ({
      request,
      context,
    }) => {
      let transaction =
        null;

      try {
        const {
          series: rawSeries,
          id: rawTestId,
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

        const sectionId =
          normalizeId(
            body.sectionId
          );

        const direction =
          normalizeDirection(
            body.direction
          );

        if (!sectionId) {
          return adminBadRequestResponse(
            "Invalid section ID."
          );
        }

        if (!direction) {
          return adminBadRequestResponse(
            "Direction must be up or down."
          );
        }

        const currentResult =
          await db.execute({
            sql: `
              SELECT
                id,
                test_id,
                section_order
              FROM ${config.sectionTable}

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

        const current =
          currentResult
            .rows?.[0];

        if (!current) {
          return adminNotFoundResponse(
            "Section not found."
          );
        }

        const currentOrder =
          Number(
            current.section_order
          );

        const neighborResult =
          await db.execute({
            sql:
              direction ===
              "up"
                ? `
                  SELECT
                    id,
                    section_order
                  FROM ${config.sectionTable}

                  WHERE
                    test_id = ?
                    AND section_order < ?

                  ORDER BY
                    section_order DESC

                  LIMIT 1
                `
                : `
                  SELECT
                    id,
                    section_order
                  FROM ${config.sectionTable}

                  WHERE
                    test_id = ?
                    AND section_order > ?

                  ORDER BY
                    section_order ASC

                  LIMIT 1
                `,

            args: [
              testId,
              currentOrder,
            ],
          });

        const neighbor =
          neighborResult
            .rows?.[0];

        if (!neighbor) {
          return adminSuccess({
            message:
              direction ===
              "up"
                ? "Section is already first."
                : "Section is already last.",

            changed: false,

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
            neighbor.section_order
          );

        transaction =
          await db.transaction(
            "write"
          );

        /*
         * Temporary negative order avoids the UNIQUE
         * (test_id, section_order) collision.
         */

        const temporaryOrder =
          -(
            1000000 +
            sectionId
          );

        await transaction.execute({
          sql: `
            UPDATE ${config.sectionTable}

            SET
              section_order = ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
              AND test_id = ?
          `,

          args: [
            temporaryOrder,
            sectionId,
            testId,
          ],
        });

        await transaction.execute({
          sql: `
            UPDATE ${config.sectionTable}

            SET
              section_order = ?,

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

        await transaction.execute({
          sql: `
            UPDATE ${config.sectionTable}

            SET
              section_order = ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
              AND test_id = ?
          `,

          args: [
            neighborOrder,
            sectionId,
            testId,
          ],
        });

        await transaction.commit();

        transaction =
          null;

        return adminSuccess({
          message:
            direction ===
            "up"
              ? "Section moved up successfully."
              : "Section moved down successfully.",

          changed: true,

          section: {
            id:
              sectionId,

            newOrder:
              neighborOrder,
          },

          swappedWith: {
            id:
              neighborId,

            newOrder:
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
        if (
          transaction
        ) {
          try {
            await transaction.rollback();
          } catch (
            rollbackError
          ) {
            console.error(
              "[section reorder] rollback error:",
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
            "Section order changed while you were moving it. Refresh and try again."
          );
        }

        return adminInternalError(
          error,
          "[POST section reorder]"
        );
      }
    },

    {
      logContext:
        "[POST section reorder]",
    }
  );