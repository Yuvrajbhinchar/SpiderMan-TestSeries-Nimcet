import {
  db,
} from "@/lib/turso";

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
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG =
  Object.freeze({
    free: {
      id: 1,
      name: "Free",
      table: "free_tests",
      attemptsTable:
        "free_test_attempts",
      eventsTable:
        "free_test_events",
    },

    asspire: {
      id: 2,
      name: "Asspire",
      table: "asspire_tests",
      attemptsTable:
        "asspire_test_attempts",
      eventsTable:
        "asspire_test_events",
    },

    imppetus: {
      id: 3,
      name: "Imppetus",
      table: "imppetus_tests",
      attemptsTable:
        "imppetus_test_attempts",
      eventsTable:
        "imppetus_test_events",
    },

    spiderman: {
      id: 4,
      name: "SpiderMan",
      table: "spiderman_tests",
      attemptsTable:
        "spiderman_test_attempts",
      eventsTable:
        "spiderman_test_events",
    },
  });

/* =========================================================
   HELPERS
========================================================= */

function normalize(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function normalizeId(
  value
) {
  const id =
    Number(value);

  if (
    !Number.isInteger(
      id
    ) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

/* =========================================================
   DELETE
   /api/admin/tests/[series]/[id]/delete
========================================================= */

export const DELETE =
  withAdminAction(
    ADMIN_ACTIONS.TEST_DELETE,

    async ({
      request,
      context,
      userId,
    }) => {
      try {
        /* ---------------------------------------------------
           PARAMS
        --------------------------------------------------- */

        const {
          series:
            rawSeries,
          id:
            rawId,
        } =
          await context.params;

        const series =
          normalize(
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

        /* ---------------------------------------------------
           DELETE CONFIRMATION
           
           The UI sends:
           
           {
             "confirm": true
           }
           
           This isn't a security mechanism by itself. The
           actual admin authorization remains server-side.
        --------------------------------------------------- */

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

        /* ---------------------------------------------------
           LOAD TEST
        --------------------------------------------------- */

        const testResult =
          await db.execute({
            sql: `
              SELECT
                id,
                title,
                slug
              FROM ${config.table}

              WHERE id = ?

              LIMIT 1
            `,

            args: [
              testId,
            ],
          });

        const test =
          testResult.rows?.[0];

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        /* ===================================================
           ATTEMPT / EVENT SAFETY
           
           We intentionally block deletion when related
           attempts or events exist.
        =================================================== */

        const attemptResult =
          await db.execute({
            sql: `
              SELECT
                COUNT(*) AS count

              FROM ${config.attemptsTable}

              WHERE
                test_id = ?
            `,

            args: [
              testId,
            ],
          });

        const attemptCount =
          Number(
            attemptResult
              .rows?.[0]
              ?.count || 0
          );

        const eventResult =
          await db.execute({
            sql: `
              SELECT
                COUNT(*) AS count

              FROM ${config.eventsTable}

              WHERE
                test_id = ?
            `,

            args: [
              testId,
            ],
          });

        const eventCount =
          Number(
            eventResult
              .rows?.[0]
              ?.count || 0
          );

        /* ---------------------------------------------------
           BLOCK IF HISTORY EXISTS
        --------------------------------------------------- */

        if (
          attemptCount > 0
        ) {
          return adminConflictResponse(
            `This test cannot be deleted because it has ${attemptCount} existing attempt${
              attemptCount === 1
                ? ""
                : "s"
            }. Deactivate or unpublish it instead.`
          );
        }

        if (
          eventCount > 0
        ) {
          return adminConflictResponse(
            `This test cannot be deleted because it has ${eventCount} event record${
              eventCount === 1
                ? ""
                : "s"
            }. Remove the event first.`
          );
        }

        /* ===================================================
           ATOMIC SAFE DELETE
           
           We repeat the NOT EXISTS checks in the DELETE
           statement itself.
           
           Why?
           
           Between the COUNT queries above and DELETE, another
           operation should not be able to make us blindly
           delete a test with new history.
           
           The DELETE itself therefore refuses to delete if
           any attempt/event now exists.
        =================================================== */

        const deleteResult =
          await db.execute({
            sql: `
              DELETE FROM ${config.table}

              WHERE
                id = ?

                AND NOT EXISTS (
                  SELECT 1
                  FROM ${config.attemptsTable} a
                  WHERE a.test_id = ?
                )

                AND NOT EXISTS (
                  SELECT 1
                  FROM ${config.eventsTable} e
                  WHERE e.test_id = ?
                )
            `,

            args: [
              testId,
              testId,
              testId,
            ],
          });

        const affectedRows =
          Number(
            deleteResult.rowsAffected ||
              0
          );

        if (
          affectedRows !== 1
        ) {
          /*
           * Re-check the current state to return the correct
           * user-facing reason.
           */

          const latestAttemptResult =
            await db.execute({
              sql: `
                SELECT
                  COUNT(*) AS count

                FROM ${config.attemptsTable}

                WHERE
                  test_id = ?
              `,

              args: [
                testId,
              ],
            });

          const latestAttemptCount =
            Number(
              latestAttemptResult
                .rows?.[0]
                ?.count || 0
            );

          if (
            latestAttemptCount >
            0
          ) {
            return adminConflictResponse(
              "The test now has attempts and cannot be deleted."
            );
          }

          const latestEventResult =
            await db.execute({
              sql: `
                SELECT
                  COUNT(*) AS count

                FROM ${config.eventsTable}

                WHERE
                  test_id = ?
              `,

              args: [
                testId,
              ],
            });

          const latestEventCount =
            Number(
              latestEventResult
                .rows?.[0]
                ?.count || 0
            );

          if (
            latestEventCount >
            0
          ) {
            return adminConflictResponse(
              "The test now has event records and cannot be deleted."
            );
          }

          return adminNotFoundResponse(
            "Test no longer exists."
          );
        }

        /* ---------------------------------------------------
           SUCCESS
        --------------------------------------------------- */

        console.log(
          `[ADMIN TEST DELETE] user=${userId} series=${series} test=${testId} title="${test.title}"`
        );

        return adminSuccess({
          message:
            "Test deleted successfully.",

          deleted: true,

          deletedBy:
            Number(
              userId
            ),

          test: {
            id:
              testId,

            series,

            seriesId:
              config.id,

            title:
              test.title,

            slug:
              test.slug,
          },

          /*
           * Student dashboard cache must be cleared by the
           * client after receiving this response.
           */
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
          "[DELETE /api/admin/tests/[series]/[id]/delete]"
        );
      }
    },

    {
      logContext:
        "[DELETE /api/admin/tests/[series]/[id]/delete]",
    }
  );