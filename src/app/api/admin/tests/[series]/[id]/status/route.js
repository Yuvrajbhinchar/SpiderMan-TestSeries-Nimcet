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
    },

    asspire: {
      id: 2,
      name: "Asspire",
      table: "asspire_tests",
    },

    imppetus: {
      id: 3,
      name: "Imppetus",
      table: "imppetus_tests",
    },

    spiderman: {
      id: 4,
      name: "SpiderMan",
      table: "spiderman_tests",
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

function getAction(
  value
) {
  const action =
    normalize(value);

  const allowed =
    new Set([
      "activate",
      "deactivate",
      "publish",
      "unpublish",
    ]);

  return allowed.has(
    action
  )
    ? action
    : null;
}

/* =========================================================
   GET CURRENT TEST
========================================================= */

async function getTest({
  table,
  id,
}) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          title,
          slug,
          is_active,
          is_published,
          updated_at
        FROM ${table}
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        id,
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

/* =========================================================
   POST
   /api/admin/tests/[series]/[id]/status
========================================================= */

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.TEST_UPDATE,

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
           BODY
        --------------------------------------------------- */

        const body =
          await request
            .json()
            .catch(
              () => ({})
            );

        const action =
          getAction(
            body?.action
          );

        if (!action) {
          return adminBadRequestResponse(
            "Invalid test status action."
          );
        }

        /* ---------------------------------------------------
           CURRENT TEST
        --------------------------------------------------- */

        const existing =
          await getTest({
            table:
              config.table,

            id:
              testId,
          });

        if (!existing) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        /* ---------------------------------------------------
           CALCULATE NEW STATE
        --------------------------------------------------- */

        let nextActive =
          Number(
            existing.is_active
          ) === 1;

        let nextPublished =
          Number(
            existing.is_published
          ) === 1;

        switch (
          action
        ) {
          case "activate":
            nextActive = true;
            break;

          case "deactivate":
            nextActive = false;
            break;

          case "publish":
            nextPublished = true;
            break;

          case "unpublish":
            nextPublished = false;
            break;

          default:
            return adminBadRequestResponse(
              "Unsupported status action."
            );
        }

        /* ---------------------------------------------------
           NO-OP PROTECTION
           
           Calling activate on an already-active test is not
           an error, but we don't perform an unnecessary write.
        --------------------------------------------------- */

        const currentActive =
          Number(
            existing.is_active
          ) === 1;

        const currentPublished =
          Number(
            existing.is_published
          ) === 1;

        if (
          currentActive ===
            nextActive &&
          currentPublished ===
            nextPublished
        ) {
          return adminSuccess({
            message:
              "Test status is already up to date.",

            test: {
              id:
                Number(
                  existing.id
                ),

              series,

              title:
                existing.title,

              isActive:
                currentActive,

              isPublished:
                currentPublished,

              updatedAt:
                existing.updated_at,
            },

            changed: false,

            action,

            cacheInvalidation: {
              type:
                "series",

              series,
            },
          });
        }

        /* ---------------------------------------------------
           UPDATE
        --------------------------------------------------- */

        const result =
          await db.execute({
            sql: `
              UPDATE ${config.table}

              SET
                is_active = ?,

                is_published = ?,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                id = ?

              RETURNING
                id,
                title,
                slug,
                is_active,
                is_published,
                updated_at
            `,

            args: [
              nextActive
                ? 1
                : 0,

              nextPublished
                ? 1
                : 0,

              testId,
            ],
          });

        const updated =
          result.rows?.[0];

        if (!updated) {
          return adminNotFoundResponse(
            "Test could not be updated."
          );
        }

        /* ---------------------------------------------------
           RESPONSE
        --------------------------------------------------- */

        return adminSuccess({
          message:
            getSuccessMessage(
              action
            ),

          changed: true,

          action,

          changedBy:
            Number(
              userId
            ),

          test: {
            id:
              Number(
                updated.id
              ),

            series,

            seriesId:
              config.id,

            seriesName:
              config.name,

            title:
              updated.title,

            slug:
              updated.slug,

            isActive:
              Number(
                updated.is_active
              ) === 1,

            isPublished:
              Number(
                updated.is_published
              ) === 1,

            updatedAt:
              updated.updated_at,
          },

          /*
           * The browser will use this to invalidate its
           * dashboard Redux cache.
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
        const message =
          String(
            error?.message ||
              ""
          ).toLowerCase();

        if (
          message.includes(
            "constraint"
          ) ||
          message.includes(
            "check"
          )
        ) {
          return adminConflictResponse(
            "The requested status change is not valid for this test."
          );
        }

        return adminInternalError(
          error,
          "[POST /api/admin/tests/[series]/[id]/status]"
        );
      }
    },

    {
      logContext:
        "[POST /api/admin/tests/[series]/[id]/status]",
    }
  );

/* =========================================================
   SUCCESS MESSAGE
========================================================= */

function getSuccessMessage(
  action
) {
  switch (
    action
  ) {
    case "activate":
      return "Test activated successfully.";

    case "deactivate":
      return "Test deactivated successfully.";

    case "publish":
      return "Test published successfully.";

    case "unpublish":
      return "Test unpublished successfully.";

    default:
      return "Test status updated successfully.";
  }
}