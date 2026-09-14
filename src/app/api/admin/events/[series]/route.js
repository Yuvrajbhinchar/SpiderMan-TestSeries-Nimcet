import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminInternalError,
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
    testTable: "free_tests",
    eventsTable: "free_test_events",
    attemptsTable: "free_test_attempts",
  },
  asspire: {
    id: 2,
    name: "Asspire",
    testTable: "asspire_tests",
    eventsTable: "asspire_test_events",
    attemptsTable: "asspire_test_attempts",
  },
  imppetus: {
    id: 3,
    name: "Imppetus",
    testTable: "imppetus_tests",
    eventsTable: "imppetus_test_events",
    attemptsTable: "imppetus_test_attempts",
  },
  spiderman: {
    id: 4,
    name: "SpiderMan",
    testTable: "spiderman_tests",
    eventsTable: "spiderman_test_events",
    attemptsTable: "spiderman_test_attempts",
  },
});

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/* =========================================================
   GET
   /api/admin/events/[series]
   Lists every event for this series, newest start first.
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.EVENT_READ,

  async ({ context }) => {
    const { series: rawSeries } = await context.params;
    const series = normalize(rawSeries);
    const config = SERIES_CONFIG[series];

    if (!config) {
      return adminBadRequestResponse("Invalid test series.");
    }

    try {
      const result = await db.execute({
        sql: `
          SELECT
            e.id, e.test_id, e.event_name, e.start_at, e.start_window_end,
            e.duration_minutes, e.auto_submit, e.is_published,
            e.created_at, e.updated_at,
            t.title AS test_title, t.slug AS test_slug,
            (
              SELECT COUNT(*) FROM ${config.attemptsTable} a
              WHERE a.event_id = e.id
            ) AS attempt_count
          FROM ${config.eventsTable} e
          INNER JOIN ${config.testTable} t ON t.id = e.test_id
          ORDER BY e.start_at DESC
        `,
        args: [],
      });

      const now = Date.now();

      const events = (result.rows || []).map((row) => {
        const startAt = row.start_at;
        const startWindowEnd = row.start_window_end;
        const startMs = startAt ? new Date(startAt).getTime() : NaN;
        const windowEndMs = startWindowEnd
          ? new Date(startWindowEnd).getTime()
          : NaN;

        let phase = "scheduled";

        if (!Number.isNaN(startMs) && now < startMs) {
          phase = "scheduled";
        } else if (!Number.isNaN(windowEndMs) && now <= windowEndMs) {
          phase = "entry_open";
        } else {
          phase = "closed";
        }

        return {
          id: Number(row.id),
          testId: Number(row.test_id),
          testTitle: row.test_title,
          testSlug: row.test_slug,
          eventName: row.event_name || null,
          startAt,
          startWindowEnd,
          durationMinutes: Number(row.duration_minutes),
          autoSubmit: Number(row.auto_submit) === 1,
          isPublished: Number(row.is_published) === 1,
          attemptCount: Number(row.attempt_count || 0),
          phase,
          createdAt: row.created_at || null,
          updatedAt: row.updated_at || null,
        };
      });

      return adminSuccess({
        series,
        seriesId: config.id,
        seriesName: config.name,
        events,
      });
    } catch (error) {
      return adminInternalError(error, "[GET /api/admin/events/[series]]");
    }
  },

  { logContext: "[GET /api/admin/events/[series]]" }
);

/* =========================================================
   POST
   /api/admin/events/[series]
   Body: {
     testId, eventName?, startAt, startWindowEnd,
     durationMinutes, autoSubmit?
   }
========================================================= */

export const POST = withAdminAction(
  ADMIN_ACTIONS.EVENT_CREATE,

  async ({ request, context, userId }) => {
    const { series: rawSeries } = await context.params;
    const series = normalize(rawSeries);
    const config = SERIES_CONFIG[series];

    if (!config) {
      return adminBadRequestResponse("Invalid test series.");
    }

    const body = await request.json().catch(() => null);
    if (!body) return adminBadRequestResponse("Invalid JSON request.");

    const testId = normalizeId(body.testId);
    if (!testId) {
      return adminBadRequestResponse("A valid testId is required.");
    }

    const eventName = normalizeText(body.eventName);

    const startAt = toIsoDate(body.startAt);
    if (!startAt) {
      return adminBadRequestResponse("A valid startAt date/time is required.");
    }

    const startWindowEnd = toIsoDate(body.startWindowEnd);
    if (!startWindowEnd) {
      return adminBadRequestResponse(
        "A valid startWindowEnd date/time is required."
      );
    }

    if (startWindowEnd.getTime() <= startAt.getTime()) {
      return adminBadRequestResponse(
        "startWindowEnd must be later than startAt."
      );
    }

    const durationMinutes = parsePositiveInt(body.durationMinutes);
    if (!durationMinutes) {
      return adminBadRequestResponse(
        "durationMinutes must be a positive integer."
      );
    }

    const autoSubmit = body.autoSubmit === false ? 0 : 1;

    try {
      const testResult = await db.execute({
        sql: `SELECT id, title FROM ${config.testTable} WHERE id = ? LIMIT 1`,
        args: [testId],
      });

      const test = testResult.rows?.[0];

      if (!test) {
        return adminBadRequestResponse(
          "That test does not exist in this series."
        );
      }

      const result = await db.execute({
        sql: `
          INSERT INTO ${config.eventsTable}
            (test_id, event_name, start_at, start_window_end,
             duration_minutes, auto_submit, is_published)
          VALUES (?, ?, ?, ?, ?, ?, 0)
          RETURNING
            id, test_id, event_name, start_at, start_window_end,
            duration_minutes, auto_submit, is_published,
            created_at, updated_at
        `,
        args: [
          testId,
          eventName,
          startAt.toISOString(),
          startWindowEnd.toISOString(),
          durationMinutes,
          autoSubmit,
        ],
      });

      const created = result.rows?.[0];

      return adminSuccess(
        {
          message: "Event created successfully. It is unpublished by default.",
          createdBy: Number(userId),
          event: {
            id: Number(created.id),
            testId: Number(created.test_id),
            testTitle: test.title,
            eventName: created.event_name || null,
            startAt: created.start_at,
            startWindowEnd: created.start_window_end,
            durationMinutes: Number(created.duration_minutes),
            autoSubmit: Number(created.auto_submit) === 1,
            isPublished: false,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          },
        },
        201
      );
    } catch (error) {
      return adminInternalError(error, "[POST /api/admin/events/[series]]");
    }
  },

  { logContext: "[POST /api/admin/events/[series]]" }
);