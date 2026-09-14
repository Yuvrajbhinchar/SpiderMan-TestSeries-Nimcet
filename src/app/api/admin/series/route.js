import { db, batchWrite } from "@/lib/turso";

import { SERIES_CONFIG } from "@/lib/testSecurity";

import {
  ADMIN_ACTIONS,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   GET
   /api/admin/series
   Lists every row in test_series with a live test count
   pulled from that series' own test table.
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.SERIES_READ,

  async () => {
    try {
      const seriesResult = await db.execute({
        sql: `
          SELECT id, name, slug, description, is_paid, is_active, created_at, updated_at
          FROM test_series
          ORDER BY id ASC
        `,
        args: [],
      });

      const seriesRows = seriesResult.rows || [];

      // One count query per series table, run together in a single
      // batch round trip instead of N sequential requests.
      const countStatements = seriesRows.map((row) => {
        const config = Object.values(SERIES_CONFIG).find(
          (entry) => entry.seriesId === Number(row.id)
        );

        return {
          sql: config
            ? `SELECT COUNT(*) AS count FROM ${config.testTable}`
            : `SELECT 0 AS count`,
          args: [],
        };
      });

      const countResults =
        countStatements.length > 0
          ? await batchWrite(countStatements, "read")
          : [];

      const series = seriesRows.map((row, index) => ({
        id: Number(row.id),
        name: row.name,
        slug: row.slug,
        description: row.description || null,
        isPaid: Number(row.is_paid) === 1,
        isActive: Number(row.is_active) === 1,
        testCount: Number(countResults[index]?.rows?.[0]?.count || 0),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      }));

      return adminSuccess({ series });
    } catch (error) {
      return adminInternalError(error, "[GET /api/admin/series]");
    }
  },

  { logContext: "[GET /api/admin/series]" }
);