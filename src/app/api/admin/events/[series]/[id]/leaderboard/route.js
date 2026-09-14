import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG = Object.freeze({
  free: {
    id: 1,
    name: "Free",
    eventsTable: "free_test_events",
    attemptsTable: "free_test_attempts",
  },
  asspire: {
    id: 2,
    name: "Asspire",
    eventsTable: "asspire_test_events",
    attemptsTable: "asspire_test_attempts",
  },
  imppetus: {
    id: 3,
    name: "Imppetus",
    eventsTable: "imppetus_test_events",
    attemptsTable: "imppetus_test_attempts",
  },
  spiderman: {
    id: 4,
    name: "SpiderMan",
    eventsTable: "spiderman_test_events",
    attemptsTable: "spiderman_test_attempts",
  },
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* =========================================================
   GET
   /api/admin/events/[series]/[id]/leaderboard
   Ranked list of submitted attempts for this live event.
   Uses idx_*_attempts_event_score (event_id, status, score DESC).
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.EVENT_READ,

  async ({ context }) => {
    const { series: rawSeries, id: rawId } = await context.params;
    const series = normalize(rawSeries);
    const eventId = normalizeId(rawId);
    const config = SERIES_CONFIG[series];

    if (!config) return adminBadRequestResponse("Invalid test series.");
    if (!eventId) return adminBadRequestResponse("Invalid event ID.");

    try {
      const eventResult = await db.execute({
        sql: `
          SELECT id, event_name, start_at, start_window_end, is_published
          FROM ${config.eventsTable}
          WHERE id = ?
          LIMIT 1
        `,
        args: [eventId],
      });

      const event = eventResult.rows?.[0];

      if (!event) return adminNotFoundResponse("Event not found.");

      const result = await db.execute({
        sql: `
          SELECT
            a.user_id, a.score, a.total_marks, a.correct_count,
            a.wrong_count, a.unanswered_count, a.time_taken_seconds,
            a.submitted_at, a.status,
            u.username, u.display_name
          FROM ${config.attemptsTable} a
          INNER JOIN users u ON u.id = a.user_id
          WHERE a.event_id = ?
            AND a.status IN ('submitted', 'auto_submitted')
          ORDER BY a.score DESC, a.time_taken_seconds ASC, a.submitted_at ASC
        `,
        args: [eventId],
      });

      const rows = Array.isArray(result.rows) ? result.rows : [];

      const leaderboard = rows.map((row, index) => ({
        rank: index + 1,
        userId: Number(row.user_id),
        username: row.username,
        displayName: row.display_name || row.username,
        score: Number(row.score || 0),
        totalMarks: row.total_marks === null ? null : Number(row.total_marks),
        correctCount: Number(row.correct_count || 0),
        wrongCount: Number(row.wrong_count || 0),
        unansweredCount: Number(row.unanswered_count || 0),
        timeTakenSeconds:
          row.time_taken_seconds === null ? null : Number(row.time_taken_seconds),
        submittedAt: row.submitted_at || null,
        status: row.status,
      }));

      return adminSuccess({
        event: {
          id: Number(event.id),
          series,
          seriesId: config.id,
          eventName: event.event_name || null,
          startAt: event.start_at,
          startWindowEnd: event.start_window_end,
          isPublished: Number(event.is_published) === 1,
        },
        leaderboard,
        totalRanked: leaderboard.length,
      });
    } catch (error) {
      return adminInternalError(
        error,
        "[GET /api/admin/events/[series]/[id]/leaderboard]"
      );
    }
  },

  { logContext: "[GET /api/admin/events/[series]/[id]/leaderboard]" }
);