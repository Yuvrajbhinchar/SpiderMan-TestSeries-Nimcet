import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminInternalError,
  adminSuccess,
  adminConflictResponse,
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

function normalize(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  const text = String(
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
  value,
  fallback = null
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function parseBoolean(
  value,
  fallback = false
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

function getSeriesConfig(
  value
) {
  const series =
    normalize(value);

  if (
    !series ||
    !SERIES_CONFIG[
      series
    ]
  ) {
    return null;
  }

  return {
    series,
    config:
      SERIES_CONFIG[
        series
      ],
  };
}

/* =========================================================
   VALIDATE TEST PAYLOAD
========================================================= */

function validateTestPayload(
  body,
  {
    isCreate = true,
  } = {}
) {
  const title =
    normalizeText(
      body?.title
    );

  const slug =
    normalize(
      body?.slug
    );

  const description =
    normalizeText(
      body?.description
    );

  const categoryId =
    Number(
      body?.categoryId
    );

  const durationMinutes =
    parsePositiveNumber(
      body?.durationMinutes
    );

  const totalQuestions =
    parseNonNegativeNumber(
      body?.totalQuestions,
      0
    );

  const totalMarks =
    parseNonNegativeNumber(
      body?.totalMarks,
      0
    );

  const isPublished =
    parseBoolean(
      body?.isPublished,
      false
    );

  const isActive =
    parseBoolean(
      body?.isActive,
      true
    );

  if (!title) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Test title is required."
        ),
    };
  }

  if (
    title.length <
      2 ||
    title.length >
      200
  ) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Test title must be between 2 and 200 characters."
        ),
    };
  }

  if (!slug) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Test slug is required."
        ),
    };
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug
    )
  ) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Slug may contain only lowercase letters, numbers and single hyphens."
        ),
    };
  }

  if (
    slug.length >
    180
  ) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Slug is too long."
        ),
    };
  }

  if (
    !Number.isInteger(
      categoryId
    ) ||
    categoryId <= 0
  ) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "A valid category is required."
        ),
    };
  }

  if (
    durationMinutes ===
    null
  ) {
    return {
      ok: false,
      response:
        adminBadRequestResponse(
          "Duration must be greater than 0."
        ),
    };
  }

  return {
    ok: true,

    data: {
      title,
      slug,
      description,
      categoryId,

      durationMinutes:
        Number(
          durationMinutes
        ),

      totalQuestions:
        Number(
          totalQuestions
        ),

      totalMarks:
        Number(
          totalMarks
        ),

      isPublished,
      isActive,
    },
  };
}

/* =========================================================
   CATEGORY VALIDATION
========================================================= */

async function validateCategory(
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

  const category =
    result.rows?.[0];

  if (!category) {
    return {
      ok: false,

      response:
        adminBadRequestResponse(
          "Selected category does not exist."
        ),
    };
  }

  return {
    ok: true,

    category,
  };
}

/* =========================================================
   SLUG CHECK
========================================================= */

