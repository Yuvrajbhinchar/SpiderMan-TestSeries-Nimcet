import {
  ADMIN_ACTIONS,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  withAdminAction,
} from "@/lib/adminApi";

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.TEST_READ,

    async () => {
      try {
        const result =
          await (
            await import(
              "@/lib/turso"
            )
          ).db.execute({
            sql: `
              SELECT
                id,
                parent_id,
                name,
                slug,
                description,
                is_active
              FROM test_categories

              ORDER BY
                is_active DESC,
                name ASC
            `,
            args: [],
          });

        const categories =
          (
            result.rows ||
            []
          ).map(
            (row) => ({
              id:
                Number(
                  row.id
                ),

              parentId:
                row.parent_id ===
                  null
                  ? null
                  : Number(
                      row.parent_id
                    ),

              name:
                row.name,

              slug:
                row.slug,

              description:
                row.description ||
                null,

              isActive:
                Number(
                  row.is_active
                ) === 1,
            })
          );

        return adminSuccess({
          categories,
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET /api/admin/categories]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/categories]",
    }
  );