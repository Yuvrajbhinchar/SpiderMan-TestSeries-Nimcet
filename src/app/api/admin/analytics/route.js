import { batchWrite } from "@/lib/turso";

import { SERIES_CONFIG } from "@/lib/testSecurity";

import {
  ADMIN_ACTIONS,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   CONSTANTS
========================================================= */

const COMPLETED_STATUSES = ["submitted", "auto_submitted"];
const COMPLETED_STATUS_SQL = COMPLETED_STATUSES.map(() => "?").join(", ");

function normalizePassThreshold(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) return 40;
  return num;
}

function roundPct(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 10) / 10 : null;
}

/* =========================================================
   GET
   /api/admin/analytics?passThreshold=40
   ---------------------------------------------------------
   One batched read per series (tests, questions, attempts,
   top 5 tests) plus one users query — all in a single
   db.batch() round trip, using the existing
   idx_*_attempts_user_test_status / event_score indexes
   for the attempt aggregates.
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.DASHBOARD_READ,

  async ({ request }) => {
    try {
      const url = new URL(request.url);
      const passThreshold = normalizePassThreshold(
        url.searchParams.get("passThreshold")
      );

      const seriesEntries = Object.entries(SERIES_CONFIG);

      const statements = [];

      seriesEntries.forEach(([, config]) => {
        // 1. Tests: total + published
        statements.push({
          sql: `SELECT COUNT(*) AS total, SUM(is_published) AS published FROM ${config.testTable}`,
          args: [],
        });

        // 2. Questions: total
        statements.push({
          sql: `SELECT COUNT(*) AS total FROM ${config.questionTable}`,
          args: [],
        });

        // 3. Attempts: total, completed, avg %, pass count (>= passThreshold%)
        statements.push({
          sql: `
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status IN (${COMPLETED_STATUS_SQL}) THEN 1 ELSE 0 END) AS completed,
              AVG(
                CASE WHEN status IN (${COMPLETED_STATUS_SQL}) AND total_marks > 0
                THEN (score * 100.0 / total_marks) END
              ) AS avg_pct,
              SUM(
                CASE WHEN status IN (${COMPLETED_STATUS_SQL}) AND total_marks > 0
                  AND (score * 100.0 / total_marks) >= ?
                THEN 1 ELSE 0 END
              ) AS passed
            FROM ${config.attemptTable}
          `,
          args: [
            ...COMPLETED_STATUSES,
            ...COMPLETED_STATUSES,
            ...COMPLETED_STATUSES,
            passThreshold,
          ],
        });

        // 4. Top 5 tests by attempt count, with avg score %
        statements.push({
          sql: `
            SELECT
              t.id, t.title,
              COUNT(a.id) AS attempts,
              AVG(CASE WHEN a.total_marks > 0 THEN (a.score * 100.0 / a.total_marks) END) AS avg_pct
            FROM ${config.testTable} t
            LEFT JOIN ${config.attemptTable} a
              ON a.test_id = t.id AND a.status IN (${COMPLETED_STATUS_SQL})
            GROUP BY t.id
            ORDER BY attempts DESC, t.id ASC
            LIMIT 5
          `,
          args: [...COMPLETED_STATUSES],
        });
      });

      // 5. Users: total + active
      statements.push({
        sql: `SELECT COUNT(*) AS total, SUM(is_active) AS active FROM users`,
        args: [],
      });

      const results = await batchWrite(statements, "read");

      let cursor = 0;
      const seriesStats = [];
      let topTestsAll = [];

      seriesEntries.forEach(([key, config]) => {
        const testsRow = results[cursor++].rows?.[0] || {};
        const questionsRow = results[cursor++].rows?.[0] || {};
        const attemptsRow = results[cursor++].rows?.[0] || {};
        const topRows = results[cursor++].rows || [];

        const completed = Number(attemptsRow.completed || 0);

        seriesStats.push({
          series: key,
          seriesId: config.seriesId,
          totalTests: Number(testsRow.total || 0),
          publishedTests: Number(testsRow.published || 0),
          totalQuestions: Number(questionsRow.total || 0),
          totalAttempts: Number(attemptsRow.total || 0),
          completedAttempts: completed,
          avgScorePct: roundPct(attemptsRow.avg_pct),
          passRatePct: completed
            ? roundPct((Number(attemptsRow.passed || 0) / completed) * 100)
            : null,
        });

        topRows.forEach((row) => {
          const attempts = Number(row.attempts || 0);
          if (attempts <= 0) return;

          topTestsAll.push({
            series: key,
            seriesId: config.seriesId,
            testId: Number(row.id),
            title: row.title,
            attempts,
            avgScorePct: roundPct(row.avg_pct),
          });
        });
      });

      const usersRow = results[cursor++].rows?.[0] || {};

      topTestsAll = topTestsAll
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 8);

      const overview = seriesStats.reduce(
        (acc, s) => ({
          totalTests: acc.totalTests + s.totalTests,
          publishedTests: acc.publishedTests + s.publishedTests,
          totalQuestions: acc.totalQuestions + s.totalQuestions,
          totalAttempts: acc.totalAttempts + s.totalAttempts,
          completedAttempts: acc.completedAttempts + s.completedAttempts,
        }),
        {
          totalTests: 0,
          publishedTests: 0,
          totalQuestions: 0,
          totalAttempts: 0,
          completedAttempts: 0,
        }
      );

      overview.totalUsers = Number(usersRow.total || 0);
      overview.activeUsers = Number(usersRow.active || 0);

      return adminSuccess({
        passThreshold,
        overview,
        series: seriesStats,
        topTests: topTestsAll,
      });
    } catch (error) {
      return adminInternalError(error, "[GET /api/admin/analytics]");
    }
  },

  { logContext: "[GET /api/admin/analytics]" }
);