async function slugExists({
  table,
  slug,
  excludeId = null,
}) {
  const args = [
    slug,
  ];

  let excludeSql =
    "";

  if (
    excludeId !== null
  ) {
    excludeSql =
      "AND id != ?";

    args.push(
      excludeId
    );
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id
        FROM ${table}
        WHERE
          LOWER(slug) = LOWER(?)
          ${excludeSql}
        LIMIT 1
      `,

      args,
    });

  return Boolean(
    result.rows?.length
  );
}

/* =========================================================
   GET
   LIST TESTS
========================================================= */

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.TEST_READ,

    async ({
      request,
    }) => {
      try {
        const {
          searchParams,
        } = new URL(
          request.url
        );

        const requestedSeries =
          normalize(
            searchParams.get(
              "series"
            )
          ) || "all";

        const search =
          String(
            searchParams.get(
              "search"
            ) || ""
          ).trim();

        const status =
          normalize(
            searchParams.get(
              "status"
            )
          ) || "all";

        let limit =
          Number(
            searchParams.get(
              "limit"
            ) || 20
          );

        if (
          !Number.isFinite(
            limit
          )
        ) {
          limit = 20;
        }

        limit =
          Math.min(
            Math.max(
              Math.floor(
                limit
              ),
              1
            ),
            50
          );

        let offset =
          Number(
            searchParams.get(
              "cursor"
            ) || 0
          );

        if (
          !Number.isInteger(
            offset
          ) ||
          offset < 0
        ) {
          offset = 0;
        }

        let selectedSeries =
          Object.entries(
            SERIES_CONFIG
          );

        if (
          requestedSeries !==
          "all"
        ) {
          const config =
            SERIES_CONFIG[
              requestedSeries
            ];

          if (!config) {
            return adminBadRequestResponse(
              "Invalid test series."
            );
          }

          selectedSeries = [
            [
              requestedSeries,
              config,
            ],
          ];
        }

        const unionParts =
          [];

        const unionArgs =
          [];

        for (
          const [
            seriesSlug,
            config,
          ] of selectedSeries
        ) {
          const conditions =
            [
              "1 = 1",
            ];

          const args =
            [];

          if (search) {
            const pattern =
              `%${search.toLowerCase()}%`;

            conditions.push(`
              (
                LOWER(t.title) LIKE ?
                OR LOWER(t.slug) LIKE ?
                OR LOWER(
                  COALESCE(
                    t.description,
                    ''
                  )
                ) LIKE ?
              )
            `);

            args.push(
              pattern,
              pattern,
              pattern
            );
          }

          switch (
            status
          ) {
            case "active":
              conditions.push(
                "t.is_active = 1"
              );
              break;

            case "inactive":
              conditions.push(
                "t.is_active = 0"
              );
              break;

            case "published":
              conditions.push(
                "t.is_published = 1"
              );
              break;

            case "unpublished":
              conditions.push(
                "t.is_published = 0"
              );
              break;

            case "all":
            default:
              break;
          }

          unionParts.push(`
            SELECT
              t.id AS test_id,
              t.category_id,
              t.title,
              t.slug,
              t.description,
              t.duration_minutes,
              t.total_questions,
              t.total_marks,
              t.is_published,
              t.is_active,
              t.created_at,
              t.updated_at,

              c.name AS category_name,
              c.slug AS category_slug,

              ${config.id}
                AS series_id,

              '${seriesSlug}'
                AS series_slug,

              '${config.name.replace(
                /'/g,
                "''"
              )}'
                AS series_name

            FROM ${config.table} t

            LEFT JOIN test_categories c
              ON c.id =
                t.category_id

            WHERE
              ${conditions.join(
                "\nAND "
              )}
          `);

          unionArgs.push(
            ...args
          );
        }

        const result =
          await db.execute({
            sql: `
              SELECT *
              FROM (
                ${unionParts.join(
                  "\nUNION ALL\n"
                )}
              ) all_tests

              ORDER BY
                all_tests.created_at DESC,
                all_tests.series_id ASC,
                all_tests.test_id DESC

              LIMIT ?

              OFFSET ?
            `,

            args: [
              ...unionArgs,

              limit + 1,

              offset,
            ],
          });

        const rows =
          Array.isArray(
            result.rows
          )
            ? result.rows
            : [];

        const hasMore =
          rows.length >
          limit;

        const visibleRows =
          hasMore
            ? rows.slice(
                0,
                limit
              )
            : rows;

        const tests =
          visibleRows.map(
            (row) => ({
              id:
                Number(
                  row.test_id
                ),

              seriesId:
                Number(
                  row.series_id
                ),

              seriesSlug:
                String(
                  row.series_slug
                ),

              seriesName:
                row.series_name,

              categoryId:
                row.category_id ===
                  null ||
                row.category_id ===
                  undefined
                  ? null
                  : Number(
                      row.category_id
                    ),

              categoryName:
                row.category_name ||
                null,

              categorySlug:
                row.category_slug ||
                null,

              title:
                row.title,

              slug:
                row.slug,

              description:
                row.description ||
                null,

              durationMinutes:
                Number(
                  row.duration_minutes ||
                    0
                ),

              totalQuestions:
                Number(
                  row.total_questions ||
                    0
                ),

              totalMarks:
                Number(
                  row.total_marks ||
                    0
                ),

              isPublished:
                Number(
                  row.is_published ||
                    0
                ) === 1,

              isActive:
                Number(
                  row.is_active ||
                    0
                ) === 1,

              createdAt:
                row.created_at ||
                null,

              updatedAt:
                row.updated_at ||
                null,
            })
          );

        return adminSuccess({
          filters: {
            series:
              requestedSeries,

            search,

            status,

            limit,
          },

          tests,

          pagination: {
            cursor:
              offset,

            nextCursor:
              hasMore
                ? offset +
                  limit
                : null,

            hasMore,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET /api/admin/tests]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/tests]",
    }
  );

/* =========================================================
   POST
   CREATE TEST
========================================================= */

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.TEST_CREATE,

    async ({
      request,
    }) => {
      try {
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

        const parsedSeries =
          getSeriesConfig(
            body?.series
          );

        if (!parsedSeries) {
          return adminBadRequestResponse(
            "Valid test series is required."
          );
        }

        const {
          series,
          config,
        } =
          parsedSeries;

        const validation =
          validateTestPayload(
            body,
            {
              isCreate: true,
            }
          );

        if (
          !validation.ok
        ) {
          return validation.response;
        }

        const test =
          validation.data;

        /* ---------------------------------------------------
           CATEGORY
        --------------------------------------------------- */

        const category =
          await validateCategory(
            test.categoryId
          );

        if (
          !category.ok
        ) {
          return category.response;
        }

        /* ---------------------------------------------------
           SLUG UNIQUE
        --------------------------------------------------- */

        const exists =
          await slugExists({
            table:
              config.table,

            slug:
              test.slug,
          });

        if (exists) {
          return adminConflictResponse(
            "A test with this slug already exists in this series."
          );
        }

        /* ---------------------------------------------------
           CREATE TEST

           New tests are drafts by default unless explicitly
           published in the request.
        --------------------------------------------------- */

        const result =
          await db.execute({
            sql: `
              INSERT INTO ${config.table} (
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
              )

              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

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
              test.categoryId,

              test.title,

              test.slug,

              test.description,

              test.durationMinutes,

              test.totalQuestions,

              test.totalMarks,

              test.isPublished
                ? 1
                : 0,

              test.isActive
                ? 1
                : 0,
            ],
          });

        const row =
          result.rows?.[0];

        if (!row) {
          throw new Error(
            "Test insert returned no row."
          );
        }

        return adminSuccess(
          {
            message:
              "Test created successfully.",

            test: {
              id:
                Number(
                  row.id
                ),

              series,

              seriesId:
                config.id,

              categoryId:
                Number(
                  row.category_id
                ),

              categoryName:
  category.category?.name ||
  null,

              title:
                row.title,

              slug:
                row.slug,

              description:
                row.description ||
                null,

              durationMinutes:
                Number(
                  row.duration_minutes
                ),

              totalQuestions:
                Number(
                  row.total_questions
                ),

              totalMarks:
                Number(
                  row.total_marks
                ),

              isPublished:
                Number(
                  row.is_published
                ) === 1,

              isActive:
                Number(
                  row.is_active
                ) === 1,

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at,
            },

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
        /*
         * SQLite UNIQUE constraint can still race if two admins
         * create the same slug at almost exactly the same time.
         *
         * Return a safe conflict instead of leaking SQL details.
         */

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
          "[POST /api/admin/tests]"
        );
      }
    },

    {
      logContext:
        "[POST /api/admin/tests]",
    }
  );