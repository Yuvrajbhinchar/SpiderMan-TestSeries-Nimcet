import { db } from "@/lib/turso";

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

function normalizeText(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text || null;
}

function parseNonNegativeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    return fallback;
  }

  return number;
}

function parsePositiveNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function parseBoolean(
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

async function getCategory(
  categoryId
) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          name,
          slug,
          is_active
        FROM test_categories
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        categoryId,
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

async function slugExists({
  table,
  slug,
  excludeId,
}) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id
        FROM ${table}

        WHERE
          LOWER(slug) =
            LOWER(?)

          AND id != ?

        LIMIT 1
      `,

      args: [
        slug,
        excludeId,
      ],
    });

  return Boolean(
    result.rows?.length
  );
}

async function getTest({
  table,
  id,
}) {
  const result =
    await db.execute({
      sql: `
        SELECT *
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
   GET ONE TEST
========================================================= */

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.TEST_READ,

    async ({
      context,
    }) => {
      try {
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

        const test =
          await getTest({
            table:
              config.table,

            id:
              testId,
          });

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        const category =
          await getCategory(
            test.category_id
          );

        return adminSuccess({
          test: {
            id:
              Number(
                test.id
              ),

            series,

            seriesId:
              config.id,

            seriesName:
              config.name,

            categoryId:
              Number(
                test.category_id
              ),

            category: category
              ? {
                  id:
                    Number(
                      category.id
                    ),

                  name:
                    category.name,

                  slug:
                    category.slug,

                  isActive:
                    Number(
                      category.is_active
                    ) === 1,
                }
              : null,

            title:
              test.title,

            slug:
              test.slug,

            description:
              test.description ||
              "",

            durationMinutes:
              Number(
                test.duration_minutes
              ),

            totalQuestions:
              Number(
                test.total_questions
              ),

            totalMarks:
              Number(
                test.total_marks
              ),

            isPublished:
              Number(
                test.is_published
              ) === 1,

            isActive:
              Number(
                test.is_active
              ) === 1,

            createdAt:
              test.created_at,

            updatedAt:
              test.updated_at,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET /api/admin/tests/[series]/[id]]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/tests/[series]/[id]]",
    }
  );

/* =========================================================
   PATCH
   EDIT TEST
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
           BUILD UPDATED VALUES
        --------------------------------------------------- */

        const title =
          body.title !==
          undefined
            ? String(
                body.title
              ).trim()
            : existing.title;

        const slug =
          body.slug !==
          undefined
            ? normalize(
                body.slug
              )
            : normalize(
                existing.slug
              );

        const description =
          body.description !==
          undefined
            ? normalizeText(
                body.description
              )
            : existing.description;

        const categoryId =
          body.categoryId !==
          undefined
            ? Number(
                body.categoryId
              )
            : Number(
                existing.category_id
              );

        const durationMinutes =
          body.durationMinutes !==
          undefined
            ? parsePositiveNumber(
                body.durationMinutes
              )
            : Number(
                existing.duration_minutes
              );

        const totalQuestions =
          body.totalQuestions !==
          undefined
            ? parseNonNegativeNumber(
                body.totalQuestions,
                0
              )
            : Number(
                existing.total_questions
              );

        const totalMarks =
          body.totalMarks !==
          undefined
            ? parseNonNegativeNumber(
                body.totalMarks,
                0
              )
            : Number(
                existing.total_marks
              );

        const isPublished =
          body.isPublished !==
          undefined
            ? parseBoolean(
                body.isPublished,
                Boolean(
                  Number(
                    existing.is_published
                  )
                )
              )
            : Number(
                existing.is_published
              ) === 1;

        const isActive =
          body.isActive !==
          undefined
            ? parseBoolean(
                body.isActive,
                Boolean(
                  Number(
                    existing.is_active
                  )
                )
              )
            : Number(
                existing.is_active
              ) === 1;

        /* ---------------------------------------------------
           VALIDATION
        --------------------------------------------------- */

        if (
          title.length <
            2 ||
          title.length >
            200
        ) {
          return adminBadRequestResponse(
            "Test title must be between 2 and 200 characters."
          );
        }

        if (
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
            slug
          )
        ) {
          return adminBadRequestResponse(
            "Slug may contain only lowercase letters, numbers and single hyphens."
          );
        }

        if (
          slug.length >
          180
        ) {
          return adminBadRequestResponse(
            "Slug is too long."
          );
        }

        if (
          !Number.isInteger(
            categoryId
          ) ||
          categoryId <= 0
        ) {
          return adminBadRequestResponse(
            "A valid category is required."
          );
        }

        if (
          durationMinutes ===
          null
        ) {
          return adminBadRequestResponse(
            "Duration must be greater than 0."
          );
        }

        /* ---------------------------------------------------
           CATEGORY
        --------------------------------------------------- */

        const category =
          await getCategory(
            categoryId
          );

        if (!category) {
          return adminBadRequestResponse(
            "Selected category does not exist."
          );
        }

        /* ---------------------------------------------------
           SLUG
        --------------------------------------------------- */

        if (
          slug !==
          normalize(
            existing.slug
          )
        ) {
          const exists =
            await slugExists({
              table:
                config.table,

              slug,

              excludeId:
                testId,
            });

          if (exists) {
            return adminConflictResponse(
              "A test with this slug already exists in this series."
            );
          }
        }

        /* ---------------------------------------------------
           UPDATE
        --------------------------------------------------- */

        const result =
          await db.execute({
            sql: `
              UPDATE ${config.table}

              SET
                category_id = ?,

                title = ?,

                slug = ?,

                description = ?,

                duration_minutes = ?,

                total_questions = ?,

                total_marks = ?,

                is_published = ?,

                is_active = ?,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE id = ?

              RETURNING
                id,
                category_id,
                title,
                slug,
                description,
                duration_minutes,
                total_questions,
                total_marks,
                is_published,
                is_active,
                created_at,
                updated_at
            `,

            args: [
              categoryId,

              title,

              slug,

              description,

              durationMinutes,

              totalQuestions,

              totalMarks,

              isPublished
                ? 1
                : 0,

              isActive
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

        return adminSuccess({
          message:
            "Test updated successfully.",

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

            categoryId:
              Number(
                updated.category_id
              ),

            category: {
              id:
                Number(
                  category.id
                ),

              name:
                category.name,

              slug:
                category.slug,
            },

            title:
              updated.title,

            slug:
              updated.slug,

            description:
              updated.description ||
              "",

            durationMinutes:
              Number(
                updated.duration_minutes
              ),

            totalQuestions:
              Number(
                updated.total_questions
              ),

            totalMarks:
              Number(
                updated.total_marks
              ),

            isPublished:
              Number(
                updated.is_published
              ) === 1,

            isActive:
              Number(
                updated.is_active
              ) === 1,

            createdAt:
              updated.created_at,

            updatedAt:
              updated.updated_at,
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
            "slug"
          )
        ) {
          return adminConflictResponse(
            "A test with this slug already exists in this series."
          );
        }

        return adminInternalError(
          error,
          "[PATCH /api/admin/tests/[series]/[id]]"
        );
      }
    },

    {
      logContext:
        "[PATCH /api/admin/tests/[series]/[id]]",
    }
  );